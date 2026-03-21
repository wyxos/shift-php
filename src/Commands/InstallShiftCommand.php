<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Wyxos\Shift\Support\InstallSessionClient;

class InstallShiftCommand extends Command
{
    private const DEFAULT_INSTALL_SESSION_TIMEOUT_SECONDS = 600;

    private bool $environmentRegisteredDuringCredentialResolution = false;

    protected $signature = 'install:shift
        {--manual : Prompt for raw SHIFT credentials instead of using browser verification.}';

    protected $description = 'Install and configure SHIFT SDK.';

    public function handle(): int
    {
        $this->info('Starting SHIFT installation...');
        $this->environmentRegisteredDuringCredentialResolution = false;

        try {
            [$environment, $url] = $this->resolveApplicationContext();
            [$token, $project] = $this->resolveCredentials($environment, $url);
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $resolver = trim((string) config('shift.collaborators.resolver', 'App\\Services\\ShiftCollaboratorResolver'));
        $resolverClass = $resolver !== '' ? $resolver : 'App\\Services\\ShiftCollaboratorResolver';

        $this->writeEnv([
            'SHIFT_TOKEN' => $token,
            'SHIFT_PROJECT' => $project,
            'SHIFT_COLLABORATORS_RESOLVER' => $resolverClass,
        ], ['SHIFT_COLLABORATORS_RESOLVER']);

        config([
            'shift.token' => $token,
            'shift.project' => $project,
            'shift.collaborators.resolver' => $resolverClass,
        ]);

        if (! $this->environmentRegisteredDuringCredentialResolution) {
            try {
                $this->registerEnvironment($token, $project, $environment, $url);
            } catch (RuntimeException $exception) {
                $this->error($exception->getMessage());

                return self::FAILURE;
            }
        } else {
            $this->info("Registered {$environment} => {$url} with SHIFT.");
        }

        $this->ensureResolverExists();

        $this->info('SHIFT installation complete.');

        if ($this->confirm('Would you like to run a test by creating a dummy task?')) {
            $this->call('shift:test');
        }

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

    private function resolveApplicationContext(): array
    {
        $environment = trim((string) config('app.env', ''));
        $url = rtrim(trim((string) config('app.url', '')), '/');

        if ($environment === '') {
            throw new RuntimeException('SHIFT installation requires APP_ENV to be configured.');
        }

        if ($url === '') {
            throw new RuntimeException('SHIFT installation requires APP_URL to be configured.');
        }

        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw new RuntimeException('SHIFT installation requires APP_URL to be a valid URL.');
        }

        $this->line("Detected application environment: <info>{$environment}</info>");
        $this->line("Detected application URL: <info>{$url}</info>");

        if ($this->shouldWarnAboutUrl($url)) {
            $this->warn('This URL looks local or private. External collaborator lookup only works when the active SHIFT instance can reach it.');
        }

        return [$environment, $url];
    }

    private function resolveCredentials(string $environment, string $url): array
    {
        $configuredToken = trim((string) config('shift.token', ''));
        $configuredProject = trim((string) config('shift.project', ''));

        if ($configuredToken !== '' && $configuredProject !== '') {
            $this->line('Existing SHIFT credentials detected. Skipping browser verification.');

            return [$configuredToken, $configuredProject];
        }

        if ((bool) $this->option('manual')) {
            $this->line('Using manual SHIFT credential entry.');

            return $this->resolveManualCredentials($configuredToken, $configuredProject);
        }

        if ($configuredToken !== '' || $configuredProject !== '') {
            $this->warn('SHIFT is partially configured. Continuing with browser verification to complete installation.');
        }

        if (! $this->input->isInteractive()) {
            throw new RuntimeException('SHIFT installation needs an interactive terminal for browser verification. Re-run with --manual after obtaining a raw SHIFT token and project token.');
        }

        return $this->resolveInstallSessionCredentials($environment, $url);
    }

    private function resolveManualCredentials(string $configuredToken, string $configuredProject): array
    {
        $token = $configuredToken !== ''
            ? $configuredToken
            : trim((string) $this->secret('Enter your SHIFT API token'));

        $project = $configuredProject !== ''
            ? $configuredProject
            : trim((string) $this->secret('Enter your SHIFT project token'));

        if ($token === '' || $project === '') {
            throw new RuntimeException('Both a SHIFT API token and project token are required to complete manual installation.');
        }

        return [$token, $project];
    }

    private function resolveInstallSessionCredentials(string $environment, string $url): array
    {
        $baseUrl = $this->shiftBaseUrl();
        $skipSslVerification = $this->isLocalOrPrivateUrl($baseUrl);
        $client = new InstallSessionClient($baseUrl, $skipSslVerification);

        if ($skipSslVerification) {
            $this->line('SHIFT URL looks local or private. Skipping SSL verification for install session requests.');
        }

        $session = $client->create([
            'environment' => $environment,
            'url' => $url,
        ]);

        $verificationUrl = $session['verification_url'] ?? null;
        $shortCode = $session['short_code'] ?? null;

        if (! is_string($verificationUrl) || $verificationUrl === '' || ! is_string($shortCode) || $shortCode === '') {
            throw new RuntimeException('SHIFT install session response did not include a verification URL and short code.');
        }

        $this->newLine();
        $this->info('Verify this installation in your browser to continue.');
        $this->line("Verification URL: <info>{$verificationUrl}</info>");
        $this->line("Short code: <comment>{$shortCode}</comment>");

        if (isset($session['expires_at']) && is_string($session['expires_at']) && $session['expires_at'] !== '') {
            $this->line("Session expires at: <info>{$session['expires_at']}</info>");
        }

        $this->newLine();
        $this->line('Waiting for SHIFT approval...');

        $session = $this->waitForInstallSessionApproval($client, $session);
        $projects = $client->projects($session);
        $selectedProject = $this->chooseInstallableProject($projects);
        $credentials = $client->finalize($session, $selectedProject);

        $this->environmentRegisteredDuringCredentialResolution = true;
        $this->info('SHIFT authorization approved.');

        return [$credentials['token'], $credentials['project']];
    }

    private function waitForInstallSessionApproval(InstallSessionClient $client, array $session): array
    {
        $startedAt = time();
        $deadline = $this->installSessionDeadline($session);

        if ($this->isApprovedInstallSessionStatus($session['status'] ?? null)) {
            return $session;
        }

        if ($this->isFailedInstallSessionStatus($session['status'] ?? null)) {
            throw new RuntimeException($this->installSessionFailureMessage($session['status'] ?? null));
        }

        while (true) {
            if ($deadline !== null && time() >= $deadline) {
                throw new RuntimeException('The SHIFT install session expired before it was approved.');
            }

            if ($deadline === null && (time() - $startedAt) >= self::DEFAULT_INSTALL_SESSION_TIMEOUT_SECONDS) {
                throw new RuntimeException('Timed out waiting for the SHIFT install session to be approved.');
            }

            sleep(max(1, (int) ($session['poll_interval'] ?? 3)));

            $session = $client->poll($session);
            $deadline = $this->installSessionDeadline($session) ?? $deadline;

            if ($this->isApprovedInstallSessionStatus($session['status'] ?? null)) {
                return $session;
            }

            if ($this->isFailedInstallSessionStatus($session['status'] ?? null)) {
                throw new RuntimeException($this->installSessionFailureMessage($session['status'] ?? null));
            }
        }
    }

    private function chooseInstallableProject(array $projects): array
    {
        $options = [];
        $projectsByOption = [];

        foreach (array_values($projects) as $index => $project) {
            $label = sprintf('[%d] %s', $index + 1, $project['label']);
            $options[] = $label;
            $projectsByOption[$label] = $project;
        }

        $selection = $this->choice('Select which SHIFT project to link to this application', $options, 0);

        return $projectsByOption[$selection] ?? $projects[0];
    }

    private function isApprovedInstallSessionStatus(?string $status): bool
    {
        return in_array(Str::lower((string) $status), [
            'approved',
            'authorized',
            'verified',
            'ready',
            'complete',
            'completed',
        ], true);
    }

    private function isFailedInstallSessionStatus(?string $status): bool
    {
        return in_array(Str::lower((string) $status), [
            'expired',
            'denied',
            'rejected',
            'cancelled',
            'canceled',
            'failed',
        ], true);
    }

    private function installSessionFailureMessage(?string $status): string
    {
        return match (Str::lower((string) $status)) {
            'expired' => 'The SHIFT install session expired before it was approved.',
            'denied', 'rejected' => 'The SHIFT install session was denied. Start the installer again and approve the request in SHIFT.',
            'cancelled', 'canceled' => 'The SHIFT install session was cancelled before it completed.',
            'failed' => 'The SHIFT install session failed before it completed.',
            default => 'The SHIFT install session could not be completed.',
        };
    }

    private function installSessionDeadline(array $session): ?int
    {
        $expiresAt = $session['expires_at'] ?? null;

        if (! is_string($expiresAt) || $expiresAt === '') {
            return null;
        }

        $timestamp = strtotime($expiresAt);

        return $timestamp === false ? null : $timestamp;
    }

    private function registerEnvironment(string $token, string $project, string $environment, string $url): void
    {
        $baseUrl = $this->shiftBaseUrl();
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

    private function shiftBaseUrl(): string
    {
        return rtrim((string) config('shift.url', 'https://shift.wyxos.com'), '/');
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
