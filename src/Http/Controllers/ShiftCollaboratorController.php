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
use Wyxos\Shift\Contracts\PaginatesShiftCollaborators;
use Wyxos\Shift\Contracts\ResolvesShiftCollaborators;
use Wyxos\Shift\Exceptions\CollaboratorResolverNotConfigured;
use Wyxos\Shift\Support\CollaboratorResolverFactory;

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
            $payload = $this->resolveLocalCollaboratorPayload(
                trim((string) $request->input('search', '')) ?: null,
                $request->boolean('paginate'),
                max(1, $request->integer('page', 1)),
                min(100, max(1, $request->integer('per_page', 15))),
            );
        } catch (CollaboratorResolverNotConfigured $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 500);
        }

        return response()->json($payload);
    }

    public function task(Request $request): JsonResponse
    {
        $search = trim((string) $request->input('search', '')) ?: null;

        [$internalUsers, $internalAvailable, $internalError, $internalLabel] = $this->resolveShiftInternalCollaborators($search);
        [$externalUsers, $externalAvailable, $externalError] = $this->resolveBrowserExternalCollaborators($search);

        return response()->json([
            'internal' => $internalUsers,
            'internal_available' => $internalAvailable,
            'internal_error' => $internalError,
            'internal_label' => $internalLabel ?? 'Organisation',
            'internal_description' => 'Users with access in SHIFT.',
            'external' => $externalUsers,
            'external_available' => $externalAvailable,
            'external_error' => $externalError,
            'external_label' => 'Team',
            'external_description' => 'Users with access from this portal.',
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

    private function resolveLocalCollaboratorPayload(
        ?string $search,
        bool $paginate = false,
        int $page = 1,
        int $perPage = 15,
    ): array {
        $resolver = $this->resolveLocalCollaboratorResolver();

        if ($paginate && $resolver instanceof PaginatesShiftCollaborators) {
            $paginator = $resolver->paginate($search, $page, $perPage);
            $users = $this->normalizeResolverUsers($paginator->items());
            $pagination = [
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ];
        } else {
            $users = $this->normalizeResolverUsers($resolver->resolve($search));

            if ($paginate) {
                $total = count($users);
                $lastPage = max(1, (int) ceil($total / $perPage));
                $page = min($page, $lastPage);
                $users = array_slice($users, ($page - 1) * $perPage, $perPage);
                $pagination = [
                    'current_page' => $page,
                    'last_page' => $lastPage,
                    'per_page' => $perPage,
                    'total' => $total,
                    'from' => $total === 0 ? null : (($page - 1) * $perPage) + 1,
                    'to' => $total === 0 ? null : min($page * $perPage, $total),
                ];
            }
        }

        $payload = [
            'url' => rtrim((string) config('app.url'), '/'),
            'environment' => (string) config('app.env'),
            'users' => $users,
        ];

        if (isset($pagination)) {
            $payload['pagination'] = $pagination;
        }

        return $payload;
    }

    private function resolveLocalCollaboratorResolver(): ResolvesShiftCollaborators
    {
        return app(CollaboratorResolverFactory::class)->make();
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
            return [[], false, 'SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env', null];
        }

        try {
            $response = $this->shiftClient($token, $baseUrl)->get($baseUrl.'/api/collaborators/internal', [
                'project' => $project,
                ...(filled($search) ? ['search' => $search] : []),
            ]);
        } catch (ConnectionException) {
            return [[], false, 'Failed to reach SHIFT for collaborator lookup.', null];
        }

        if (! $response->successful()) {
            $message = $response->json('message') ?? $response->json('error') ?? 'Failed to load SHIFT collaborators.';

            return [[], false, (string) $message, null];
        }

        $organisationName = trim((string) ($response->json('organisation_name') ?? ''));
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
            return [[], false, 'SHIFT returned an invalid collaborator payload.', null];
        }

        return [$users->values()->all(), true, null, $organisationName !== '' ? $organisationName : null];
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
