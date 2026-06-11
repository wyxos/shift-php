<?php

namespace Wyxos\Shift\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Wyxos\Shift\Support\ShiftActorContext;
use Wyxos\Shift\Support\ShiftProxyResponse;

class ShiftExternalRoleController extends Controller
{
    public function capabilities(): JsonResponse
    {
        $configurationError = $this->context()->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        if (! auth()->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $response = $this->context()
                ->client()
                ->get($this->context()->baseUrl().'/api/external-roles/capabilities', $this->context()->basePayload());

            if ($response->successful()) {
                return response()->json($response->json(), $response->status() ?: 200);
            }

            return ShiftProxyResponse::error($response, 'Failed to fetch external role capabilities');
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch external role capabilities: '.$e->getMessage()], 500);
        }
    }

    public function index(Request $request): JsonResponse
    {
        $configurationError = $this->context()->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        if (! auth()->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        try {
            $params = [
                ...$this->context()->basePayload(),
            ];

            foreach (['search', 'environment'] as $filter) {
                if ($request->filled($filter)) {
                    $params[$filter] = $request->input($filter);
                }
            }

            $response = $this->context()
                ->client()
                ->get($this->context()->baseUrl().'/api/external-roles', $params);

            if ($response->successful()) {
                return response()->json($response->json(), $response->status() ?: 200);
            }

            return ShiftProxyResponse::error($response, 'Failed to fetch external roles');
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to fetch external roles: '.$e->getMessage()], 500);
        }
    }

    public function update(Request $request): JsonResponse
    {
        $configurationError = $this->context()->configurationErrorResponse();
        if ($configurationError) {
            return $configurationError;
        }

        if (! auth()->user()) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $attributes = $request->validate([
            'environment' => 'nullable|string|max:255',
            'role' => ['required', 'string', Rule::in($this->context()->externalRoles())],
            'external_user' => 'required|array',
            'external_user.id' => 'required',
            'external_user.name' => 'required|string|max:255',
            'external_user.email' => 'required|email',
        ]);

        try {
            $payload = [
                ...$attributes,
                ...$this->context()->basePayload(),
            ];

            $response = $this->context()
                ->client()
                ->put($this->context()->baseUrl().'/api/external-roles', $payload);

            if ($response->successful()) {
                return response()->json($response->json(), $response->status() ?: 200);
            }

            return ShiftProxyResponse::error($response, 'Failed to update external role', 422);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Failed to update external role: '.$e->getMessage()], 500);
        }
    }

    private function context(): ShiftActorContext
    {
        return app(ShiftActorContext::class);
    }
}
