<?php

namespace Wyxos\Shift\Support;

class ShiftErrorScrubber
{
    private const FILTERED = '[Filtered]';

    private const SENSITIVE_KEYS = [
        'authorization',
        'proxy_authorization',
        'x_authorization',
        'cookie',
        'password',
        'passwd',
        'pwd',
        'secret',
        'session',
        'session_id',
        'shift_session',
        'token',
        'api_key',
        'apikey',
        'access_token',
        'refresh_token',
        'csrf',
        'xsrf',
    ];

    public function scrubArray(?array $value, int $depth = 0): array
    {
        if ($value === null || $depth > 8) {
            return [];
        }

        $scrubbed = [];

        foreach ($value as $key => $item) {
            if ($this->isSensitiveKey((string) $key)) {
                $scrubbed[$key] = self::FILTERED;

                continue;
            }

            $scrubbed[$key] = $this->scrubValue($item, $depth + 1);
        }

        return $scrubbed;
    }

    public function scrubString(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return $value;
        }

        $value = preg_replace_callback(
            '/\b((?:proxy[-_])?authorization|x[-_]?authorization|cookie)\s*:\s*[^\r\n]+/i',
            fn (array $matches) => trim((string) strtok($matches[0], ':')).': '.self::FILTERED,
            $value,
        ) ?? $value;

        $value = preg_replace_callback(
            '/\b(password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie|session)\s*([:=])\s*([^\s,;&]+)/i',
            fn (array $matches) => $matches[1].$matches[2].($matches[2] === ':' ? ' ' : '').self::FILTERED,
            $value,
        ) ?? $value;

        return preg_replace('/\b(Bearer|Basic|Digest|Token|OAuth|Negotiate|ApiKey)\s+[A-Za-z0-9._~+\/=-]+/i', '$1 '.self::FILTERED, $value) ?? $value;
    }

    private function scrubValue(mixed $value, int $depth): mixed
    {
        if (is_array($value)) {
            return $this->scrubArray($value, $depth);
        }

        if (is_string($value)) {
            return $this->scrubString($value);
        }

        return $value;
    }

    private function isSensitiveKey(string $key): bool
    {
        $normalizedKey = strtolower(str_replace(['-', ' ', '.'], '_', $key));

        return in_array($normalizedKey, self::SENSITIVE_KEYS, true)
            || str_ends_with($normalizedKey, '_token')
            || str_ends_with($normalizedKey, '_secret')
            || str_ends_with($normalizedKey, '_password');
    }
}
