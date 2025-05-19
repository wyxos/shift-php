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
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $projectId = config('shift.project_id');

            $url = $baseUrl . '/api/projects/' . $projectId . '/tasks';


//            dd($token, $baseUrl, $projectId);
            $response = Http::withToken($token)
                ->acceptJson()
                ->get($url, [
                    'user_id' => auth()->id()
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
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            // Check if this is an external submission (has submitter_name)
            $isExternalSubmission = $request->has('submitter_name');

            $payload = [
                ...$request->all(),
                'project_id' => config('shift.project_id'),
            ];

            // For authenticated users in the SDK, we want to treat them as external submitters
            // unless they explicitly provided a submitter_name
            if (!$isExternalSubmission && auth()->check()) {
                // Include user info as both external submitter and regular user data
                // This ensures the Shift app recognizes it as an external submission
                $payload = array_merge($payload, [
                    'submitter_name' => auth()->user()->name,
                    'user_id' => auth()->id(),
                    'user_email' => auth()->user()->email,
                    'user_name' => auth()->user()->name,
                ]);
            }

            $response = Http::withToken($token)
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
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->put($baseUrl . '/api/tasks/' . $id, $request->all());

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
        $token = config('shift.api_token');
        $baseUrl = config('shift.url');
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->get($baseUrl . '/api/tasks/' . $id);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch task'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch task: ' . $e->getMessage()], 500);
        }
    }
}
