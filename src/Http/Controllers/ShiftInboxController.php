<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Wyxos\Shift\Support\ShiftActorContext;
use Wyxos\Shift\Support\ShiftProxyLogger;
use Wyxos\Shift\Support\ShiftProxyResponse;

class ShiftInboxController extends Controller
{
    public function index(Request $request, ShiftActorContext $context): JsonResponse
    {
        if ($error = $this->guard($context)) {
            return $error;
        }

        $pagination = $request->validate([
            'page' => 'sometimes|integer|min:1|max:10000',
            'per_page' => 'sometimes|integer|min:1|max:100',
        ]);

        try {
            $response = $context->client()->get($context->baseUrl().'/api/inbox', [
                ...$context->basePayload(),
                ...$pagination,
            ]);

            return $response->successful()
                ? response()->json($response->json(), $response->status())
                : ShiftProxyResponse::error($response, 'Failed to fetch notifications');
        } catch (\Throwable $exception) {
            ShiftProxyLogger::exception('inbox.index', $exception);

            return response()->json(['error' => 'Failed to fetch notifications'], 500);
        }
    }

    public function read(string $notification, ShiftActorContext $context): JsonResponse
    {
        if ($error = $this->guard($context)) {
            return $error;
        }

        if (preg_match('/^[1-9][0-9]*$/D', $notification) !== 1) {
            return response()->json(['error' => 'Notification not found'], 404);
        }

        return $this->markRead($context, '/api/inbox/'.$notification.'/read', 'inbox.read');
    }

    public function readAll(ShiftActorContext $context): JsonResponse
    {
        if ($error = $this->guard($context)) {
            return $error;
        }

        return $this->markRead($context, '/api/inbox/read-all', 'inbox.read-all');
    }

    private function markRead(ShiftActorContext $context, string $path, string $operation): JsonResponse
    {
        try {
            $response = $context->client()->patch($context->baseUrl().$path, $context->basePayload());

            return $response->successful()
                ? response()->json($response->json(), $response->status())
                : ShiftProxyResponse::error($response, 'Failed to mark notifications read');
        } catch (\Throwable $exception) {
            ShiftProxyLogger::exception($operation, $exception);

            return response()->json(['error' => 'Failed to mark notifications read'], 500);
        }
    }

    private function guard(ShiftActorContext $context): ?JsonResponse
    {
        if ($error = $context->configurationErrorResponse()) {
            return $error;
        }

        if (! auth()->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        return null;
    }
}
