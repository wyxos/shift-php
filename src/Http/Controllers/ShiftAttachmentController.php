<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Wyxos\Shift\Support\ChunkedUploads;

class ShiftAttachmentController extends Controller
{
    /**
     * Upload a temporary attachment.
     *
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
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            // Validate the request
            $request->validate([
                'file' => 'required|file|max:'.ChunkedUploads::maxUploadKb(),
                'temp_identifier' => 'required|string',
            ]);

            // Create a multipart request with the file
            $multipartData = [
                [
                    'name' => 'file',
                    'contents' => fopen($request->file('file')->getPathname(), 'r'),
                    'filename' => $request->file('file')->getClientOriginalName(),
                ],
                [
                    'name' => 'temp_identifier',
                    'contents' => $request->input('temp_identifier'),
                ],
                [
                    'name' => 'project',
                    'contents' => $project,
                ],
                [
                    'name' => 'user[name]',
                    'contents' => $user->name,
                ],
                [
                    'name' => 'user[email]',
                    'contents' => $user->email,
                ],
                [
                    'name' => 'user[id]',
                    'contents' => $user->id,
                ],
                [
                    'name' => 'user[environment]',
                    'contents' => config('app.env'),
                ],
                [
                    'name' => 'user[url]',
                    'contents' => config('app.url'),
                ],
                [
                    'name' => 'metadata[url]',
                    'contents' => config('app.url'),
                ],
                [
                    'name' => 'metadata[environment]',
                    'contents' => config('app.env'),
                ],
            ];

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->asMultipart()
                ->post($baseUrl.'/api/attachments/upload', $multipartData);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to upload attachment'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to upload attachment: '.$e->getMessage()], 500);
        }
    }

    /**
     * Initialize a chunked upload session.
     */
    public function uploadInit(Request $request)
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

        $data = $request->validate([
            'filename' => 'required|string',
            'size' => 'required|integer|min:1|max:'.ChunkedUploads::maxUploadBytes(),
            'temp_identifier' => 'required|string',
            'mime_type' => 'nullable|string',
        ]);

