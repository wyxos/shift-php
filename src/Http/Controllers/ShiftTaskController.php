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
            // Check if we have file uploads
            $hasAttachments = $request->hasFile('attachments');

            if ($hasAttachments) {
                // Create a multipart request with files
                $multipartData = [
                    [
                        'name' => 'title',
                        'contents' => $request->input('title')
                    ],
                    [
                        'name' => 'description',
                        'contents' => $request->input('description') ?? ''
                    ],
                    [
                        'name' => 'status',
                        'contents' => 'pending'
                    ],
                    [
                        'name' => 'priority',
                        'contents' => $request->input('priority') ?? 'medium'
                    ],
                    [
                        'name' => 'project',
                        'contents' => $project
                    ],
                    [
                        'name' => 'user[name]',
                        'contents' => auth()->user()->name
                    ],
                    [
                        'name' => 'user[email]',
                        'contents' => auth()->user()->email
                    ],
                    [
                        'name' => 'user[id]',
                        'contents' => auth()->user()->id
                    ],
                    [
                        'name' => 'user[environment]',
                        'contents' => config('app.env')
                    ],
                    [
                        'name' => 'user[url]',
                        'contents' => config('app.url')
                    ],
                    [
                        'name' => 'metadata[url]',
                        'contents' => config('app.url')
                    ],
                    [
                        'name' => 'metadata[environment]',
                        'contents' => config('app.env')
                    ],
                ];

                // Add attachments to multipart data
                if ($request->hasFile('attachments')) {
                    $files = $request->file('attachments');
                    foreach ($files as $index => $file) {
                        $multipartData[] = [
                            'name' => "attachments[$index]",
                            'contents' => fopen($file->getPathname(), 'r'),
                            'filename' => $file->getClientOriginalName()
                        ];
                    }
                }

                $response = Http::withToken($apiToken)
                    ->acceptJson()
                    ->asMultipart()
                    ->post($baseUrl . '/api/tasks', $multipartData);
            } else {
                // Regular JSON request without files
                $payload = [
                    ...$request->except('status'),
                    'status' => 'pending',
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

                $response = Http::withToken($apiToken)
                    ->acceptJson()
                    ->post($baseUrl . '/api/tasks', $payload);
            }

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
        $token = config('shift.token');
        $project = config('shift.project');

        if (empty($token) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');

        try {
            // Check if we have file uploads or deleted attachments
            $hasAttachments = $request->hasFile('attachments');
            $hasDeletedAttachments = $request->has('deleted_attachment_ids') && is_array($request->input('deleted_attachment_ids'));

            if ($hasAttachments || $hasDeletedAttachments) {
                // Create a multipart request with files
                $multipartData = [
                    [
                        'name' => 'title',
                        'contents' => $request->input('title')
                    ],
                    [
                        'name' => 'description',
                        'contents' => $request->input('description') ?? ''
                    ],
                    [
                        'name' => 'status',
                        'contents' => $request->input('status') ?? 'pending'
                    ],
                    [
                        'name' => 'priority',
                        'contents' => $request->input('priority') ?? 'medium'
                    ],
                    [
                        'name' => 'project',
                        'contents' => $project
                    ],
                    [
                        'name' => 'user[name]',
                        'contents' => auth()->user()->name
                    ],
                    [
                        'name' => 'user[email]',
                        'contents' => auth()->user()->email
                    ],
                    [
                        'name' => 'user[id]',
                        'contents' => auth()->user()->id
                    ],
                    [
                        'name' => 'user[environment]',
                        'contents' => config('app.env')
                    ],
                    [
                        'name' => 'user[url]',
                        'contents' => config('app.url')
                    ],
                    [
                        'name' => 'metadata[url]',
                        'contents' => config('app.url')
                    ],
                    [
                        'name' => 'metadata[environment]',
                        'contents' => config('app.env')
                    ],
                ];

                // Add deleted attachment IDs to multipart data
                if ($hasDeletedAttachments) {
                    $deletedIds = $request->input('deleted_attachment_ids');
                    foreach ($deletedIds as $index => $id) {
                        $multipartData[] = [
                            'name' => "deleted_attachment_ids[$index]",
                            'contents' => $id
                        ];
                    }
                }

                // Add attachments to multipart data
                if ($hasAttachments) {
                    $files = $request->file('attachments');
                    foreach ($files as $index => $file) {
                        $multipartData[] = [
                            'name' => "attachments[$index]",
                            'contents' => fopen($file->getPathname(), 'r'),
                            'filename' => $file->getClientOriginalName()
                        ];
                    }
                }

                $response = Http::withToken($token)
                    ->acceptJson()
                    ->asMultipart()
                    ->put($baseUrl . '/api/tasks/' . $id, $multipartData);
            } else {
                // Regular JSON request without files
                $payload = [
                    ...$request->all(),
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

                $response = Http::withToken($token)
                    ->acceptJson()
                    ->put($baseUrl . '/api/tasks/' . $id, $payload);
            }

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
        $token = config('shift.token');
        $project = config('shift.project');

        if (empty($token) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }
        $baseUrl = config('shift.url');
        try {
            // Prepare query parameters - only include simple parameters in the query
            $params = [
                'project' => $project
            ];

            // Add user and metadata information to headers instead of query params
            $response = Http::withToken($token)
                ->acceptJson()
                ->withHeaders([
                    'X-User-Name' => auth()->user()->name,
                    'X-User-Email' => auth()->user()->email,
                    'X-User-Id' => auth()->user()->id,
                    'X-Environment' => config('app.env'),
                    'X-App-Url' => config('app.url'),
                ])
                ->get($baseUrl . '/api/tasks/' . $id, $params);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch task'], 500);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to fetch task: ' . $e->getMessage()], 500);
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

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->delete($baseUrl . '/api/tasks/' . $id, [
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
                ]);

            if ($response->successful()) {
                return response()->json(['message' => 'Task deleted successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to delete task'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to delete task: ' . $e->getMessage()], 500);
        }
    }
}
