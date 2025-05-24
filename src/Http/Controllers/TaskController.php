<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class TaskController extends Controller
{
    /**
     * Display a listing of the tasks.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            $url = $baseUrl . '/api/tasks';

            $project = config('shift.project');

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->get($url, [
                    'project' => $project
                ]);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch tasks'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch tasks: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created task in storage.
     *
     * @param  \Illuminate\Http\Request  $request
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
        try {
            $payload = [
                ...$request->all(),
                'external_user' => [
                    'name' => auth()->user()->name,
                    'email' => auth()->user()->email,
                    'id' => auth()->user()->id,
                ],
                'project' => config('shift.project'),
            ];

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->post($baseUrl . '/api/tasks', $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to create task'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to create task: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update the specified task in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        try {
            // Prepare the payload with the request data
            $payload = $request->all();

            $payload = [
                ...$payload,
                'external' => [
                    'name' => auth()->user()->name,
                    'email' => auth()->user()->email,
                    'id' => auth()->user()->id,
                ],
            ];

            $response = Http::withToken($token)
                ->acceptJson()
                ->put($baseUrl . '/api/tasks/' . $id, $payload);

            if ($response->successful()) {
                return response()->json(['message' => 'Task updated successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to update task'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to update task: ' . $e->getMessage()], 500);
        }
    }

    public function show(int $id)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        try {
            // Prepare query parameters
            $params = [];

            $response = Http::withToken($token)
                ->acceptJson()
                ->get($baseUrl . '/api/tasks/' . $id, $params);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch task'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch task: ' . $e->getMessage()], 500);
        }
    }
}
