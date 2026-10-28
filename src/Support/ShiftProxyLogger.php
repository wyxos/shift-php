<?php

namespace Wyxos\Shift\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

class ShiftProxyLogger
{
    public static function upstream(string $operation, int $status): void
    {
        $level = $status >= 500 || $status === 0 ? 'error' : 'warning';

        Log::log($level, 'SHIFT upstream request failed', [
            'operation' => $operation,
            'status' => $status,
            'outcome' => 'upstream_failed',
        ]);
    }

    public static function exception(string $operation, Throwable $exception, ?string $traceId = null): void
    {
        Log::error('SHIFT proxy request failed', [
            'operation' => $operation,
            'exception' => $exception::class,
            ...($traceId !== null ? ['trace_id' => $traceId] : []),
            'outcome' => 'exception',
        ]);
    }

    public static function recursiveConfiguration(string $traceId): void
    {
        Log::error('SHIFT proxy configuration failed', [
            'operation' => 'attachments.configuration',
            'trace_id' => $traceId,
            'outcome' => 'recursive_url',
        ]);
    }
}
