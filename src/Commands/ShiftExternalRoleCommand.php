<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Str;
use RuntimeException;
use Wyxos\Shift\Contracts\ResolvesShiftCollaborators;
use Wyxos\Shift\Support\ShiftActorContext;

class ShiftExternalRoleCommand extends Command
{
    protected $signature = 'shift:external-role
        {account : Consuming-app user id or email to resolve through SHIFT_COLLABORATORS_RESOLVER.}
        {role : External SHIFT role to assign.}
        {--environment= : SHIFT project environment to link, defaults to the current APP_ENV.}';

    protected $description = 'Link or promote a consuming-app account to an external SHIFT role.';

    public function handle(ShiftActorContext $context): int
    {
        $token = trim((string) config('shift.token', ''));
        $project = trim((string) config('shift.project', ''));

        if ($token === '' || $project === '') {
            $this->error('SHIFT configuration missing. Please install Shift package and configure SHIFT_TOKEN and SHIFT_PROJECT in .env');

            return self::FAILURE;
        }

        $account = trim((string) $this->argument('account'));
        $role = trim((string) $this->argument('role'));

        if (! in_array($role, $context->externalRoles(), true)) {
            $this->error('Invalid external SHIFT role. Expected one of: '.implode(', ', $context->externalRoles()));

            return self::FAILURE;
        }

        try {
            $externalUser = $this->resolveExternalUser($account);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $environment = trim((string) ($this->option('environment') ?? ''));
        if ($environment === '') {
            $environment = (string) config('app.env');
        }

        try {
            $response = $context->client()
                ->put($context->baseUrl().'/api/external-roles', [
                    'project' => $project,
                    'external_user' => $externalUser,
                    'role' => $role,
                    'environment' => $environment,
                    'metadata' => $context->metadataPayload(),
                ]);
        } catch (ConnectionException) {
            $this->error('Failed to reach SHIFT for external role assignment.');

            return self::FAILURE;
        }

        if (! $response->successful()) {
            $message = $response->json('message') ?? $response->json('error') ?? 'SHIFT external role assignment failed.';
            $this->error((string) $message);

            return self::FAILURE;
        }

        $this->components->info("Assigned {$account} to {$role}.");

        return self::SUCCESS;
    }

    /**
     * @return array{id: mixed, name: string, email: string}
     */
    private function resolveExternalUser(string $account): array
    {
        if ($account === '') {
            throw new RuntimeException('A consuming-app account id or email is required.');
        }

        $users = $this->normalizedUsers($this->resolver()->resolve($account));
        $matches = array_values(array_filter(
            $users,
            fn (array $user) => $this->matchesAccount($user, $account)
        ));

        if ($matches === [] && count($users) === 1) {
            return $users[0];
        }

        if ($matches === []) {
            throw new RuntimeException("No consuming-app account matched {$account}.");
        }

        if (count($matches) > 1) {
            throw new RuntimeException("Multiple consuming-app accounts matched {$account}. Use an exact id or email.");
        }

        return $matches[0];
    }

    private function resolver(): ResolvesShiftCollaborators
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

    /**
     * @return array<int, array{id: mixed, name: string, email: string}>
     */
    private function normalizedUsers(iterable $users): array
    {
        $normalized = [];

        foreach ($users as $user) {
            if (! is_array($user)) {
                throw new RuntimeException('SHIFT collaborator resolver returned an invalid user payload.');
            }

            $id = $user['id'] ?? null;
            $name = trim((string) ($user['name'] ?? ''));
            $email = trim((string) ($user['email'] ?? ''));

            if ($id === null || trim((string) $id) === '' || $name === '' || $email === '') {
                throw new RuntimeException('SHIFT collaborator resolver returned an invalid user payload.');
            }

            $normalized[] = [
                'id' => $id,
                'name' => $name,
                'email' => $email,
            ];
        }

        return $normalized;
    }

    /**
     * @param  array{id: mixed, name: string, email: string}  $user
     */
    private function matchesAccount(array $user, string $account): bool
    {
        $normalized = Str::lower($account);

        return Str::lower((string) $user['id']) === $normalized
            || Str::lower($user['email']) === $normalized;
    }
}
