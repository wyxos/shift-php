<?php

namespace Wyxos\Shift;

use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

class ShiftTestCommand extends Command
{
    protected $signature = 'shift:test';

    protected $description = 'Test SHIFT SDK by creating a dummy task.';

    /**
     * @throws ConnectionException
     */
    public function handle()
    {
        $projectApiToken = config('shift.project_api_token');
        $baseUrl = config('shift.url');

        $response = Http::withToken($projectApiToken)
            ->acceptJson()
            ->post($baseUrl . '/api/tasks', [
                'name' => 'Test Task',
                'description' => 'This is a test task created by the installer'
            ]);

        if ($response->successful()) {
            $this->info('Test task created successfully.');
        } else {
            $this->error('Failed to create test task: ' . $response->body());
        }
    }
}
