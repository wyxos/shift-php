<?php

namespace Wyxos\Shift\Http\Controllers;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\Notification as NotificationMessage;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Wyxos\Shift\Models\NotificationDelivery;
use Wyxos\Shift\TaskCollaboratorAdded;
use Wyxos\Shift\TaskCreated;
use Wyxos\Shift\TasksAwaitingFeedback;
use Wyxos\Shift\TaskThreadUpdated;

class ShiftNotificationController extends Controller
{
    private const SIGNATURE_HEADER = 'X-Shift-Signature';

    private const TIMESTAMP_HEADER = 'X-Shift-Timestamp';

    private const MAX_SIGNATURE_AGE_SECONDS = 300;

    private const HANDLERS = [
        'thread.update' => TaskThreadUpdated::class,
        'task.created' => TaskCreated::class,
        'task.collaborator_added' => TaskCollaboratorAdded::class,
        'tasks.awaiting_feedback' => TasksAwaitingFeedback::class,
    ];

    public function store(Request $request): JsonResponse
    {
        $projectToken = trim((string) config('shift.project', ''));

        if ($projectToken === '') {
            return response()->json([
                'message' => 'SHIFT project token is not configured',
            ], 500);
        }

        if (! $this->hasValidSignature($request, $projectToken)) {
            return response()->json([
                'message' => 'Invalid notification signature',
            ], 401);
        }

        $attributes = $request->validate([
            'delivery_id' => ['nullable', 'uuid'],
            'handler' => ['required', 'string'],
            'payload' => ['required', 'array'],
            'source' => ['required', 'array'],
        ]);

        $response = $this->deliver($request, $attributes);
        $this->logResult($attributes, $response);

        return $response;
    }

    private function deliver(Request $request, array $attributes): JsonResponse
    {
        $handler = $attributes['handler'];
        $payload = $attributes['payload'];
        $notification = $this->notificationFor($handler, $payload);

        if (! $notification) {
            return response()->json([
                'production' => app()->isProduction(),
                'message' => 'Unhandled notification type',
                'handler' => $handler,
            ], 422);
        }

        $user = User::find($payload['user_id'] ?? null);

        if (! $user) {
            return response()->json([
                'production' => app()->isProduction(),
                'message' => 'Notification recipient was not found',
            ], 404);
        }

        $deliveryId = $attributes['delivery_id'] ?? null;

        if (! $deliveryId) {
            $user->notify($notification);

            return $this->successResponse();
        }

        return $this->processDelivery(
            request: $request,
            deliveryId: $deliveryId,
            handler: $handler,
            user: $user,
            notification: $notification,
        );
    }

    private function processDelivery(
        Request $request,
        string $deliveryId,
        string $handler,
        User $user,
        NotificationMessage $notification,
    ): JsonResponse {
        $bodyHash = hash('sha256', $request->getContent());

        try {
            return DB::transaction(function () use ($deliveryId, $handler, $bodyHash, $user, $notification): JsonResponse {
                $delivery = NotificationDelivery::query()->create([
                    'delivery_id' => $deliveryId,
                    'handler' => $handler,
                    'body_hash' => $bodyHash,
                    'production' => app()->isProduction(),
                ]);

                $user->notify($notification);

                $delivery->forceFill(['processed_at' => now()])->save();

                return $this->successResponse($deliveryId);
            });
        } catch (UniqueConstraintViolationException) {
            $delivery = NotificationDelivery::query()
                ->where('delivery_id', $deliveryId)
                ->first();

            if (! $delivery || ! hash_equals($delivery->body_hash, $bodyHash)) {
                return response()->json([
                    'production' => app()->isProduction(),
                    'message' => 'Delivery ID was already used for a different notification',
                    'delivery_id' => $deliveryId,
                ], 409);
            }

            if (! $delivery->processed_at) {
                return response()->json([
                    'production' => app()->isProduction(),
                    'message' => 'Notification delivery is still being processed',
                    'delivery_id' => $deliveryId,
                ], 503);
            }

            return $this->successResponse($deliveryId, duplicate: true);
        }
    }

    private function notificationFor(string $handler, array $payload): ?NotificationMessage
    {
        $notificationClass = self::HANDLERS[$handler] ?? null;

        return $notificationClass === null ? null : new $notificationClass($payload);
    }

    private function logResult(array $attributes, JsonResponse $response): void
    {
        $status = $response->getStatusCode();
        $outcome = match ($status) {
            200 => ($response->getData(true)['duplicate'] ?? false) ? 'duplicate' : 'delivered',
            404 => 'recipient_missing',
            409 => 'conflict',
            422 => 'rejected',
            503 => 'pending',
            default => 'failed',
        };
        $payload = $attributes['payload'];

        Log::info('SHIFT notification processed', [
            'delivery_id' => $attributes['delivery_id'] ?? null,
            'handler' => isset(self::HANDLERS[$attributes['handler']]) ? $attributes['handler'] : null,
            'user_id' => $this->numericId($payload['user_id'] ?? null),
            'task_id' => $this->numericId($payload['task_id'] ?? null),
            'thread_id' => $this->numericId($payload['thread_id'] ?? null),
            'outcome' => $outcome,
            'status' => $status,
        ]);
    }

    private function numericId(mixed $value): ?int
    {
        if (! is_int($value) && (! is_string($value) || preg_match('/\A[1-9][0-9]{0,18}\z/D', $value) !== 1)) {
            return null;
        }

        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return is_int($id) ? $id : null;
    }

    private function successResponse(?string $deliveryId = null, bool $duplicate = false): JsonResponse
    {
        return response()->json([
            'production' => app()->isProduction(),
            'message' => 'Notification processed successfully',
            ...($deliveryId ? [
                'delivery_id' => $deliveryId,
                'duplicate' => $duplicate,
            ] : []),
        ]);
    }

    private function hasValidSignature(Request $request, string $projectToken): bool
    {
        $timestamp = (string) $request->header(self::TIMESTAMP_HEADER, '');
        $signature = (string) $request->header(self::SIGNATURE_HEADER, '');

        if ($timestamp === '' || $signature === '' || ! ctype_digit($timestamp)) {
            return false;
        }

        if (abs(time() - (int) $timestamp) > self::MAX_SIGNATURE_AGE_SECONDS) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$request->getContent(), $projectToken);

        return hash_equals($expected, $signature);
    }
}
