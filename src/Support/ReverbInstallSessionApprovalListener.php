<?php

namespace Wyxos\Shift\Support;

use RuntimeException;

class ReverbInstallSessionApprovalListener implements InstallSessionApprovalListener
{
    private const DEFAULT_TIMEOUT_SECONDS = 600;

    private const MAX_CONNECT_TIMEOUT_SECONDS = 10;

    private mixed $stream = null;

    private string $readBuffer = '';

    private function __construct(
        private readonly array $metadata,
        private ?int $deadline,
    ) {
        $this->deadline ??= time() + self::DEFAULT_TIMEOUT_SECONDS;
    }

    public function __destruct()
    {
        if (is_resource($this->stream)) {
            fclose($this->stream);
        }
    }

    public static function connect(array $metadata, ?int $deadline = null): self
    {
        $listener = new self($metadata, $deadline);
        $listener->open();
        $listener->subscribe();

        return $listener;
    }

    public function wait(): array
    {
        $message = $this->waitForEvent([$this->eventName(), '.'.$this->eventName()]);

        return $this->decodeEventData($message['data'] ?? []);
    }

    private function open(): void
    {
        $this->assertConfigured('key');
        $this->assertConfigured('channel');
        $this->assertConfigured('event');

        $host = $this->host();
        $port = $this->port();
        $scheme = $this->scheme();
        $transport = in_array($scheme, ['https', 'wss'], true) ? 'ssl' : 'tcp';
        $timeout = $this->remainingSeconds(self::MAX_CONNECT_TIMEOUT_SECONDS);
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => ! $this->shouldSkipTlsVerification($host),
                'verify_peer_name' => ! $this->shouldSkipTlsVerification($host),
                'SNI_enabled' => true,
                'peer_name' => $host,
            ],
        ]);

        $stream = @stream_socket_client(
            "{$transport}://{$host}:{$port}",
            $errno,
            $errstr,
            $timeout,
            STREAM_CLIENT_CONNECT,
            $context,
        );

        if (! is_resource($stream)) {
            throw new RuntimeException("Unable to connect to SHIFT Reverb at {$host}:{$port}.");
        }

        $this->stream = $stream;
        stream_set_timeout($this->stream, 1);
        $this->handshake();
    }

    private function handshake(): void
    {
        $key = base64_encode(random_bytes(16));
        $hostHeader = $this->host().':'.$this->port();
        $request = implode("\r\n", [
            'GET '.$this->path().' HTTP/1.1',
            'Host: '.$hostHeader,
            'Upgrade: websocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Key: '.$key,
            'Sec-WebSocket-Version: 13',
            'Origin: '.$this->origin(),
            '',
            '',
        ]);

        $this->write($request);

        $response = '';

        while (! str_contains($response, "\r\n\r\n")) {
            $this->assertNotExpired('Timed out while connecting to SHIFT Reverb.');
            $chunk = fread($this->stream, 1024);

            if ($chunk === false) {
                throw new RuntimeException('Unable to read the SHIFT Reverb handshake response.');
            }

            if ($chunk === '') {
                $this->throwIfStreamClosed('SHIFT Reverb closed the connection during handshake.');

                continue;
            }

            $response .= $chunk;
        }

        $headerEnd = strpos($response, "\r\n\r\n");
        $headers = substr($response, 0, $headerEnd + 4);
        $this->readBuffer .= substr($response, $headerEnd + 4);

        if (! str_starts_with($headers, 'HTTP/1.1 101') && ! str_starts_with($headers, 'HTTP/1.0 101')) {
            throw new RuntimeException('SHIFT Reverb did not accept the WebSocket connection.');
        }

        if (! preg_match('/^Sec-WebSocket-Accept:\s*(.+)$/mi', $headers, $matches)) {
            throw new RuntimeException('SHIFT Reverb handshake response was missing Sec-WebSocket-Accept.');
        }

        $expectedAccept = base64_encode(sha1($key.'258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));

        if (trim($matches[1]) !== $expectedAccept) {
            throw new RuntimeException('SHIFT Reverb handshake response failed validation.');
        }
    }

    private function subscribe(): void
    {
        $this->waitForEvent(['pusher:connection_established']);
        $this->sendJson([
            'event' => 'pusher:subscribe',
            'data' => [
                'channel' => $this->channel(),
            ],
        ]);
        $this->waitForEvent(['pusher_internal:subscription_succeeded']);
    }

    private function waitForEvent(array $events): array
    {
        while (true) {
            $this->assertNotExpired('Timed out waiting for SHIFT browser approval.');

            $message = $this->readMessage();

            if ($message === null) {
                continue;
            }

            $event = $message['event'] ?? null;
            $channel = $message['channel'] ?? null;

            if (! is_string($event) || ! in_array($event, $events, true)) {
                continue;
            }

            if (str_starts_with($event, 'pusher:') || $channel === null || $channel === $this->channel()) {
                return $message;
            }
        }
    }

    private function readMessage(): ?array
    {
        $frame = $this->readFrame();

        if ($frame === null) {
            return null;
        }

        $message = json_decode($frame, true);

        return is_array($message) ? $message : null;
    }

    private function readFrame(): ?string
    {
        $header = $this->readBytes(2);

        if ($header === null) {
            return null;
        }

        $first = ord($header[0]);
        $second = ord($header[1]);
        $opcode = $first & 0x0f;
        $masked = ($second & 0x80) === 0x80;
        $length = $second & 0x7f;

        if ($length === 126) {
            $extended = $this->readBytes(2);
            $length = $extended === null ? 0 : unpack('n', $extended)[1];
        } elseif ($length === 127) {
            $extended = $this->readBytes(8);
            $parts = $extended === null ? [0, 0] : array_values(unpack('N2', $extended));
            $length = ($parts[0] * 4294967296) + $parts[1];
        }

        $mask = $masked ? $this->readBytes(4) : null;
        $payload = $length > 0 ? $this->readBytes($length) : '';

        if ($payload === null) {
            return null;
        }

        if ($masked && is_string($mask)) {
            $payload = $this->mask($payload, $mask);
        }

        if ($opcode === 0x8) {
            throw new RuntimeException('SHIFT Reverb closed the approval connection.');
        }

        if ($opcode === 0x9) {
            $this->writeFrame($payload, 0xA);

            return null;
        }

        if ($opcode === 0xA || ($opcode !== 0x1 && $opcode !== 0x0)) {
            return null;
        }

        return $payload;
    }

    private function readBytes(int $length): ?string
    {
        $buffer = '';

        while (strlen($buffer) < $length) {
            if ($this->readBuffer !== '') {
                $needed = $length - strlen($buffer);
                $buffer .= substr($this->readBuffer, 0, $needed);
                $this->readBuffer = substr($this->readBuffer, $needed);

                continue;
            }

            $this->assertNotExpired('Timed out waiting for SHIFT browser approval.');
            $chunk = fread($this->stream, $length - strlen($buffer));

            if ($chunk === false) {
                $metadata = stream_get_meta_data($this->stream);

                if (($metadata['timed_out'] ?? false) === true) {
                    return null;
                }

                throw new RuntimeException('Unable to read from SHIFT Reverb.');
            }

            if ($chunk === '') {
                $metadata = stream_get_meta_data($this->stream);

                if (($metadata['timed_out'] ?? false) === true) {
                    return null;
                }

                $this->throwIfStreamClosed('SHIFT Reverb closed the approval connection.');
                usleep(10_000);

                continue;
            }

            $buffer .= $chunk;
        }

        return $buffer;
    }

    private function sendJson(array $payload): void
    {
        $this->writeFrame(json_encode($payload, JSON_THROW_ON_ERROR));
    }

    private function writeFrame(string $payload, int $opcode = 0x1): void
    {
        $length = strlen($payload);
        $first = 0x80 | $opcode;

        if ($length < 126) {
            $header = pack('CC', $first, 0x80 | $length);
        } elseif ($length <= 65_535) {
            $header = pack('CCn', $first, 0x80 | 126, $length);
        } else {
            throw new RuntimeException('SHIFT Reverb client frame is too large.');
        }

        $mask = random_bytes(4);
        $this->write($header.$mask.$this->mask($payload, $mask));
    }

    private function write(string $payload): void
    {
        $remaining = $payload;

        while ($remaining !== '') {
            $written = fwrite($this->stream, $remaining);

            if ($written === false || $written === 0) {
                throw new RuntimeException('Unable to write to SHIFT Reverb.');
            }

            $remaining = substr($remaining, $written);
        }
    }

    private function mask(string $payload, string $mask): string
    {
        $masked = '';
        $length = strlen($payload);

        for ($index = 0; $index < $length; $index++) {
            $masked .= $payload[$index] ^ $mask[$index % 4];
        }

        return $masked;
    }

    private function decodeEventData(mixed $data): array
    {
        if (is_array($data)) {
            return $data;
        }

        if (! is_string($data) || $data === '') {
            return [];
        }

        $decoded = json_decode($data, true);

        return is_array($decoded) ? $decoded : ['data' => $data];
    }

    private function path(): string
    {
        $prefix = trim((string) ($this->metadata['path'] ?? ''), '/');
        $path = ($prefix === '' ? '' : '/'.$prefix).'/app/'.rawurlencode($this->value('key'));

        return $path.'?protocol=7&client=shift-php&version=1.0&flash=false';
    }

    private function origin(): string
    {
        $scheme = in_array($this->scheme(), ['https', 'wss'], true) ? 'https' : 'http';

        return "{$scheme}://".$this->host();
    }

    private function host(): string
    {
        return $this->value('ws_host', 'host');
    }

    private function port(): int
    {
        $port = $this->metadata['ws_port'] ?? $this->metadata['port'] ?? null;

        if (is_numeric($port)) {
            return (int) $port;
        }

        return in_array($this->scheme(), ['https', 'wss'], true) ? 443 : 80;
    }

    private function scheme(): string
    {
        return strtolower($this->value('scheme', default: 'https'));
    }

    private function channel(): string
    {
        return $this->value('channel');
    }

    private function eventName(): string
    {
        return ltrim($this->value('event'), '.');
    }

    private function value(string $key, ?string $fallbackKey = null, ?string $default = null): string
    {
        $value = $this->metadata[$key] ?? ($fallbackKey !== null ? ($this->metadata[$fallbackKey] ?? null) : null) ?? $default;

        if (! is_string($value) || $value === '') {
            throw new RuntimeException("SHIFT Reverb metadata is missing {$key}.");
        }

        return $value;
    }

    private function assertConfigured(string $key): void
    {
        $this->value($key);
    }

    private function remainingSeconds(int $maximum): int
    {
        if ($this->deadline === null) {
            return $maximum;
        }

        return max(1, min($maximum, $this->deadline - time()));
    }

    private function assertNotExpired(string $message): void
    {
        if ($this->deadline !== null && time() >= $this->deadline) {
            throw new RuntimeException($message);
        }
    }

    private function throwIfStreamClosed(string $message): void
    {
        $metadata = stream_get_meta_data($this->stream);

        if (($metadata['eof'] ?? false) === true) {
            throw new RuntimeException($message);
        }
    }

    private function shouldSkipTlsVerification(string $host): bool
    {
        if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
            return true;
        }

        if (str_ends_with($host, '.test') || str_ends_with($host, '.local')) {
            return true;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
        }

        return false;
    }
}
