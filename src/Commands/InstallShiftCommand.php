<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class InstallShiftCommand extends Command
{
    protected $signature = 'install:shift';

    protected $description = 'Install and configure SHIFT SDK.';

    public function handle(): int
    {
        $this->info('Starting SHIFT installation...');

        $token = $this->resolveCredential('shift.token', 'Enter your SHIFT API token');
        $project = $this->resolveCredential('shift.project', 'Enter your SHIFT project token');
        $resolver = (string) config('shift.collaborators.resolver', 'App\\Services\\ShiftCollaboratorResolver');

        $this->writeEnv([
            'SHIFT_TOKEN' => $token,
            'SHIFT_PROJECT' => $project,
            'SHIFT_COLLABORATORS_RESOLVER' => $resolver !== '' ? $resolver : 'App\\Services\\ShiftCollaboratorResolver',
        ], ['SHIFT_COLLABORATORS_RESOLVER']);

        $environment = trim((string) config('app.env', 'production'));
        $url = rtrim((string) config('app.url', ''), '/');

        if ($environment === '' || $url === '') {
            $this->error('SHIFT installation requires both APP_ENV and APP_URL to be configured.');

            return self::FAILURE;
        }

        $this->line("Detected application environment: <info>{$environment}</info>");
        $this->line("Detected application URL: <info>{$url}</info>");

        if ($this->shouldWarnAboutUrl($url)) {
            $this->warn('This URL looks local or private. External collaborator lookup only works when the active SHIFT instance can reach it.');
        }

        try {
            $this->registerEnvironment($token, $project, $environment, $url);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->ensureResolverExists();

        $this->info('SHIFT installation complete.');

        if ($this->confirm('Would you like to run a test by creating a dummy task?')) {
            $this->call('shift:test');
        }

        // publish assets
        $this->call('vendor:publish', [
            '--tag' => 'shift',
            '--force' => true,
        ]);

        $this->info('Assets published successfully.');

        return self::SUCCESS;
    }

    protected function writeEnv(array $values, array $onlyMissingKeys = []): void
    {
        $envPath = base_path('.env');

        try {
            $envContents = File::exists($envPath) ? File::get($envPath) : '';
        } catch (FileNotFoundException $exception) {
            throw new RuntimeException('Unable to read the application .env file.', previous: $exception);
        }

        foreach ($values as $key => $value) {
            $pattern = "/^{$key}=.*/m";
            $hasExistingValue = preg_match($pattern, $envContents) === 1;
            $formattedValue = $this->formatEnvValue($value);

            if (in_array($key, $onlyMissingKeys, true) && $hasExistingValue) {
                continue;
            }

            if ($hasExistingValue) {
                $envContents = preg_replace($pattern, "{$key}={$formattedValue}", $envContents);
            } else {
                $envContents .= PHP_EOL."{$key}={$formattedValue}";
            }
        }

        File::put($envPath, $envContents);
    }

    private function resolveCredential(string $configKey, string $prompt): string
    {
        $configured = trim((string) config($configKey, ''));

        if ($configured !== '') {
            return $configured;
        }

        return trim((string) $this->ask($prompt));
    }

    private function registerEnvironment(string $token, string $project, string $environment, string $url): void
    {
        $baseUrl = rtrim((string) config('shift.url', 'https://shift.wyxos.com'), '/');
        $request = Http::withToken($token)
            ->acceptJson();

        if ($this->isLocalOrPrivateUrl($baseUrl)) {
            $this->line('SHIFT URL looks local or private. Skipping SSL verification for environment registration.');
            $request = $request->withoutVerifying();
        }

        try {
            $response = $request
                ->post("{$baseUrl}/api/project-environments/register", [
                    'project' => $project,
                    'environment' => $environment,
                    'url' => $url,
                ]);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('SHIFT environment registration failed because SHIFT could not be reached.', previous: $exception);
        }

        if (! $response->successful()) {
            $message = $response->json('message') ?? $response->json('error') ?? 'SHIFT environment registration failed.';

            throw new RuntimeException((string) $message);
        }

        $this->info("Registered {$environment} => {$url} with SHIFT.");
    }

    private function formatEnvValue(string $value): string
    {
        $escaped = str_replace(
            ['\\', '"', "\n", "\r"],
            ['\\\\', '\\"', '\\n', ''],
            $value,
        );

        return "\"{$escaped}\"";
    }

    private function ensureResolverExists(): void
    {
        $resolverPath = app_path('Services/ShiftCollaboratorResolver.php');

        if (File::exists($resolverPath)) {
            return;
        }

        File::ensureDirectoryExists(dirname($resolverPath));

        try {
            $stub = File::get(__DIR__.'/../../stubs/shift-collaborator-resolver.stub');
        } catch (FileNotFoundException $exception) {
            throw new RuntimeException('Unable to scaffold the SHIFT collaborator resolver.', previous: $exception);
        }

        File::put($resolverPath, $stub);

        $this->info('Scaffolded App\\Services\\ShiftCollaboratorResolver.');
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

    private function shouldWarnAboutUrl(string $url): bool
    {
        return $this->isLocalOrPrivateUrl($url);
    }
}
