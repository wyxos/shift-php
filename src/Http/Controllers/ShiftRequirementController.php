<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Wyxos\Shift\Support\ShiftActorContext;
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

            foreach (['status', 'lifecycle', 'priority', 'search', 'environment', 'sort_by'] as $filter) {
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
            'internal_collaborator_ids' => 'nullable|array',
            'internal_collaborator_ids.*' => 'integer',
            'external_collaborators' => 'nullable|array',
            'external_collaborators.*.id' => 'required',
            'external_collaborators.*.name' => 'required|string|max:255',
            'external_collaborators.*.email' => 'required|email',
            'items' => 'required|array|min:1|max:50',
            'items.*.title' => 'required|string|max:255',
            'items.*.description' => 'required|string',
            'items.*.temp_identifier' => 'nullable|string',
            'items.*.internal_collaborator_ids' => 'nullable|array',
            'items.*.internal_collaborator_ids.*' => 'integer',
            'items.*.external_collaborators' => 'nullable|array',
            'items.*.external_collaborators.*.id' => 'required',
            'items.*.external_collaborators.*.name' => 'required|string|max:255',
            'items.*.external_collaborators.*.email' => 'required|email',
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
        return $this->context()->configurationErrorResponse();
    }

    private function baseUrl(): string
    {
        return $this->context()->baseUrl();
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
