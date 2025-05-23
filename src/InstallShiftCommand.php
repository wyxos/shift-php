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

        $projectApiToken = config('shift.project_api_token');

        if (!$projectApiToken) {
            // Prompt for project API token
            $projectApiToken = $this->ask('Enter your SHIFT project API token');

            // Save project API token immediately
            $this->writeEnv([
                'SHIFT_PROJECT_API_TOKEN' => $projectApiToken
            ]);
        }

        $this->info('SHIFT installation complete.');

        if ($this->confirm('Would you like to run a test by creating a dummy task?', false)) {
            $this->call('shift:test');
        }

        // publish assets
        $this->call('vendor:publish', [
            '--tag' => 'shift',
            '--force' => true,
        ]);

        $this->info('Assets published successfully.');
    }

    // The fetchProjects and getProjectId methods are no longer needed since we're using project_api_token directly

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
