<?php

namespace Wyxos\Shift\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Wyxos\Shift\TaskCollaboratorAdded;
use Wyxos\Shift\TaskCreated;
use Wyxos\Shift\TasksAwaitingFeedback;
use Wyxos\Shift\TaskThreadUpdated;

class ShiftNotificationController extends Controller
{
    public function store()
    {
        $request = request();

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
}
