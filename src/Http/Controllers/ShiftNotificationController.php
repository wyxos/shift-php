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
        if(!app()->isProduction()){
            // return response to inform that notification should be managed by main SHIFT app.
            return response()->json([
                'handled_by' => 'main_app',
                'message' => 'Notification skipped in SDK, main SHIFT app should handle this.',
            ], 200);
        }

        $request = request();

        $user = User::find($request->input('payload.user_id'));

        $user->notify(new TaskThreadUpdated($request->input('payload')));

        return response()->json([
            'message' => 'Notification processed successfully',
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
