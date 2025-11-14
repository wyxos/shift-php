<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

class ToggleShiftCommand extends Command
{
    protected $signature = 'shift:toggle {--local : Force local mode} {--online : Force online mode} {--path= : Custom path to local SDK package}';

    protected $description = 'Toggle between local and online versions of the SHIFT SDK package in composer.json';

    public function handle()
    {
        $composerPath = base_path('composer.json');

        if (!File::exists($composerPath)) {
            $this->error('composer.json not found in the project root.');
            return Command::FAILURE;
        }

        $composer = json_decode(File::get($composerPath), true);

        if (!$composer) {
            $this->error('Failed to parse composer.json.');
            return Command::FAILURE;
        }

        // Check current state
        $isLocal = $this->isUsingLocal($composer);
        $forceLocal = $this->option('local');
        $forceOnline = $this->option('online');

        if ($forceLocal && $forceOnline) {
            $this->error('Cannot use both --local and --online options.');
            return Command::FAILURE;
        }

        // Determine target state
        $targetLocal = $forceLocal ? true : ($forceOnline ? false : !$isLocal);

        if ($isLocal === $targetLocal) {
            $this->info('Already using ' . ($targetLocal ? 'local' : 'online') . ' version.');
            return Command::SUCCESS;
        }

        if ($targetLocal) {
            $sdkPath = $this->getLocalSdkPath();
            $fullPath = base_path($sdkPath);
            
            if (!File::exists($fullPath . '/composer.json')) {
                $this->error("Local SDK package not found at: {$fullPath}");
                $this->line('');
                $this->line("You can specify a custom path using: --path=/path/to/shift-php");
                return Command::FAILURE;
            }
            
            $this->switchToLocal($composer, $sdkPath);
            $this->info("✓ Switched to local version (path: {$sdkPath})");
        } else {
            $this->switchToOnline($composer);
            $this->info('✓ Switched to online version');
        }

        // Write updated composer.json
        File::put($composerPath, json_encode($composer, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

        $this->line('');
        $this->info('Running composer update...');
        $this->line('');

        // Run composer update
        $process = new Process(['composer', 'update', 'wyxos/shift-php', '--no-interaction'], base_path());
        $process->setTimeout(300); // 5 minute timeout
        $process->run(function ($type, $buffer) {
            $this->output->write($buffer);
        });

        if ($process->isSuccessful()) {
            $this->line('');
            $this->info('✓ Successfully switched to ' . ($targetLocal ? 'local' : 'online') . ' version!');
            return Command::SUCCESS;
        } else {
            $this->line('');
            $this->error('Composer update failed. Please review the output above.');
            return Command::FAILURE;
        }
    }

    /**
     * Check if composer.json is currently using local path repository.
     */
    private function isUsingLocal(array $composer): bool
    {
        if (!isset($composer['repositories'])) {
            return false;
        }

        foreach ($composer['repositories'] as $repo) {
            if (isset($repo['type']) && $repo['type'] === 'path') {
                if (isset($repo['url']) && str_contains($repo['url'], 'shift-php')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Switch composer.json to use local path repository.
     */
    private function switchToLocal(array &$composer, string $sdkPath): void
    {
        // Update version constraint
        if (isset($composer['require']['wyxos/shift-php'])) {
            $composer['require']['wyxos/shift-php'] = '@dev';
        }

        // Ensure repositories array exists
        if (!isset($composer['repositories'])) {
            $composer['repositories'] = [];
        }

        // Check if path repository already exists
        $pathRepoExists = false;
        foreach ($composer['repositories'] as $index => $repo) {
            if (isset($repo['type']) && $repo['type'] === 'path' && isset($repo['url']) && str_contains($repo['url'], 'shift-php')) {
                // Update existing path repository
                $composer['repositories'][$index]['url'] = $sdkPath;
                $pathRepoExists = true;
                break;
            }
        }

        // Add path repository if it doesn't exist
        if (!$pathRepoExists) {
            $composer['repositories'][] = [
                'type' => 'path',
                'url' => $sdkPath,
                'options' => [
                    'symlink' => true,
                ],
            ];
        }
    }

    /**
     * Switch composer.json to use online package.
     */
    private function switchToOnline(array &$composer): void
    {
        // Update version constraint
        if (isset($composer['require']['wyxos/shift-php'])) {
            $composer['require']['wyxos/shift-php'] = '^1.1';
        }

        // Remove path repository for shift-php
        if (isset($composer['repositories'])) {
            $composer['repositories'] = array_filter(
                $composer['repositories'],
                function ($repo) {
                    if (isset($repo['type']) && $repo['type'] === 'path' && isset($repo['url'])) {
                        return !str_contains($repo['url'], 'shift-php');
                    }
                    return true;
                }
            );

            // Re-index array
            $composer['repositories'] = array_values($composer['repositories']);

            // Remove repositories key if empty
            if (empty($composer['repositories'])) {
                unset($composer['repositories']);
            }
        }
    }

    /**
     * Get the path to the local SDK package.
     */
    private function getLocalSdkPath(): string
    {
        // Check if custom path is provided
        if ($customPath = $this->option('path')) {
            return $customPath;
        }

        // Try to detect the SDK package location
        // Common locations relative to the consuming app
        $possiblePaths = [
            '../../../wyxos/php/shift-sdk-package/packages/shift-php',
            '../../shift-sdk-package/packages/shift-php',
            '../shift-sdk-package/packages/shift-php',
        ];

        $basePath = base_path();
        foreach ($possiblePaths as $relativePath) {
            $fullPath = $basePath . '/' . $relativePath;
            if (File::exists($fullPath . '/composer.json')) {
                return $relativePath;
            }
        }

        // Default fallback (most common case)
        return '../../../wyxos/php/shift-sdk-package/packages/shift-php';
    }
}

