<?php

namespace Wyxos\Shift\Collaborators;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Wyxos\Shift\Contracts\ResolvesShiftCollaborators;
use Wyxos\Shift\Exceptions\CollaboratorResolverNotConfigured;

class DefaultCollaboratorResolver implements ResolvesShiftCollaborators
{
    public function resolve(?string $search = null): array
    {
        if (config('app.env') !== 'local') {
            throw CollaboratorResolverNotConfigured::forCurrentEnvironment();
        }

        $modelClass = $this->userModelClass();

        return $modelClass::query()
            ->get()
            ->filter(fn (Model $user) => filled($user->getAttribute('email')))
            ->map(fn (Model $user) => [
                'id' => (string) $user->getKey(),
                'name' => $this->displayName($user),
                'email' => (string) $user->getAttribute('email'),
            ])
            ->when(
                filled($search),
                fn ($users) => $users->filter(function (array $user) use ($search) {
                    $needle = Str::lower(trim((string) $search));
                    $haystack = Str::lower(implode(' ', [$user['name'], $user['email']]));

                    return Str::contains($haystack, $needle);
                })
            )
            ->values()
            ->all();
    }

    /**
     * @return class-string<Model>
     */
    protected function userModelClass(): string
    {
        $guard = (string) config('auth.defaults.guard', 'web');
        $provider = (string) config("auth.guards.{$guard}.provider", 'users');
        $modelClass = config("auth.providers.{$provider}.model");

        if (! is_string($modelClass) || ! is_subclass_of($modelClass, Model::class)) {
            throw new \RuntimeException('SHIFT could not determine the application user model for local collaborator lookup.');
        }

        return $modelClass;
    }

    protected function displayName(Model $user): string
    {
        $name = trim((string) $user->getAttribute('name'));

        if ($name !== '') {
            return $name;
        }

        $firstName = trim((string) $user->getAttribute('first_name'));
        $lastName = trim((string) $user->getAttribute('last_name'));
        $fullName = trim("{$firstName} {$lastName}");

        return $fullName !== '' ? $fullName : (string) $user->getAttribute('email');
    }
}
