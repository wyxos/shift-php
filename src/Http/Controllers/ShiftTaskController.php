<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Wyxos\Shift\Support\ShiftActorContext;
use Wyxos\Shift\Support\ShiftAttachmentProxyContext;
use Wyxos\Shift\Support\ShiftProxyResponse;

class ShiftTaskController extends Controller
{
    public function index(Request $request)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $params = [
                ...$this->basePayload(),
            ];

            if ($request->has('status')) {
                $params['status'] = $request->status;
            }

            if ($request->has('priority')) {
                $params['priority'] = $request->priority;
            }

            if ($request->filled('search')) {
                $params['search'] = $request->search;
            }

            if ($request->filled('environment')) {
                $params['environment'] = $request->environment;
            }

            if ($request->filled('sort_by')) {
                $params['sort_by'] = $request->sort_by;
            }

            if ($request->filled('page')) {
                $params['page'] = (int) $request->page;
            }

            $response = $this->shiftClient()->get($this->baseUrl().'/api/tasks', $params);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to fetch tasks');
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch tasks: '.$e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $payload = [
                ...$request->except('status'),
                'status' => 'pending',
                ...$this->basePayload(),
            ];

            $response = $this->shiftClient()->post($this->baseUrl().'/api/tasks', $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to create task', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to create task: '.$e->getMessage()], 500);
        }
    }

    public function emailImport(Request $request)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $request->validate([
            'email' => 'required|file|max:20480',
        ]);

        try {
            $file = $request->file('email');
            $context = new ShiftAttachmentProxyContext(
                (string) config('shift.token'),
                (string) config('shift.project'),
                $this->baseUrl(),
                $user,
            );

            $response = $this->shiftClient()
                ->asMultipart()
                ->post($this->baseUrl().'/api/tasks/email-import', $context->multipartPayload([
                    $context->multipartFile('email', $file->getPathname(), $file->getClientOriginalName()),
                ]));

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to import email', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to import email: '.$e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $payload = [
                ...$request->all(),
                ...$this->basePayload(),
            ];

            $response = $this->shiftClient()->put($this->baseUrl().'/api/tasks/'.$id, $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to update task', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to update task: '.$e->getMessage()], 500);
        }
    }

    public function updateCollaborators(Request $request, int $id)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $attributes = $request->validate([
            'environment' => 'nullable|string|max:255',
            'internal_collaborator_ids' => 'nullable|array',
            'internal_collaborator_ids.*' => 'integer',
            'external_collaborators' => 'nullable|array',
            'external_collaborators.*.id' => 'required',
            'external_collaborators.*.name' => 'required|string|max:255',
            'external_collaborators.*.email' => 'required|email',
        ]);

        try {
            $payload = [
                ...$attributes,
                ...$this->basePayload(),
            ];

            $response = $this->shiftClient()->patch($this->baseUrl().'/api/tasks/'.$id.'/collaborators', $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to update task collaborators', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to update task collaborators: '.$e->getMessage()], 500);
        }
    }

    public function show(int $id)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $response = $this->shiftClient()->get($this->baseUrl().'/api/tasks/'.$id, [
                'project' => config('shift.project'),
                'user' => $this->userPayload(),
            ]);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to fetch task');
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch task: '.$e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $response = $this->shiftClient()->delete($this->baseUrl().'/api/tasks/'.$id, $this->basePayload());

            if ($response->successful()) {
                return response()->json(['message' => 'Task deleted successfully']);
            }

            return ShiftProxyResponse::error($response, 'Failed to delete task', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to delete task: '.$e->getMessage()], 500);
        }
    }

    public function toggleStatus(Request $request, int $id)
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        $user = auth()->user();
        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $attributes = $request->validate([
            'status' => 'required|string',
        ]);

        try {
            $payload = [
                'status' => $attributes['status'],
                ...$this->basePayload(),
            ];

            $response = $this->shiftClient()->patch($this->baseUrl().'/api/tasks/'.$id.'/toggle-status', $payload);

            if ($response->successful()) {
                return response()->json($response->json());
            }

            return ShiftProxyResponse::error($response, 'Failed to update task status', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to update task status: '.$e->getMessage()], 500);
        }
    }

    private function configurationErrorResponse(): ?\Illuminate\Http\JsonResponse
    {
        return $this->context()->configurationErrorResponse();
    }

    private function baseUrl(): string
    {
        return $this->context()->baseUrl();
    }

    private function userPayload(): array
    {
        return $this->context()->userPayload();
    }

    private function basePayload(): array
    {
        return $this->context()->basePayload();
    }

    private function shiftClient(): PendingRequest
    {
        return $this->context()->client();
    }

    private function context(): ShiftActorContext
    {
        return app(ShiftActorContext::class);
    }
}
