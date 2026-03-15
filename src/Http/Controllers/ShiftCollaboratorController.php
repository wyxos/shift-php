<?php

namespace Wyxos\Shift\Http\Controllers;

use ArrayAccess;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Wyxos\Shift\Contracts\ResolvesShiftCollaborators;

class ShiftCollaboratorController extends Controller
{
    public function external(Request $request): JsonResponse
    {
        $configuredProject = (string) config('shift.project', '');
        $providedToken = (string) $request->bearerToken();

        if ($configuredProject === '' || $providedToken === '' || ! hash_equals($configuredProject, $providedToken)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        try {
            $payload = $this->resolveLocalCollaboratorPayload(trim((string) $request->input('search', '')) ?: null);
        } catch (RuntimeException $exception) {
            $status = str_contains($exception->getMessage(), 'not configured') ? 503 : 500;

            return response()->json(['message' => $exception->getMessage()], $status);
        }

        return response()->json($payload);
    }

    public function task(Request $request): JsonResponse
    {
        $search = trim((string) $request->input('search', '')) ?: null;

        [$internalUsers, $internalAvailable, $internalError] = $this->resolveShiftInternalCollaborators($search);
        [$externalUsers, $externalAvailable, $externalError] = $this->resolveBrowserExternalCollaborators($search);

        return response()->json([
            'internal' => $internalUsers,
            'internal_available' => $internalAvailable,
            'internal_error' => $internalError,
            'external' => $externalUsers,
            'external_available' => $externalAvailable,
            'external_error' => $externalError,
        ]);
    }

    private function resolveBrowserExternalCollaborators(?string $search): array
    {
        try {
            $payload = $this->resolveLocalCollaboratorPayload($search);

            return [$payload['users'], true, null];
        } catch (RuntimeException $exception) {
            return [[], false, $exception->getMessage()];
        }
    }

    private function resolveLocalCollaboratorPayload(?string $search): array
    {
        $users = $this->normalizeResolverUsers(
            $this->resolveLocalCollaboratorResolver()->resolve($search)
        );

        return [
            'url' => rtrim((string) config('app.url'), '/'),
            'environment' => (string) config('app.env'),
            'users' => $users,
        ];
    }

    private function resolveLocalCollaboratorResolver(): ResolvesShiftCollaborators
    {
        $resolver = config('shift.collaborators.resolver');
        if (! is_string($resolver) || trim($resolver) === '') {
            throw new RuntimeException('SHIFT collaborator resolver is not configured.');
        }

        $instance = app($resolver);
        if (! $instance instanceof ResolvesShiftCollaborators) {
            throw new RuntimeException('SHIFT collaborator resolver must implement '.ResolvesShiftCollaborators::class.'.');
        }

        return $instance;
    }

    private function normalizeResolverUsers(iterable $users): array
    {
        $normalized = collect($users)->map(function ($user) {
            if (! is_array($user) && ! $user instanceof ArrayAccess) {
                return null;
            }

            $id = trim((string) ($user['id'] ?? ''));
            $name = trim((string) ($user['name'] ?? ''));
            $email = trim((string) ($user['email'] ?? ''));

            if ($id === '' || $name === '' || $email === '') {
                return null;
            }

            return [
                'id' => $id,
                'name' => $name,
                'email' => $email,
            ];
        });

        if ($normalized->contains(null)) {
            throw new RuntimeException('SHIFT collaborator resolver returned an invalid user payload.');
        }

        return $normalized->values()->all();
    }

    private function resolveShiftInternalCollaborators(?string $search): array
    {
        $token = trim((string) config('shift.token', ''));
        $project = trim((string) config('shift.project', ''));
        $baseUrl = rtrim((string) config('shift.url', 'https://shift.wyxos.com'), '/');

        if ($token === '' || $project === '') {
            return [[], false, 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env'];
        }

        try {
            $response = $this->shiftClient($token, $baseUrl)->get($baseUrl.'/api/collaborators/internal', [
                'project' => $project,
                ...(filled($search) ? ['search' => $search] : []),
            ]);
        } catch (ConnectionException) {
            return [[], false, 'Failed to reach SHIFT for collaborator lookup.'];
        }

        if (! $response->successful()) {
            $message = $response->json('message') ?? $response->json('error') ?? 'Failed to load SHIFT collaborators.';

            return [[], false, (string) $message];
        }

        $users = collect($response->json('users') ?? [])->map(function ($user) {
            if (! is_array($user)) {
                return null;
            }

            $id = $user['id'] ?? null;
            $name = trim((string) ($user['name'] ?? ''));
            $email = trim((string) ($user['email'] ?? ''));

            if ($id === null || $name === '') {
                return null;
            }

            return [
                'id' => $id,
                'name' => $name,
                'email' => $email !== '' ? $email : null,
            ];
        });

        if ($users->contains(null)) {
            return [[], false, 'SHIFT returned an invalid collaborator payload.'];
        }

        return [$users->values()->all(), true, null];
    }

    private function shiftClient(string $token, string $baseUrl): PendingRequest
    {
        $request = Http::withToken($token)
            ->acceptJson();

        if ($this->isLocalOrPrivateUrl($baseUrl)) {
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
