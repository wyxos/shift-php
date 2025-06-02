<?php

namespace Wyxos\Shift\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
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

        // Log the incoming notification
        Log::info('Received notification from SHIFT', [
            'handler' => $handler,
            'payload' => $payload,
            'source' => $source,
        ]);

        // Handle different notification types
        switch ($handler) {
            case 'thread.update':
                return $this->handleThreadUpdate($payload);
            default:
                return response()->json([
                    'production' => app()->isProduction(),
                    'message' => 'Unhandled notification type',
                    'handler' => $handler,
                ], 422);
        }
    }

    /**
     * Handle thread update notifications.
     *
     * @param array $payload
     * @return JsonResponse
     */
    protected function handleThreadUpdate(array $payload)
    {
        $user = User::find($payload['user_id']);

        $user->notify(new TaskThreadUpdated($payload));

        return response()->json([
            'production' => app()->isProduction(),
            'message' => 'Notification processed successfully',
        ]);
    }
}
