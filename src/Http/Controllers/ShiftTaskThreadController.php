<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class ShiftTaskThreadController extends Controller
{
    /**
     * Display a listing of the threads for a task.
     *
     * @param int $taskId
     * @return \Illuminate\Http\JsonResponse
     */
    public function index($taskId)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            $url = $baseUrl . '/api/tasks/' . $taskId . '/threads';

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->withHeaders([
                    'X-User-Name' => auth()->user()->name,
                    'X-User-Email' => auth()->user()->email,
                    'X-User-Id' => auth()->user()->id,
                    'X-Environment' => config('app.env'),
                    'X-App-Url' => config('app.url'),
                ])
                ->get($url, [
                    'project' => $project
                ]);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch threads'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch threads: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created thread in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @param int $taskId
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request, $taskId)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');

        try {
            // Check if we have a temporary identifier for attachments
            $hasTempIdentifier = $request->has('temp_identifier') && !empty($request->input('temp_identifier'));

            // Create the payload
            $payload = [
                'content' => $request->input('content'),
                'type' => 'external', // Always use external for SDK
                'project' => $project,
                'user' => [
                    'name' => auth()->user()->name,
                    'email' => auth()->user()->email,
                    'id' => auth()->user()->id,
                    'environment' => config('app.env'),
                    'url' => config('app.url'),
                ],
                'metadata' => [
                    'url' => config('app.url'),
                    'environment' => config('app.env'),
                ],
            ];

            // Add temp_identifier if available
            if ($hasTempIdentifier) {
                $payload['temp_identifier'] = $request->input('temp_identifier');
            }

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->post($baseUrl . '/api/tasks/' . $taskId . '/threads', $payload);

            if ($response->successful()) {
                return response()->json($response->json(), 201);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to create thread'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to create thread: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified thread.
     *
     * @param int $taskId
     * @param int $threadId
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($taskId, $threadId)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');

        try {
            $url = $baseUrl . '/api/tasks/' . $taskId . '/threads/' . $threadId;

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->withHeaders([
                    'X-User-Name' => auth()->user()->name,
                    'X-User-Email' => auth()->user()->email,
                    'X-User-Id' => auth()->user()->id,
                    'X-Environment' => config('app.env'),
                    'X-App-Url' => config('app.url'),
                ])
                ->get($url, [
                    'project' => $project
                ]);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch thread'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch thread: ' . $e->getMessage()], 500);
        }
    }
}
