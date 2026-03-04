<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Throwable;

class ShiftAiController extends Controller
{
    public function improve(Request $request)
    {
        if (! config('shift.ai.enabled', false)) {
            return response()->json([
                'error' => 'AI improvement is disabled.',
            ], 404);
        }

        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json([
                'error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env',
            ], 500);
        }

        $baseUrl = config('shift.url');
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $payload = [
                'project' => $project,
                'html' => (string) $request->input('html', ''),
                'protected_tokens' => $request->input('protected_tokens', []),
                'context' => $request->input('context'),
                'user' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'id' => $user->id,
                    'environment' => config('app.env'),
                    'url' => config('app.url'),
                ],
                'metadata' => [
                    'url' => config('app.url'),
                    'environment' => config('app.env'),
                ],
            ];

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->post($baseUrl.'/api/ai/improve', $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            $status = $response->status() >= 400 ? $response->status() : 422;

            return response()->json([
                'error' => $response->json()['error'] ?? $response->json()['message'] ?? 'Failed to improve message',
            ], $status);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to improve message: '.$e->getMessage()], 500);
        }
    }
}
