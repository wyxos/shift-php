<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class ShiftAttachmentController extends Controller
{
    /**
     * Upload a temporary attachment.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function upload(Request $request)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            // Validate the request
            $request->validate([
                'file' => 'required|file',
                'temp_identifier' => 'required|string',
            ]);

            // Create a multipart request with the file
            $multipartData = [
                [
                    'name' => 'file',
                    'contents' => fopen($request->file('file')->getPathname(), 'r'),
                    'filename' => $request->file('file')->getClientOriginalName()
                ],
                [
                    'name' => 'temp_identifier',
                    'contents' => $request->input('temp_identifier')
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

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->asMultipart()
                ->post($baseUrl . '/api/attachments/upload', $multipartData);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to upload attachment'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to upload attachment: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Upload multiple attachments at once.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadMultiple(Request $request)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            // Validate the request
            $request->validate([
                'attachments' => 'required|array',
                'attachments.*' => 'file',
                'temp_identifier' => 'required|string',
            ]);

            // Create a multipart request with all files
            $multipartData = [
                [
                    'name' => 'temp_identifier',
                    'contents' => $request->input('temp_identifier')
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

            // Add all files to the multipart data
            foreach ($request->file('attachments') as $index => $file) {
                $multipartData[] = [
                    'name' => "attachments[$index]",
                    'contents' => fopen($file->getPathname(), 'r'),
                    'filename' => $file->getClientOriginalName()
                ];
            }

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->asMultipart()
                ->post($baseUrl . '/api/attachments/upload-multiple', $multipartData);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to upload attachments'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to upload attachments: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Remove a temporary attachment.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function removeTemp(Request $request)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            // Validate the request
            $request->validate([
                'path' => 'required|string',
            ]);

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->delete($baseUrl . '/api/attachments/remove-temp', [
                    'path' => $request->input('path'),
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
                return response()->json(['message' => 'Attachment removed successfully']);
            }

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to remove attachment'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to remove attachment: ' . $e->getMessage()], 500);
        }
    }

    /**
     * List temporary attachments.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function listTemp(Request $request)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            // Validate the request
            $request->validate([
                'temp_identifier' => 'required|string',
            ]);

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->get($baseUrl . '/api/attachments/list-temp', [
                    'temp_identifier' => $request->input('temp_identifier'),
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to list attachments'], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to list attachments: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Proxy a download request for an attachment from the SHIFT API.
     *
     * @param int $attachmentId
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function download(int $attachmentId)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            $parsed = parse_url($baseUrl);
            $host = $parsed['host'] ?? '';
            $isLocalInsecureHost = app()->environment('local') && ($host === 'localhost' || $host === '127.0.0.1' || str_ends_with($host, '.test'));

            $params = [
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

            // Stream the file from SHIFT. Depending on backend behavior this may:
            // - Return a binary body with headers
            // - Return a 302 redirect to a signed URL
            // - Return JSON containing a URL
            $client = Http::withToken($apiToken)
                ->retry(2, 200)
                ->timeout(60)
                ->connectTimeout(10);

            // In local dev with .test/self-signed certs, disable TLS verification for convenience
            if ($isLocalInsecureHost) {
                $client = $client->withoutVerifying();
            }

            // Do a regular GET (no streaming) to avoid mismatched Content-Length after decompression
            $response = $client->get($baseUrl . '/api/attachments/' . $attachmentId . '/download', $params);

            // Handle explicit redirect
            if ($response->status() === 302 && $response->header('Location')) {
                return redirect()->away($response->header('Location'));
            }

            // Handle JSON body providing a URL
            $json = null;
            try {
                $json = $response->json();
            } catch (\Throwable $t) {
                // Non-JSON response; ignore
            }
            if (is_array($json) && isset($json['url'])) {
                return redirect()->away($json['url']);
            }

            // Handle successful binary response by proxying headers/body
            if ($response->successful()) {
                // Only forward safe headers; omit Content-Length/Encoding to prevent browser aborts
                $headers = [];
                foreach (['Content-Type', 'Content-Disposition', 'Cache-Control'] as $header) {
                    if ($response->header($header)) {
                        $headers[$header] = $response->header($header);
                    }
                }

                return response($response->body(), 200, $headers);
            }

            return response()->json(['error' => $json['message'] ?? 'Failed to download attachment'], $response->status() ?: 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to download attachment: ' . $e->getMessage()], 500);
        }
    }
}
