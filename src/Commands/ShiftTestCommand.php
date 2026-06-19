<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ShiftTestCommand extends Command
{
    protected $signature = 'shift:test';

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

        $this->warn('This command creates a real QA task in your configured SHIFT project.');
        $this->line("Creating a QA task in SHIFT project {$project} from {$appUrl}.");

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
