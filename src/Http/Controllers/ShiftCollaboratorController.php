<?php

namespace Wyxos\Shift\Http\Controllers;

use ArrayAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
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

        $resolver = config('shift.collaborators.resolver');
        if (! is_string($resolver) || trim($resolver) === '') {
            return response()->json(['message' => 'SHIFT collaborator resolver is not configured.'], 503);
        }

        $instance = app($resolver);
        if (! $instance instanceof ResolvesShiftCollaborators) {
            return response()->json(['message' => 'SHIFT collaborator resolver must implement '.ResolvesShiftCollaborators::class.'.'], 500);
        }

        $search = trim((string) $request->input('search', ''));
        $users = collect($instance->resolve($search !== '' ? $search : null))
            ->map(function ($user) {
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

        if ($users->contains(null)) {
            return response()->json(['message' => 'SHIFT collaborator resolver returned an invalid user payload.'], 500);
        }

        return response()->json([
            'url' => rtrim((string) config('app.url'), '/'),
            'environment' => (string) config('app.env'),
            'users' => $users->values()->all(),
        ]);
    }
}
