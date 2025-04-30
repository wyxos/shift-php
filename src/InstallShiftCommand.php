<?php

namespace Wyxos\Shift;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class InstallShiftCommand extends Command
{
    protected $signature = 'install:shift';

    protected $description = 'Install and configure SHIFT SDK.';

    public function handle()
    {
        $this->info('Starting SHIFT installation...');

        $apiKey = config('services.shift.api_token');

        if (!$apiKey) {
            // Prompt for API key
            $apiKey = $this->ask('Enter your SHIFT API key');

            // Save API key immediately
            $this->writeEnv([
                'SHIFT_API_KEY' => $apiKey
            ]);
        }

        $projectId = config('services.shift.project_id');

        if (!$projectId) {
            $projectId = $this->getProjectId();

            // Save project ID
            $this->writeEnv([
                'SHIFT_PROJECT_ID' => $projectId
            ]);
        }

        $this->info('SHIFT installation complete.');

        if ($this->confirm('Would you like to run a test by creating a dummy task?', false)) {
            $this->call('shift:test');
        }
    }

    protected function fetchProjects(string $search): array
    {
        try {
            $token = config('services.shift.api_token');

            $baseUrl = config('services.shift.url');

            $url = $baseUrl . '/api/projects';

            $response = Http::withToken($token)
                ->acceptJson()
                ->get($url, [
                    'search' => $search
                ]);

            $data = $response->json();

            return $data['data'] ?? [];
        } catch (\Exception $e) {
            $this->error('Failed to fetch projects: ' . $e->getMessage());
            return [];
        }
    }

    protected function getProjectId(): string
    {
        // Ask for project type
        $projectType = $this->choice(
            'Is this a new or existing project?',
            ['new', 'existing'],
            'new'
        );

        // Prompt for Project name
        if ($projectType === 'new') {
            return $this->ask('Enter ID for your new project');
        }

        $searchTerm = $this->ask('Search for your project');
        $projects = $this->fetchProjects($searchTerm);

        if (empty($projects)) {
            $this->error('No projects found with that name.');
            return '';
        }

        $projectChoices = collect($projects)->pluck('name')->toArray();
        $selectedName = $this->choice('Select your project', $projectChoices);
        return collect($projects)->firstWhere('name', $selectedName)['id'];
    }

    protected function writeEnv(array $values)
    {
        $envPath = base_path('.env');
        $envContents = file_get_contents($envPath);

        foreach ($values as $key => $value) {
            $pattern = "/^{$key}=.*/m";

            if (preg_match($pattern, $envContents)) {
                $envContents = preg_replace($pattern, "{$key}=\"{$value}\"", $envContents);
            } else {
                $envContents .= PHP_EOL."{$key}=\"{$value}\"";
            }
        }

        file_put_contents($envPath, $envContents);
    }
}
