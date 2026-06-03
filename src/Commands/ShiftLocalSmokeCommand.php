<?php

namespace Wyxos\Shift\Commands;

use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Console\Command;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use JsonException;
use PDO;
use RuntimeException;
use Throwable;

class ShiftLocalSmokeCommand extends Command
{
    protected $signature = 'shift:local-smoke
        {--portal-path= : Path to the local SHIFT portal repository}
        {--portal-database= : Path to the local SHIFT portal SQLite database}
        {--keep-task : Keep the created smoke task instead of deleting it}';

    protected $description = 'Run an opt-in local smoke test through the SHIFT widget and local portal.';

    public function handle(): int
    {
        try {
            $this->ensureLocalConfiguration();

            $databasePath = $this->portalDatabasePath();
            $pdo = $this->pdo($databasePath);
            $this->ensurePortalSchema($pdo, $databasePath);

            $state = $this->enableLocalWidgetSettings($pdo);
            $taskId = null;

            try {
                $taskId = $this->runSmoke($pdo);

                if ($this->option('keep-task')) {
                    $this->warn("Keeping smoke task #{$taskId}.");
                } else {
                    $this->cleanupSmokeTask($pdo, $taskId);
                    $this->info('Cleaned up smoke task.');
                }
            } finally {
                $this->restoreLocalWidgetSettings($pdo, $state);
            }

            $this->info('SHIFT local smoke passed.');

            return self::SUCCESS;
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    private function ensureLocalConfiguration(): void
    {
        if ((string) config('app.env') !== 'local') {
            throw new RuntimeException('shift:local-smoke only runs when APP_ENV=local.');
        }

        if (! (bool) config('shift.widget.enabled', false)) {
            throw new RuntimeException('SHIFT widget is disabled in this application. Set SHIFT_WIDGET_ENABLED=true for the local smoke.');
        }

        foreach ([
            'APP_URL' => $this->appUrl(),
            'SHIFT_URL' => $this->shiftUrl(),
        ] as $label => $url) {
            if (! $this->isLocalOrPrivateUrl($url)) {
                throw new RuntimeException("{$label} must point at a local or private URL for shift:local-smoke.");
            }
        }

        if (! filled(config('shift.token')) || ! filled(config('shift.project'))) {
            throw new RuntimeException('SHIFT_TOKEN and SHIFT_PROJECT must be configured before running the local smoke.');
        }
    }

    private function portalDatabasePath(): string
    {
        $explicitDatabase = trim((string) $this->option('portal-database'));

        if ($explicitDatabase !== '') {
            return $this->absolutePath($explicitDatabase);
        }

        $portalPath = trim((string) $this->option('portal-path'));
        $portalPath = $portalPath !== '' ? $this->absolutePath($portalPath) : base_path('../shift');

        return rtrim($portalPath, DIRECTORY_SEPARATOR).'/database/database.sqlite';
    }

    private function absolutePath(string $path): string
    {
        if (str_starts_with($path, DIRECTORY_SEPARATOR)) {
            return $path;
        }

        return base_path($path);
    }

    private function pdo(string $databasePath): PDO
    {
        if (! is_file($databasePath)) {
            throw new RuntimeException("Local SHIFT portal database was not found at {$databasePath}.");
        }

        $pdo = new PDO('sqlite:'.$databasePath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        return $pdo;
    }

    private function ensurePortalSchema(PDO $pdo, string $databasePath): void
    {
        foreach (['projects', 'project_environments', 'tasks', 'task_metadata'] as $table) {
            if (! $this->hasTable($pdo, $table)) {
                throw new RuntimeException("Local SHIFT portal database is missing the {$table} table.");
            }
        }

        foreach ([
            'projects' => ['external_widget_enabled', 'external_widget_guest_submissions_enabled'],
            'project_environments' => ['external_widget_enabled', 'external_widget_guest_submissions_enabled'],
        ] as $table => $columns) {
            foreach ($columns as $column) {
                if (! $this->hasColumn($pdo, $table, $column)) {
                    throw new RuntimeException(
                        'Local SHIFT portal database is missing environment widget columns. Run `php artisan migrate` in '
                        .$this->portalPathHint($databasePath).' before running the smoke.'
                    );
                }
            }
        }
    }

    /**
     * @return array{
     *     project: array{id: int, external_widget_enabled: int, external_widget_guest_submissions_enabled: int},
     *     environment_exists: bool,
     *     environment: array{id: int, url: string, external_widget_enabled: int, external_widget_guest_submissions_enabled: int}|null
     * }
     */
    private function enableLocalWidgetSettings(PDO $pdo): array
    {
        $project = $this->project($pdo);
        $environment = $this->environment($pdo, (int) $project['id']);
        $now = now()->toDateTimeString();

        $statement = $pdo->prepare('update projects set external_widget_enabled = 1, external_widget_guest_submissions_enabled = 1, updated_at = :now where id = :id');
        $statement->execute([
            'id' => (int) $project['id'],
            'now' => $now,
        ]);

        if ($environment) {
            $statement = $pdo->prepare('update project_environments set url = :url, external_widget_enabled = 1, external_widget_guest_submissions_enabled = 1, updated_at = :now where id = :id');
            $statement->execute([
                'id' => (int) $environment['id'],
                'url' => $this->appUrl(),
                'now' => $now,
            ]);
        } else {
            $statement = $pdo->prepare('insert into project_environments (project_id, environment, url, external_widget_enabled, external_widget_guest_submissions_enabled, created_at, updated_at) values (:project_id, :environment, :url, 1, 1, :now, :now)');
            $statement->execute([
                'project_id' => (int) $project['id'],
                'environment' => $this->environmentName(),
                'url' => $this->appUrl(),
                'now' => $now,
            ]);
        }

        return [
            'project' => $project,
            'environment_exists' => (bool) $environment,
            'environment' => $environment,
        ];
    }

    /**
     * @param  array{
     *      project: array{id: int, external_widget_enabled: int, external_widget_guest_submissions_enabled: int},
     *      environment_exists: bool,
     *      environment: array{id: int, url: string, external_widget_enabled: int, external_widget_guest_submissions_enabled: int}|null
     *  }  $state
     */
    private function restoreLocalWidgetSettings(PDO $pdo, array $state): void
    {
        $now = now()->toDateTimeString();
        $project = $state['project'];

        $statement = $pdo->prepare('update projects set external_widget_enabled = :enabled, external_widget_guest_submissions_enabled = :guest, updated_at = :now where id = :id');
        $statement->execute([
            'id' => (int) $project['id'],
            'enabled' => (int) $project['external_widget_enabled'],
            'guest' => (int) $project['external_widget_guest_submissions_enabled'],
            'now' => $now,
        ]);

        if (! $state['environment_exists']) {
            $statement = $pdo->prepare('delete from project_environments where project_id = :project_id and environment = :environment');
            $statement->execute([
                'project_id' => (int) $project['id'],
                'environment' => $this->environmentName(),
            ]);

            return;
        }

        $environment = $state['environment'];

        if (! $environment) {
            return;
        }

        $statement = $pdo->prepare('update project_environments set url = :url, external_widget_enabled = :enabled, external_widget_guest_submissions_enabled = :guest, updated_at = :now where id = :id');
        $statement->execute([
            'id' => (int) $environment['id'],
            'url' => $environment['url'],
            'enabled' => (int) $environment['external_widget_enabled'],
            'guest' => (int) $environment['external_widget_guest_submissions_enabled'],
            'now' => $now,
        ]);
    }

    private function runSmoke(PDO $pdo): int
    {
        $cookieJar = new CookieJar;
        $htmlClient = $this->localHttpClient($cookieJar, false);
        $jsonClient = $this->localHttpClient($cookieJar, true);

        $widgetConfig = $this->loadInjectedWidgetConfig($htmlClient);
        $this->assertWidgetConfigEndpoint($jsonClient, $widgetConfig);

        $title = 'SHIFT local smoke '.now()->format('YmdHis').' '.Str::random(6);
        $description = 'Repeatable local smoke task created by shift:local-smoke.';
        $pageUrl = $this->appUrl().'/__shift-local-smoke';

        $response = $jsonClient
            ->withHeaders(['X-CSRF-TOKEN' => (string) data_get($widgetConfig, 'csrfToken')])
            ->post($this->endpointUrl((string) data_get($widgetConfig, 'endpoints.tasks')), [
                'kind' => 'issue',
                'title' => $title,
                'description' => $description,
                'anonymous' => true,
                'metadata' => [
                    'environment' => $this->environmentName(),
                    'page_url' => $pageUrl,
                    'page_title' => 'SHIFT local smoke',
                    'referrer' => null,
                ],
            ]);

        if ($response->status() !== 201) {
            throw new RuntimeException($this->responseMessage($response->json(), 'SHIFT widget task submission failed.', $response->status()));
        }

        $taskId = (int) $response->json('id');

        if ($taskId <= 0) {
            throw new RuntimeException('SHIFT widget task submission did not return a task id.');
        }

        $this->verifySmokeTask($pdo, $taskId, $title, $pageUrl);
        $this->info("Created smoke task #{$taskId} through ".$this->appUrl().'.');

        return $taskId;
    }

    private function loadInjectedWidgetConfig(PendingRequest $client): array
    {
        $response = $client->get($this->appUrl());

        if (! $response->successful()) {
            throw new RuntimeException('Failed to load local consumer app at '.$this->appUrl().'.');
        }

        $html = $response->body();

        if (! preg_match('/window\.shiftWidgetConfig\s*=\s*(\{.*?\});/s', $html, $matches)) {
            throw new RuntimeException('SHIFT widget loader was not injected into the local consumer app. Run `npm run build:shift` and `php artisan shift:publish --group=public`, then retry.');
        }

        try {
            $config = json_decode($matches[1], true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('SHIFT widget loader config was not valid JSON.', previous: $exception);
        }

        if (! is_array($config) || ! filled(data_get($config, 'csrfToken')) || ! filled(data_get($config, 'endpoints.config')) || ! filled(data_get($config, 'endpoints.tasks'))) {
            throw new RuntimeException('SHIFT widget loader config is missing CSRF or endpoint details.');
        }

        return $config;
    }

    private function assertWidgetConfigEndpoint(PendingRequest $client, array $widgetConfig): void
    {
        $response = $client->get($this->endpointUrl((string) data_get($widgetConfig, 'endpoints.config')));

        if (! $response->successful()) {
            throw new RuntimeException($this->responseMessage($response->json(), 'SHIFT widget config endpoint failed.', $response->status()));
        }

        if (! (bool) $response->json('widget_enabled')) {
            throw new RuntimeException('SHIFT widget config endpoint reports widget_enabled=false.');
        }

        if (! (bool) $response->json('guest_submissions_enabled')) {
            throw new RuntimeException('SHIFT widget config endpoint reports guest_submissions_enabled=false.');
        }
    }

    private function verifySmokeTask(PDO $pdo, int $taskId, string $title, string $pageUrl): void
    {
        $statement = $pdo->prepare(
            'select tasks.id, tasks.title, task_metadata.environment, task_metadata.url, task_metadata.source, task_metadata.intake_type
            from tasks
            left join task_metadata on task_metadata.task_id = tasks.id
            where tasks.id = :id
            limit 1'
        );
        $statement->execute(['id' => $taskId]);
        $task = $statement->fetch(PDO::FETCH_ASSOC);

        if (! $task) {
            throw new RuntimeException("Smoke task #{$taskId} was not found in the local SHIFT portal database.");
        }

        foreach ([
            'title' => $title,
            'environment' => $this->environmentName(),
            'url' => $pageUrl,
            'source' => 'embedded_widget',
            'intake_type' => 'issue',
        ] as $field => $expected) {
            if (($task[$field] ?? null) !== $expected) {
                throw new RuntimeException("Smoke task #{$taskId} has unexpected {$field} metadata.");
            }
        }
    }

    private function cleanupSmokeTask(PDO $pdo, int $taskId): void
    {
        $statement = $pdo->prepare('delete from task_metadata where task_id = :task_id');
        $statement->execute(['task_id' => $taskId]);

        $statement = $pdo->prepare('delete from tasks where id = :task_id');
        $statement->execute(['task_id' => $taskId]);
    }

    private function localHttpClient(CookieJar $cookieJar, bool $json): PendingRequest
    {
        $request = Http::withOptions(['cookies' => $cookieJar]);

        if ($json) {
            $request = $request->acceptJson()->asJson();
        }

        if ($this->isLocalOrPrivateUrl($this->appUrl())) {
            $request = $request->withoutVerifying();
        }

        return $request;
    }

    private function project(PDO $pdo): array
    {
        $statement = $pdo->prepare('select id, external_widget_enabled, external_widget_guest_submissions_enabled from projects where token = :token limit 1');
        $statement->execute(['token' => (string) config('shift.project')]);
        $project = $statement->fetch(PDO::FETCH_ASSOC);

        if (! $project) {
            throw new RuntimeException('No local SHIFT project matches the configured SHIFT_PROJECT.');
        }

        return [
            'id' => (int) $project['id'],
            'external_widget_enabled' => (int) $project['external_widget_enabled'],
            'external_widget_guest_submissions_enabled' => (int) $project['external_widget_guest_submissions_enabled'],
        ];
    }

    private function environment(PDO $pdo, int $projectId): ?array
    {
        $statement = $pdo->prepare('select id, url, external_widget_enabled, external_widget_guest_submissions_enabled from project_environments where project_id = :project_id and environment = :environment limit 1');
        $statement->execute([
            'project_id' => $projectId,
            'environment' => $this->environmentName(),
        ]);
        $environment = $statement->fetch(PDO::FETCH_ASSOC);

        if (! $environment) {
            return null;
        }

        return [
            'id' => (int) $environment['id'],
            'url' => (string) $environment['url'],
            'external_widget_enabled' => (int) $environment['external_widget_enabled'],
            'external_widget_guest_submissions_enabled' => (int) $environment['external_widget_guest_submissions_enabled'],
        ];
    }

    private function hasTable(PDO $pdo, string $table): bool
    {
        $statement = $pdo->prepare('select name from sqlite_master where type = "table" and name = :table limit 1');
        $statement->execute(['table' => $table]);

        return (bool) $statement->fetchColumn();
    }

    private function hasColumn(PDO $pdo, string $table, string $column): bool
    {
        $columns = $pdo->query("pragma table_info({$table})")->fetchAll(PDO::FETCH_ASSOC);

        foreach ($columns as $schemaColumn) {
            if (($schemaColumn['name'] ?? null) === $column) {
                return true;
            }
        }

        return false;
    }

    private function endpointUrl(string $endpoint): string
    {
        if (Str::startsWith($endpoint, ['http://', 'https://'])) {
            return $endpoint;
        }

        return $this->appUrl().'/'.ltrim($endpoint, '/');
    }

    private function responseMessage(mixed $payload, string $fallback, int $status): string
    {
        $message = is_array($payload) ? ($payload['message'] ?? $payload['error'] ?? null) : null;
        $message = is_string($message) && trim($message) !== '' ? $message : $fallback;

        return "{$message} HTTP {$status}.";
    }

    private function appUrl(): string
    {
        return rtrim((string) config('app.url'), '/');
    }

    private function shiftUrl(): string
    {
        return rtrim((string) config('shift.url'), '/');
    }

    private function environmentName(): string
    {
        return Str::of((string) config('app.env'))
            ->trim()
            ->lower()
            ->replace(' ', '-')
            ->toString();
    }

    private function portalPathHint(string $databasePath): string
    {
        return dirname(dirname($databasePath));
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
