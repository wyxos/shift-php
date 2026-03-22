<?php

namespace Wyxos\Shift\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Wyxos\Shift\TaskCollaboratorAdded;
use Wyxos\Shift\TaskCreated;
use Wyxos\Shift\TasksAwaitingFeedback;
use Wyxos\Shift\TaskThreadUpdated;

class ShiftNotificationController extends Controller
{
    private const SIGNATURE_HEADER = 'X-Shift-Signature';

    private const TIMESTAMP_HEADER = 'X-Shift-Timestamp';

    private const MAX_SIGNATURE_AGE_SECONDS = 300;

    public function store(Request $request)
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

        $request->validate([
            'handler' => 'required|string',
            'payload' => 'required|array',
            'source' => 'required|array',
        ]);

        $handler = $request->input('handler');
        $payload = $request->input('payload');
        $source = $request->input('source');

        Log::info('Received notification from SHIFT', [
            'handler' => $handler,
            'payload' => $payload,
            'source' => $source,
        ]);

        switch ($handler) {
            case 'thread.update':
                return $this->handleThreadUpdate($payload);
            case 'task.created':
                return $this->handleTaskCreated($payload);
            case 'task.collaborator_added':
                return $this->handleTaskCollaboratorAdded($payload);
            case 'tasks.awaiting_feedback':
                return $this->handleTasksAwaitingFeedback($payload);
            default:
                return response()->json([
                    'production' => app()->isProduction(),
                    'message' => 'Unhandled notification type',
                    'handler' => $handler,
                ], 422);
        }
    }

    protected function handleThreadUpdate(array $payload)
    {
        $user = User::find($payload['user_id']);

        $user->notify(new TaskThreadUpdated($payload));

        return response()->json([
            'production' => app()->isProduction(),
            'message' => 'Notification processed successfully',
        ]);
    }

    protected function handleTaskCreated(array $payload)
    {
        $user = User::find($payload['user_id']);

        $user->notify(new TaskCreated($payload));

        return response()->json([
            'production' => app()->isProduction(),
            'message' => 'Notification processed successfully',
        ]);
    }

    protected function handleTaskCollaboratorAdded(array $payload): JsonResponse
    {
        $user = User::find($payload['user_id']);

        $user->notify(new TaskCollaboratorAdded($payload));

        return response()->json([
            'production' => app()->isProduction(),
            'message' => 'Notification processed successfully',
        ]);
    }

    protected function handleTasksAwaitingFeedback(array $payload)
    {
        $user = User::find($payload['user_id']);

        $user->notify(new TasksAwaitingFeedback($payload));

        return response()->json([
            'production' => app()->isProduction(),
            'message' => 'Notification processed successfully',
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
