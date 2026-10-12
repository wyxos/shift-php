<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Wyxos\Shift\Support\ShiftErrorReporter;

class ShiftTestCommand extends Command
{
    protected $signature = 'shift:test {--error : Send a safe sample through automatic error reporting instead of creating an API QA task.}';

    protected $description = 'Create a QA task in SHIFT to verify SDK configuration.';

    /**
     * @throws ConnectionException
     */
    public function handle(): int
    {
        $missing = $this->missingConfiguration();

        if ($missing !== []) {
            $this->error('SHIFT is not fully configured. Run php artisan install:shift first.');
            $this->line('Missing: '.implode(', ', $missing));

            return self::FAILURE;
        }

        $token = trim((string) config('shift.token'));
        $baseUrl = rtrim(trim((string) config('shift.url')), '/');
        $project = trim((string) config('shift.project'));
        $appUrl = rtrim(trim((string) config('app.url')), '/');
        $environment = trim((string) config('app.env', ''));

        if ((bool) $this->option('error')) {
            if (! (bool) config('shift.errors.enabled', true)) {
                $this->error('Automatic error reporting is disabled. Set SHIFT_ERROR_REPORTING_ENABLED=true and clear cached config before testing.');

                return self::FAILURE;
            }

            $this->warn('This command sends a safe sample error to your configured SHIFT project.');

            $result = app(ShiftErrorReporter::class)->reportThrowableWithResult(new RuntimeException('SHIFT automatic error reporting QA sample'));

            if ($result === null) {
                $this->error('SHIFT did not accept the sample error. Check the URL, credentials, project and environment settings.');

                return self::FAILURE;
            }

            $this->info('SHIFT accepted the sample automatic error report.');

            if ($result['id'] !== null) {
                $this->line('Open the resulting task: '.$baseUrl.'/tasks?task='.$result['id']);
            } else {
                $this->warn('SHIFT did not return a task ID.');
                $this->line('Open '.$baseUrl.'/connect, then select the configured project to find the latest automatic error report.');
            }

            return self::SUCCESS;
        }

        $this->warn('This command creates a real QA task in your configured SHIFT project.');
        $this->line("Creating an API QA task from {$appUrl}.");

        $response = Http::withToken($token)
            ->acceptJson()
            ->post($baseUrl.'/api/tasks', [
                'metadata' => [
                    'url' => $appUrl,
                    'environment' => $environment,
                ],
                'project' => $project,
                'title' => 'SHIFT SDK QA task',
                'description' => "Verify that the embedded SHIFT client can submit tasks from {$appUrl}.",
            ]);

        if ($response->successful()) {
            $payload = $response->json();
            $id = data_get($payload, 'id') ?? data_get($payload, 'data.id');
            $title = data_get($payload, 'title') ?? data_get($payload, 'data.title');
            $reference = trim(implode(' ', array_filter([
                $id !== null ? "#{$id}" : null,
                is_string($title) ? $title : null,
            ])));

            $this->info('QA task created successfully'.($reference !== '' ? ": {$reference}" : '.'));

            if ($id !== null) {
                $this->line('Open this QA task: '.$baseUrl.'/tasks?task='.rawurlencode((string) $id));
            }

            $this->line('This API QA task does not verify the Feedback widget or automatic error reporting.');

            return self::SUCCESS;
        }

        $payload = $response->json();
        $message = data_get($payload, 'error')
            ?? data_get($payload, 'message')
            ?? Str::limit($response->body(), 500);

        $this->error("Failed to create QA task ({$response->status()}): {$message}");

        return self::FAILURE;
    }

    private function missingConfiguration(): array
    {
        return collect([
            'SHIFT_URL' => config('shift.url'),
            'SHIFT_TOKEN' => config('shift.token'),
            'SHIFT_PROJECT' => config('shift.project'),
            'APP_URL' => config('app.url'),
            'APP_ENV' => config('app.env'),
        ])
            ->filter(fn ($value): bool => trim((string) $value) === '')
            ->keys()
            ->all();
    }
}
