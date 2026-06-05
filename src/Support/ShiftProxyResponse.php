<?php

namespace Wyxos\Shift\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;

class ShiftProxyResponse
{
    public static function error(Response $response, string $fallback, int $fallbackStatus = 500): JsonResponse
    {
        $status = $response->status();

        if ($status < 400) {
            $status = $fallbackStatus;
        }

        return response()->json([
            'error' => $response->json('error') ?? $response->json('message') ?? $fallback,
        ], $status);
    }
}
