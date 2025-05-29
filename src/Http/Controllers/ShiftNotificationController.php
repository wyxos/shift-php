<?php

namespace Wyxos\Shift\Http\Controllers;

use App\Models\User;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Wyxos\Shift\TaskThreadUpdated;

class ShiftNotificationController extends Controller
{
    public function store()
    {
        $request = request();

        $user = User::find($request->input('payload.user_id'));

        $user->notify(new TaskThreadUpdated($request->input('payload')));

        return response()->json([
            'message' => $user,
        ]);

        $request->validate([
            'handler' => 'required|string',
            'payload' => 'required|array',
            'source' => 'required|array',
        ]);

        $handler = $request->input('handler');
        $payload = $request->input('payload');
        $source = $request->input('source');

        // Log the incoming notification
        \Illuminate\Support\Facades\Log::info('Received notification from SHIFT', [
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
                    'message' => 'Unhandled notification type',
                    'handler' => $handler,
                ], 422);
        }
    }

    /**
     * Handle thread update notifications.
     *
     * @param array $payload
     * @return \Illuminate\Http\JsonResponse
     */
    protected function handleThreadUpdate(array $payload)
    {
       return response()->json([
           'user' => User::find($payload['user_id']),
       ]);
    }
}
