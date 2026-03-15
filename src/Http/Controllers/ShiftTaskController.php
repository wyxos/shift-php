<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch tasks'], 500);
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to create task'], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to create task: '.$e->getMessage()], 500);
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to update task'], 422);
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to update task collaborators'], 422);
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to fetch task'], 500);
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to delete task'], 422);
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

            return response()->json(['error' => $response->json()['message'] ?? 'Failed to update task status'], 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to update task status: '.$e->getMessage()], 500);
        }
    }

    private function configurationErrorResponse(): ?\Illuminate\Http\JsonResponse
    {
        if (blank(config('shift.token')) || blank(config('shift.project'))) {
            return response()->json(['error' => 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'], 500);
        }

        return null;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('shift.url'), '/');
    }

    private function userPayload(): array
    {
        $user = auth()->user();

        return [
            'name' => $user->name,
            'email' => $user->email,
            'id' => $user->id,
            'environment' => config('app.env'),
            'url' => config('app.url'),
        ];
    }

    private function basePayload(): array
    {
        return [
            'project' => config('shift.project'),
            'user' => $this->userPayload(),
            'metadata' => [
                'url' => config('app.url'),
                'environment' => config('app.env'),
            ],
        ];
    }

    private function shiftClient(): PendingRequest
    {
        $request = Http::withToken((string) config('shift.token'))
            ->acceptJson();

        if ($this->isLocalOrPrivateUrl($this->baseUrl())) {
            $request = $request->withoutVerifying();
        }

        return $request;
    }

    private function isLocalOrPrivateUrl(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            return true;
        }

        if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
            return true;
        }

        if (Str::endsWith($host, ['.test', '.local'])) {
            return true;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
        }

        return false;
    }
}
