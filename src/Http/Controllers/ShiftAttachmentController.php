<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Wyxos\Shift\Support\ChunkedUploads;
use Wyxos\Shift\Support\ShiftAttachmentProxyContext;

class ShiftAttachmentController extends Controller
{
    /**
     * Upload a temporary attachment.
     */
    public function upload(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'file' => 'required|file|max:'.ChunkedUploads::maxUploadKb(),
            'temp_identifier' => 'required|string',
        ]);

        try {
            $file = $request->file('file');

            $response = $this->jsonClient($context)
                ->asMultipart()
                ->post($context->url('/api/attachments/upload'), $context->multipartPayload([
                    $context->multipartFile('file', $file->getPathname(), $file->getClientOriginalName()),
                    $context->multipartField('temp_identifier', $data['temp_identifier']),
                ]));

            return $this->jsonResponse($response, 'Failed to upload attachment', $context, 'attachments.upload');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to upload attachment', $e);
        }
    }

    /**
     * Initialize a chunked upload session.
     */
    public function uploadInit(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'filename' => 'required|string',
            'size' => 'required|integer|min:1|max:'.ChunkedUploads::maxUploadBytes(),
            'temp_identifier' => 'required|string',
            'mime_type' => 'nullable|string',
        ]);

        try {
            $response = $this->jsonClient($context)
                ->post($context->url('/api/attachments/upload-init'), $context->jsonPayload([
                    'filename' => $data['filename'],
                    'size' => $data['size'],
                    'temp_identifier' => $data['temp_identifier'],
                    'mime_type' => $data['mime_type'] ?? null,
                ]));

            return $this->jsonResponse($response, 'Failed to initialize upload', $context, 'attachments.upload-init');
        } catch (\Throwable $e) {
            $traceId = (string) Str::uuid();
            Log::error('shift-php: attachments.upload-init exception', [
                'trace_id' => $traceId,
                'shift_url' => $context->baseUrl(),
                'project' => $context->project(),
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to initialize upload: '.$e->getMessage(),
                'trace_id' => $traceId,
            ], 500);
        }
    }

    /**
     * Return chunk upload status for resumable uploads.
     */
    public function uploadStatus(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'upload_id' => 'required|string',
        ]);

        try {
            $response = $this->jsonClient($context)
                ->get($context->url('/api/attachments/upload-status'), $context->jsonPayload([
                    'upload_id' => $data['upload_id'],
                ]));

            return $this->jsonResponse($response, 'Failed to fetch upload status', $context, 'attachments.upload-status');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to fetch upload status', $e);
        }
    }

    /**
     * Upload a single chunk for an existing chunked upload session.
     */
    public function uploadChunk(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'upload_id' => 'required|string',
            'chunk_index' => 'required|integer|min:0',
            'chunk' => 'required|file|max:'.ChunkedUploads::chunkSizeKb(),
        ]);

        try {
            $chunk = $request->file('chunk');

            $response = $this->jsonClient($context)
                ->asMultipart()
                ->post($context->url('/api/attachments/upload-chunk'), $context->multipartPayload([
                    $context->multipartField('upload_id', $data['upload_id']),
                    $context->multipartField('chunk_index', (string) $data['chunk_index']),
                    $context->multipartFile('chunk', $chunk->getPathname(), $chunk->getClientOriginalName()),
                ]));

            return $this->jsonResponse($response, 'Failed to upload chunk', $context, 'attachments.upload-chunk');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to upload chunk', $e);
        }
    }

    /**
     * Complete a chunked upload and forward the file to SHIFT.
     */
    public function uploadComplete(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'upload_id' => 'required|string',
        ]);

        try {
            $response = $this->jsonClient($context)
                ->post($context->url('/api/attachments/upload-complete'), $context->jsonPayload([
                    'upload_id' => $data['upload_id'],
                ]));

            return $this->jsonResponse($response, 'Failed to complete upload', $context, 'attachments.upload-complete');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to upload attachment', $e);
        }
    }

    private function resolveContext(Request $request, bool $requireUser = true)
    {
        $apiToken = config('shift.token');
        $project = config('shift.project');

        if (empty($apiToken) || empty($project)) {
            return $this->missingConfigurationResponse();
        }

        $baseUrl = (string) config('shift.url');
        if ($guard = $this->guardAgainstRecursiveShiftUrl($baseUrl, $request)) {
            return $guard;
        }

        $user = auth()->user();
        if ($requireUser && ! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        return new ShiftAttachmentProxyContext((string) $apiToken, (string) $project, $baseUrl, $user);
    }

    private function missingConfigurationResponse(): JsonResponse
    {
        return response()->json([
            'error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env',
        ], 500);
    }

    private function jsonClient(ShiftAttachmentProxyContext $context): PendingRequest
    {
        return Http::withToken($context->token())->acceptJson();
    }

    /**
     * Upload multiple attachments at once.
     */
    public function uploadMultiple(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $request->validate([
            'attachments' => 'required|array',
            'attachments.*' => 'file|max:'.ChunkedUploads::maxUploadKb(),
            'temp_identifier' => 'required|string',
        ]);

        try {
            $multipart = $context->multipartPayload([
                $context->multipartField('temp_identifier', $request->input('temp_identifier')),
            ]);

            foreach ($request->file('attachments') as $index => $file) {
                $multipart[] = $context->multipartFile("attachments[$index]", $file->getPathname(), $file->getClientOriginalName());
            }

            $response = $this->jsonClient($context)
                ->asMultipart()
                ->post($context->url('/api/attachments/upload-multiple'), $multipart);

            return $this->jsonResponse($response, 'Failed to upload attachments', $context, 'attachments.upload-multiple');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to upload attachments', $e);
        }
    }

    /**
     * Remove a temporary attachment.
     */
    public function removeTemp(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'path' => 'required|string',
        ]);

        try {
            $response = $this->jsonClient($context)
                ->delete($context->url('/api/attachments/remove-temp'), $context->jsonPayload([
                    'path' => $data['path'],
                ]));

            if ($response->successful()) {
                return response()->json(['message' => 'Attachment removed successfully']);
            }

            return $this->jsonResponse($response, 'Failed to remove attachment', $context, 'attachments.remove-temp');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to remove attachment', $e);
        }
    }

    /**
     * List temporary attachments.
     */
    public function listTemp(Request $request)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        $data = $request->validate([
            'temp_identifier' => 'required|string',
        ]);

        try {
            $response = $this->jsonClient($context)
                ->get($context->url('/api/attachments/list-temp'), $context->jsonPayload([
                    'temp_identifier' => $data['temp_identifier'],
                ]));

            return $this->jsonResponse($response, 'Failed to list attachments', $context, 'attachments.list-temp');
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to list attachments', $e);
        }
    }

    /**
     * Proxy a temporary attachment file from SHIFT.
     */
    public function showTemp(Request $request, string $temp, string $filename)
    {
        $context = $this->resolveContext($request, false);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        try {
            $response = $this->jsonClient($context)
                ->get($context->url('/api/attachments/temp/'.$temp.'/'.$filename), $context->jsonPayload([], false, false));

            if (! $response->successful()) {
                return $this->jsonResponse($response, 'Failed to fetch attachment', $context, 'attachments.temp');
            }

            return $this->binaryResponse($response, ['Content-Type', 'Cache-Control'], $response->status());
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to fetch attachment', $e);
        }
    }

    /**
     * Proxy a download request for an attachment from the SHIFT API.
     */
    public function download(Request $request, int $attachmentId)
    {
        $context = $this->resolveContext($request);
        if ($context instanceof JsonResponse) {
            return $context;
        }

        try {
            $response = $this->downloadClient($context)
                ->get($context->url('/api/attachments/'.$attachmentId.'/download'), $context->jsonPayload());

            if ($response->status() === 302 && $response->header('Location')) {
                return redirect()->away($response->header('Location'));
            }

            if ($redirectUrl = $this->extractRedirectUrlFromJson($response)) {
                return redirect()->away($redirectUrl);
            }

            if ($response->successful()) {
                return $this->binaryResponse($response, ['Content-Type', 'Content-Disposition', 'Cache-Control']);
            }

            return response()->json([
                'error' => $this->extractErrorMessage($response, 'Failed to download attachment'),
            ], $response->status() ?: 422);
        } catch (\Throwable $e) {
            return $this->exceptionResponse('Failed to download attachment', $e);
        }
    }

    private function downloadClient(ShiftAttachmentProxyContext $context): PendingRequest
    {
        $host = (string) parse_url($context->baseUrl(), PHP_URL_HOST);

        $client = Http::withToken($context->token())
            ->retry(2, 200)
            ->timeout(60)
            ->connectTimeout(10);

        if (app()->environment('local') && ($host === 'localhost' || $host === '127.0.0.1' || str_ends_with($host, '.test'))) {
            return $client->withoutVerifying();
        }

        return $client;
    }

    private function jsonResponse(
        ClientResponse $response,
        string $defaultError,
        ?ShiftAttachmentProxyContext $context = null,
        ?string $endpoint = null
    ): JsonResponse {
        if ($response->successful()) {
            return response()->json($response->json(), $response->status());
        }

        if ($context && $endpoint) {
            $this->logUpstreamFailure($endpoint, $context->baseUrl(), $context->project(), $response->status(), (string) $response->body());
        }

        return response()->json(
            $response->json() ?: ['error' => $this->extractErrorMessage($response, $defaultError)],
            $response->status()
        );
    }

    private function binaryResponse(ClientResponse $response, array $allowedHeaders, int $status = 200): HttpResponse
    {
        return response($response->body(), $status, $this->forwardHeaders($response, $allowedHeaders));
    }

    private function forwardHeaders(ClientResponse $response, array $allowedHeaders): array
    {
        $headers = [];

        foreach ($allowedHeaders as $header) {
            $value = $response->header($header);
            if ($value) {
                $headers[$header] = $value;
            }
        }

        return $headers;
    }

    private function extractRedirectUrlFromJson(ClientResponse $response): ?string
    {
        try {
            $payload = $response->json();
        } catch (\Throwable) {
            return null;
        }

        return is_array($payload) && isset($payload['url']) ? $payload['url'] : null;
    }

    private function extractErrorMessage(ClientResponse $response, string $defaultError): string
    {
        try {
            $payload = $response->json();
        } catch (\Throwable) {
            $payload = null;
        }

        if (is_array($payload) && is_string($payload['message'] ?? null) && $payload['message'] !== '') {
            return $payload['message'];
        }

        $body = trim((string) $response->body());

        return $body !== '' ? $body : $defaultError;
    }

    private function exceptionResponse(string $message, \Throwable $e): JsonResponse
    {
        return response()->json(['error' => $message.': '.$e->getMessage()], 500);
    }

    private function guardAgainstRecursiveShiftUrl(string $shiftUrl, Request $request): ?JsonResponse
    {
        $shiftHost = (string) (parse_url($shiftUrl, PHP_URL_HOST) ?: '');
        $shiftPath = (string) (parse_url($shiftUrl, PHP_URL_PATH) ?: '');
        $appHost = (string) (parse_url((string) config('app.url'), PHP_URL_HOST) ?: $request->getHost());

        if ($shiftHost !== '' && $appHost !== '' && $shiftHost === $appHost && str_starts_with($shiftPath, '/shift')) {
            $traceId = (string) Str::uuid();
            Log::error('shift-php: SHIFT_URL misconfigured (recursive)', [
                'trace_id' => $traceId,
                'shift_url' => $shiftUrl,
                'app_url' => config('app.url'),
                'request_host' => $request->getHost(),
            ]);

            return response()->json([
                'error' => 'SHIFT_URL appears to point at this same app (/shift). This causes recursive proxy calls. Set SHIFT_URL to the SHIFT server base URL (e.g. https://shift.wyxos.com).',
                'trace_id' => $traceId,
            ], 500);
        }

        return null;
    }

    private function logUpstreamFailure(string $endpoint, string $shiftUrl, string $project, int $status, string $body): void
    {
        $trimmedBody = Str::limit(trim($body), 4000, '...(truncated)');
        $level = $status >= 500 || $status === 0 ? 'error' : 'warning';

        Log::{$level}('shift-php: upstream request failed', [
            'endpoint' => $endpoint,
            'shift_url' => $shiftUrl,
            'project' => $project,
            'status' => $status,
            'body' => $trimmedBody,
        ]);
    }
}
