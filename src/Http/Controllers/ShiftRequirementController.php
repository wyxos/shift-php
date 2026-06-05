<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Wyxos\Shift\Support\ShiftProxyResponse;

class ShiftRequirementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        if (! auth()->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $params = [
                ...$this->basePayload(),
            ];

            foreach (['status', 'priority', 'search', 'environment', 'sort_by'] as $filter) {
                if ($request->filled($filter)) {
                    $params[$filter] = $request->input($filter);
                }
            }

            if ($request->filled('page')) {
                $params['page'] = (int) $request->input('page');
            }

            $response = $this->shiftClient()->get($this->baseUrl().'/api/requirements', $params);

            if ($response->successful()) {
                return response()->json($response->json(), $response->status() ?: 200);
            }

            return ShiftProxyResponse::error($response, 'Failed to fetch requirements');
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch requirements: '.$e->getMessage()], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $configurationError = $this->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        if (! auth()->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $attributes = $request->validate([
            'title' => 'nullable|string|max:255',
            'items' => 'required|array|min:1|max:50',
            'items.*.title' => 'required|string|max:255',
            'items.*.description' => 'required|string',
        ]);

        try {
            $payload = [
                ...$attributes,
                ...$this->basePayload(),
            ];

            $response = $this->shiftClient()->post($this->baseUrl().'/api/requirements/batches', $payload);

            if ($response->successful()) {
                return response()->json($response->json(), $response->status() ?: 201);
            }

            return ShiftProxyResponse::error($response, 'Failed to submit requirements', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to submit requirements: '.$e->getMessage()], 500);
        }
    }

    private function configurationErrorResponse(): ?JsonResponse
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
