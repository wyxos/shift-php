<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class ShiftTaskController extends Controller
{
    /**
     * Display a listing of the tasks.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $url = $baseUrl.'/api/tasks';

            $project = config('shift.project');

            $params = [
                'project' => $project,
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

            // Add status filter if provided
            if ($request->has('status')) {
                $params['status'] = $request->status;
            }

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->get($url, $params);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch tasks'], 500);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch tasks: '.$e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created task in storage.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }
        try {
            // Regular JSON request with temp_identifier for attachments
            $payload = [
                ...$request->except('status'),
                'status' => 'pending',
                'project' => $project,
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
                ->post($baseUrl.'/api/tasks', $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to create task'], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to create task: '.$e->getMessage()], 500);
        }
    }

    /**
     * Update the specified task in storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $token = config('shift.token');
        $project = config('shift.project');

        if (empty($token) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            // Regular JSON request with temp_identifier for attachments
            $payload = [
                ...$request->all(),
                'project' => $project,
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

            $response = Http::withToken($token)
                ->acceptJson()
                ->put($baseUrl.'/api/tasks/'.$id, $payload);

            if ($response->successful()) {
                return response()->json(['message' => 'Task updated successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to update task'], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to update task: '.$e->getMessage()], 500);
        }
    }

    public function show(int $id)
    {
        $token = config('shift.token');
        $project = config('shift.project');

        if (empty($token) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }
        try {
            // Prepare query parameters - only include simple parameters in the query
            $params = [
                'project' => $project,
                'user' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'id' => $user->id,
                    'environment' => config('app.env'),
                    'url' => config('app.url'),
                ],
            ];

            // Add user and metadata information to headers instead of query params
            $response = Http::withToken($token)
                ->acceptJson()
                ->get($baseUrl.'/api/tasks/'.$id, $params);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch task'], 500);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch task: '.$e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified task from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        $token = config('shift.token');
        $project = config('shift.project');

        if (empty($token) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->delete($baseUrl.'/api/tasks/'.$id, [
                    'project' => $project,
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
                ]);

            if ($response->successful()) {
                return response()->json(['message' => 'Task deleted successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to delete task'], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to delete task: '.$e->getMessage()], 500);
        }
    }
}
