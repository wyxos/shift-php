<?php

namespace Wyxos\Shift\Support;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;
use WeakMap;

class ShiftErrorReporter
{
    private const SOURCE_CONTEXT_RADIUS = 10;

    private bool $sending = false;

    private ?WeakMap $reported = null;

    public function __construct(
        private readonly ShiftActorContext $context,
        private readonly ShiftErrorScrubber $scrubber,
        private readonly ShiftReleaseMetadata $releaseMetadata,
    ) {}

    public function reportThrowable(Throwable $exception): bool
    {
        return $this->reportThrowableWithResult($exception) !== null;
    }

    /**
     * @return array{id: ?int}|null
     */
    public function reportThrowableWithResult(Throwable $exception): ?array
    {
        if (app()->bound('request') && request()->routeIs('shift.errors.store')) {
            return null;
        }

        if ($this->isSdkException($exception) && $this->expected($exception)) {
            return null;
        }

        return $this->attempt($exception, fn (): array => $this->throwablePayload($exception));
    }

    public function reportSdkThrowable(Throwable $exception, string $operation): bool
    {
        if ($this->expected($exception)) {
            return false;
        }

        return $this->attempt($exception, fn (): array => $this->throwablePayload($exception, $operation)) !== null;
    }

    /** @return array<string, mixed> */
    private function throwablePayload(Throwable $exception, ?string $operation = null): array
    {
        $sdk = $operation !== null || $this->isSdkException($exception);

        return [
            'source' => 'backend',
            'exception' => [
                'class' => $exception::class,
                'message' => $this->scrubber->scrubString($exception->getMessage()),
            ],
            'message' => $this->scrubber->scrubString($exception->getMessage()),
            'stacktrace' => [
                'frames' => $this->exceptionFrames($exception, ! $sdk, $sdk),
            ],
            'context' => [
                'request' => $sdk ? $this->sdkRequestContext() : $this->requestContext(),
                'correlation_id' => request()->attributes->get('shift.error_correlation_id'),
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
            ],
            'metadata' => [...$this->metadata(), ...($sdk ? $this->sdkMetadata('sdk_backend', $operation) : [])],
            'user' => $this->userPayload(),
            'occurred_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{id: ?int}|null
     */
    private function send(array $payload): ?array
    {
        $payload = $this->scrubber->scrubArray([
            'project' => (string) config('shift.project'),
            'environment' => config('app.env'),
            'url' => config('app.url'),
            'release' => $this->releaseMetadata->release(),
            'git_sha' => $this->releaseMetadata->revision(),
            ...$payload,
        ]);

        $response = $this->context
            ->client()
            ->connectTimeout(min(2, max(1, (int) config('shift.errors.timeout', 3))))
            ->timeout(max(1, (int) config('shift.errors.timeout', 3)))
            ->post($this->endpoint(), $payload);

        if (! $response->successful()) {
            $this->logFailure('http_'.$response->status(), $payload);

            return null;
        }

        $taskId = $response->json('task.id');

        return ['id' => is_int($taskId) && $taskId > 0 ? $taskId : null];
    }

    /** @return array{id: ?int}|null */
    private function attempt(?Throwable $exception, callable $payload): ?array
    {
        if ($this->sending || ! $this->configured()) {
            return null;
        }

        $this->reported ??= new WeakMap;
        if ($exception !== null && isset($this->reported[$exception])) {
            return $this->reported[$exception]['result'];
        }

        $this->sending = true;
        $result = null;
        $diagnostic = [];
        try {
            $diagnostic = $payload();
            if ($this->allowed($diagnostic)) {
                $result = $this->send($diagnostic);
            }
            if ($result !== null && request()->attributes->get('shift.error_correlation_id')) {
                request()->attributes->set('shift.error_reported', true);
            }
        } catch (Throwable $failure) {
            $this->logFailure($failure::class, $diagnostic);
        } finally {
            if ($exception !== null) {
                $this->reported[$exception] = ['result' => $result];
            }
            $this->sending = false;
        }

        return $result;
    }

    private function allowed(array $diagnostic): bool
    {
        if (data_get($diagnostic, 'metadata.component') !== 'shift_sdk') {
            return true;
        }

        try {
            $key = 'shift-sdk-errors:'.hash('sha256', json_encode([
                config('shift.project'), config('app.url'), config('app.env'),
                $diagnostic['source'], data_get($diagnostic, 'metadata.operation'),
                data_get($diagnostic, 'exception.class') ?? data_get($diagnostic, 'error.name'),
                data_get($diagnostic, 'stacktrace.frames.0.file'), data_get($diagnostic, 'stacktrace.frames.0.line'),
            ], JSON_THROW_ON_ERROR));
            if (RateLimiter::tooManyAttempts($key, 20)) {
                return false;
            }
            RateLimiter::hit($key, 60);
        } catch (Throwable) {
            // A failed cache must not prevent reporting the original SDK failure.
        }

        return true;
    }

    public function reportUiError(array $attributes): bool
    {
        $ui = new ShiftUiError;
        $stack = $ui->clean($attributes['stack'] ?? '');
        $attributes['error']['message'] = $ui->clean($attributes['error']['message']);

        return $this->attempt(null, fn (): array => [
            'source' => 'ui',
            'error' => $attributes['error'],
            'stack' => $stack,
            'stacktrace' => ['frames' => $ui->frames($stack)],
            'context' => [
                ...($attributes['context'] ?? []),
                'correlation_id' => request()->attributes->get('shift.error_correlation_id'),
                'request' => [
                    'method' => 'GET',
                    'url' => rtrim((string) config('app.url'), '/').($attributes['context']['route'] ?? '/shift'),
                    'path' => $attributes['context']['route'] ?? '/shift',
                ],
            ],
            'metadata' => [...$this->metadata(), ...$this->sdkMetadata('workspace_ui', $attributes['context']['operation'] ?? null)],
            'user' => $this->userPayload(),
            'occurred_at' => now()->toIso8601String(),
        ]) !== null;
    }

    /** @return array<string, mixed> */
    private function sdkMetadata(string $surface, ?string $operation): array
    {
        $version = null;
        if (class_exists(\Composer\InstalledVersions::class) && \Composer\InstalledVersions::isInstalled('wyxos/shift-php')) {
            $version = \Composer\InstalledVersions::getPrettyVersion('wyxos/shift-php');
        }

        return [
            'component' => 'shift_sdk',
            'surface' => $surface,
            'sdk_version' => $version,
            'operation' => $operation,
            'correlation_id' => request()->attributes->get('shift.error_correlation_id'),
        ];
    }

    private function isSdkException(Throwable $exception): bool
    {
        foreach ([$exception->getFile(), ...array_column($exception->getTrace(), 'file')] as $file) {
            if ($this->isSdkFile($file)) {
                return true;
            }
        }

        return false;
    }

    private function isSdkFile(string $file): bool
    {
        return str_starts_with(str_replace('\\', '/', $file), str_replace('\\', '/', dirname(__DIR__)).'/');
    }

    private function logFailure(string $reason, array $payload = []): void
    {
        try {
            Log::warning('SHIFT error report could not be delivered.', [
                'reason' => $reason,
                'exception' => data_get($payload, 'exception.class') ?? data_get($payload, 'error.name'),
                'operation' => data_get($payload, 'metadata.operation'),
                'correlation_id' => request()->attributes->get('shift.error_correlation_id'),
            ]);
        } catch (Throwable) {
        }
    }

    private function expected(Throwable $exception): bool
    {
        return $exception instanceof \Illuminate\Validation\ValidationException
            || $exception instanceof \Illuminate\Auth\AuthenticationException
            || $exception instanceof \Illuminate\Auth\Access\AuthorizationException
            || $exception instanceof \Illuminate\Database\Eloquent\ModelNotFoundException
            || ($exception instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface && $exception->getStatusCode() < 500)
            || ($exception instanceof \RuntimeException && $exception->getCode() >= 400 && $exception->getCode() < 500);
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
    private function exceptionFrames(Throwable $exception, bool $includeSource = true, bool $sdk = false): array
    {
        $frames = [[
            'file' => $this->normalizeFile($exception->getFile()),
            'line' => $exception->getLine(),
            'function' => null,
            'in_app' => $sdk ? $this->isSdkFile($exception->getFile()) : $this->isInApp($exception->getFile()),
            'context' => $includeSource ? $this->sourceContext($exception->getFile(), $exception->getLine()) : null,
        ]];

        foreach (array_slice($exception->getTrace(), 0, 99) as $frame) {
            $file = is_string($frame['file'] ?? null) ? $frame['file'] : null;
            $line = isset($frame['line']) ? (int) $frame['line'] : null;

            $frames[] = [
                'file' => $file !== null ? $this->normalizeFile($file) : null,
                'line' => $line,
                'function' => is_string($frame['function'] ?? null) ? $frame['function'] : null,
                'in_app' => $file !== null && ($sdk ? $this->isSdkFile($file) : $this->isInApp($file)),
                'context' => $includeSource && $file !== null && $line !== null ? $this->sourceContext($file, $line) : null,
            ];
        }

        return $this->scrubber->scrubArray($frames);
    }

    /**
     * @return array<string, mixed>
     */
    private function sdkRequestContext(): array
    {
        return [
            'method' => request()->method(),
            'url' => request()->url(),
            'path' => request()->path(),
        ];
    }

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
        try {
            $user = auth()->user();
        } catch (Throwable) {
            $user = null;
        }

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