        try {
            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->post($baseUrl.'/api/attachments/upload-init', [
                    'filename' => $data['filename'],
                    'size' => $data['size'],
                    'temp_identifier' => $data['temp_identifier'],
                    'mime_type' => $data['mime_type'] ?? null,
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
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to initialize upload'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to initialize upload: '.$e->getMessage()], 500);
        }
    }

    /**
     * Return chunk upload status for resumable uploads.
     */
    public function uploadStatus(Request $request)
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

        $data = $request->validate([
            'upload_id' => 'required|string',
        ]);

        try {
            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->get($baseUrl.'/api/attachments/upload-status', [
                    'upload_id' => $data['upload_id'],
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
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to fetch upload status'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch upload status: '.$e->getMessage()], 500);
        }
    }

    /**
     * Upload a single chunk for an existing chunked upload session.
     */
    public function uploadChunk(Request $request)
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

        $data = $request->validate([
            'upload_id' => 'required|string',
            'chunk_index' => 'required|integer|min:0',
            'chunk' => 'required|file|max:'.ChunkedUploads::chunkSizeKb(),
        ]);

        try {
            $chunkFile = $request->file('chunk');
            $multipart = [
                [
                    'name' => 'upload_id',
                    'contents' => $data['upload_id'],
                ],
                [
                    'name' => 'chunk_index',
                    'contents' => (string) $data['chunk_index'],
                ],
                [
                    'name' => 'chunk',
                    'contents' => fopen($chunkFile->getPathname(), 'r'),
                    'filename' => $chunkFile->getClientOriginalName(),
                ],
                [
                    'name' => 'project',
                    'contents' => $project,
                ],
                [
                    'name' => 'user[name]',
                    'contents' => $user->name,
                ],
                [
                    'name' => 'user[email]',
                    'contents' => $user->email,
                ],
                [
                    'name' => 'user[id]',
                    'contents' => $user->id,
                ],
                [
                    'name' => 'user[environment]',
                    'contents' => config('app.env'),
                ],
                [
                    'name' => 'user[url]',
                    'contents' => config('app.url'),
                ],
                [
                    'name' => 'metadata[url]',
                    'contents' => config('app.url'),
                ],
                [
                    'name' => 'metadata[environment]',
                    'contents' => config('app.env'),
                ],
            ];

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->asMultipart()
                ->post($baseUrl.'/api/attachments/upload-chunk', $multipart);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to upload chunk'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to upload chunk: '.$e->getMessage()], 500);
        }
    }

    /**
     * Complete a chunked upload and forward the file to SHIFT.
     */
    public function uploadComplete(Request $request)
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

        $data = $request->validate([
            'upload_id' => 'required|string',
        ]);

        try {
            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->post($baseUrl.'/api/attachments/upload-complete', [
                    'upload_id' => $data['upload_id'],
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
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to complete upload'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to upload attachment: '.$e->getMessage()], 500);
        }
    }

    /**
     * Upload multiple attachments at once.
     *
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
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            // Validate the request
            $request->validate([
                'attachments' => 'required|array',
                'attachments.*' => 'file|max:'.ChunkedUploads::maxUploadKb(),
                'temp_identifier' => 'required|string',
            ]);

            // Create a multipart request with all files
            $multipartData = [
                [
                    'name' => 'temp_identifier',
                    'contents' => $request->input('temp_identifier'),
                ],
                [
                    'name' => 'project',
                    'contents' => $project,
                ],
                [
                    'name' => 'user[name]',
                    'contents' => $user->name,
                ],
                [
                    'name' => 'user[email]',
                    'contents' => $user->email,
                ],
                [
                    'name' => 'user[id]',
                    'contents' => $user->id,
                ],
                [
                    'name' => 'user[environment]',
                    'contents' => config('app.env'),
                ],
                [
                    'name' => 'user[url]',
                    'contents' => config('app.url'),
                ],
                [
                    'name' => 'metadata[url]',
                    'contents' => config('app.url'),
                ],
                [
                    'name' => 'metadata[environment]',
                    'contents' => config('app.env'),
                ],
            ];

            // Add all files to the multipart data
            foreach ($request->file('attachments') as $index => $file) {
                $multipartData[] = [
                    'name' => "attachments[$index]",
                    'contents' => fopen($file->getPathname(), 'r'),
                    'filename' => $file->getClientOriginalName(),
                ];
            }

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->asMultipart()
                ->post($baseUrl.'/api/attachments/upload-multiple', $multipartData);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to upload attachments'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to upload attachments: '.$e->getMessage()], 500);
        }
    }

    /**
     * Remove a temporary attachment.
     *
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
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            // Validate the request
            $request->validate([
                'path' => 'required|string',
            ]);

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->delete($baseUrl.'/api/attachments/remove-temp', [
                    'path' => $request->input('path'),
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
                return response()->json(['message' => 'Attachment removed successfully']);
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to remove attachment'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to remove attachment: '.$e->getMessage()], 500);
        }
    }

    /**
     * List temporary attachments.
     *
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
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            // Validate the request
            $request->validate([
                'temp_identifier' => 'required|string',
            ]);

            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->get($baseUrl.'/api/attachments/list-temp', [
                    'temp_identifier' => $request->input('temp_identifier'),
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
                return response()->json($response->json());
            }

            return response()->json(
                $response->json() ?: ['error' => $response->body() ?: 'Failed to list attachments'],
                $response->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to list attachments: '.$e->getMessage()], 500);
        }
    }

    /**
     * Proxy a temporary attachment file from SHIFT.
     */
    public function showTemp(string $temp, string $filename)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        $baseUrl = config('shift.url');

        try {
            $response = Http::withToken($apiToken)
                ->acceptJson()
                ->get($baseUrl.'/api/attachments/temp/'.$temp.'/'.$filename, [
                    'project' => $project,
                ]);

            if (! $response->successful()) {
                return response()->json(
                    $response->json() ?: ['error' => $response->body() ?: 'Failed to fetch attachment'],
                    $response->status()
                );
            }

            $headers = [];
            foreach (['Content-Type', 'Cache-Control'] as $header) {
                $value = $response->header($header);
                if ($value) {
                    $headers[$header] = $value;
                }
            }

            return response($response->body(), $response->status(), $headers);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch attachment: '.$e->getMessage()], 500);
        }
    }

    /**
     * Proxy a download request for an attachment from the SHIFT API.
     *
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
        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $parsed = parse_url($baseUrl);
            $host = $parsed['host'] ?? '';
            $isLocalInsecureHost = app()->environment('local') && ($host === 'localhost' || $host === '127.0.0.1' || str_ends_with($host, '.test'));

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
            $response = $client->get($baseUrl.'/api/attachments/'.$attachmentId.'/download', $params);

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
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to download attachment: '.$e->getMessage()], 500);
        }
    }
}
