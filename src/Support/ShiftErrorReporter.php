<?php

namespace Wyxos\Shift\Support;

use Illuminate\Contracts\Auth\Authenticatable;
use Throwable;

class ShiftErrorReporter
{
    private const SOURCE_CONTEXT_RADIUS = 10;

    public function __construct(
        private readonly ShiftActorContext $context,
        private readonly ShiftErrorScrubber $scrubber,
        private readonly ShiftReleaseMetadata $releaseMetadata,
    ) {}

    public function reportThrowable(Throwable $exception): bool
    {
        if (! $this->configured()) {
            return false;
        }

        return $this->send([
            'source' => 'backend',
            'exception' => [
                'class' => $exception::class,
                'message' => $this->scrubber->scrubString($exception->getMessage()),
            ],
            'message' => $this->scrubber->scrubString($exception->getMessage()),
            'stacktrace' => [
                'frames' => $this->exceptionFrames($exception),
            ],
            'context' => [
                'request' => $this->requestContext(),
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
            ],
            'metadata' => $this->metadata(),
            'user' => $this->userPayload(),
            'occurred_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function send(array $payload): bool
    {
        $payload = $this->scrubber->scrubArray([
            'project' => (string) config('shift.project'),
            'environment' => config('app.env'),
            'url' => config('app.url'),
            'release' => $this->releaseMetadata->release(),
            'git_sha' => $this->releaseMetadata->revision(),
            ...$payload,
        ]);

        try {
            $response = $this->context
                ->client()
                ->timeout((int) config('shift.errors.timeout', 3))
                ->post($this->endpoint(), $payload);
        } catch (Throwable) {
            return false;
        }

        return $response->successful();
    }

    private function configured(): bool
    {
        return (bool) config('shift.errors.enabled', true)
            && filled(config('shift.token'))
            && filled(config('shift.project'))
            && filled(config('shift.url'));
    }

    private function endpoint(): string
    {
        $path = trim((string) config('shift.errors.endpoint', '/api/errors'), '/');

        return $this->context->baseUrl().'/'.$path;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function exceptionFrames(Throwable $exception): array
    {
        $frames = [[
            'file' => $this->normalizeFile($exception->getFile()),
            'line' => $exception->getLine(),
            'function' => null,
            'in_app' => $this->isInApp($exception->getFile()),
            'context' => $this->sourceContext($exception->getFile(), $exception->getLine()),
        ]];

        foreach (array_slice($exception->getTrace(), 0, 99) as $frame) {
            $file = is_string($frame['file'] ?? null) ? $frame['file'] : null;
            $line = isset($frame['line']) ? (int) $frame['line'] : null;

            $frames[] = [
                'file' => $file !== null ? $this->normalizeFile($file) : null,
                'line' => $line,
                'function' => is_string($frame['function'] ?? null) ? $frame['function'] : null,
                'in_app' => $file !== null && $this->isInApp($file),
                'context' => $file !== null && $line !== null ? $this->sourceContext($file, $line) : null,
            ];
        }

        return $this->scrubber->scrubArray($frames);
    }

    /**
     * @return array<string, mixed>
     */
    private function requestContext(): array
    {
        if (! app()->bound('request')) {
            return [];
        }

        $request = request();

        return $this->scrubber->scrubArray([
            'method' => $request->method(),
            'url' => $request->fullUrl(),
            'path' => $request->path(),
            'referrer' => $request->headers->get('referer'),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'query' => $request->query->all(),
            'body' => $request->except(array_keys($request->files->all())),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function metadata(): array
    {
        return [
            'environment' => config('app.env'),
            'url' => config('app.url'),
            'app_name' => config('app.name'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(): array
    {
        $user = auth()->user();

        if (! $user instanceof Authenticatable) {
            return [
                'environment' => config('app.env'),
                'url' => config('app.url'),
            ];
        }

        return $this->context->userPayload($user);
    }

    private function isInApp(string $file): bool
    {
        return str_starts_with($file, base_path());
    }

    private function normalizeFile(string $file): string
    {
        $normalized = str_replace('\\', '/', $file);
        $basePath = str_replace('\\', '/', base_path());

        if (str_starts_with($normalized, $basePath.'/')) {
            return ltrim(substr($normalized, strlen($basePath) + 1), '/');
        }

        return ltrim($normalized, '/');
    }

    /**
     * @return array{start_line: int, lines: array<int, array{number: int, text: string, active: bool}>}|null
     */
    private function sourceContext(string $file, int $line): ?array
    {
        if ($line <= 0) {
            return null;
        }

        $realFile = realpath($file);
        $basePath = realpath(base_path());

        if (! is_string($realFile) || ! is_string($basePath) || ! is_file($realFile) || ! is_readable($realFile)) {
            return null;
        }

        $normalizedFile = str_replace('\\', '/', $realFile);
        $normalizedBase = rtrim(str_replace('\\', '/', $basePath), '/').'/';

        if (! str_starts_with($normalizedFile, $normalizedBase)) {
            return null;
        }

        $startLine = max(1, $line - self::SOURCE_CONTEXT_RADIUS);
        $endLine = $line + self::SOURCE_CONTEXT_RADIUS;
        $handle = fopen($realFile, 'r');

        if ($handle === false) {
            return null;
        }

        $lines = [];
        $currentLine = 0;

        try {
            while (($contents = fgets($handle)) !== false) {
                $currentLine++;

                if ($currentLine < $startLine) {
                    continue;
                }

                if ($currentLine > $endLine) {
                    break;
                }

                $lines[] = [
                    'number' => $currentLine,
                    'text' => $this->scrubber->scrubString(rtrim($contents, "\r\n")) ?? '',
                    'active' => $currentLine === $line,
                ];
            }
        } finally {
            fclose($handle);
        }

        if ($lines === []) {
            return null;
        }

        return [
            'start_line' => $startLine,
            'lines' => $lines,
        ];
    }
}
