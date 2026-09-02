<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class PublishShiftCommand extends Command
{
    protected $signature = 'shift:publish
        {--group=public : The asset group to publish (config, public, all)}
        {--prune : Remove published public assets that are no longer provided by SHIFT}';

    protected $description = 'Publish SHIFT SDK assets (config, public assets, or all). Defaults to public assets only.';

    public function handle()
    {
        $group = $this->option('group');

        $validGroups = [
            'config' => 'shift-config',
            'public' => 'shift-assets',
            'all' => 'shift',
        ];

        if (! array_key_exists($group, $validGroups)) {
            $this->error("Invalid group: $group. Choose from config, assets, or all.");

            return Command::INVALID;
        }

        if ($this->option('prune') && $group === 'config') {
            $this->error('The --prune option is only available for the public and all groups.');

            return Command::INVALID;
        }

        $exitCode = $this->call('vendor:publish', [
            '--tag' => $validGroups[$group],
            '--force' => true,
        ]);

        if ($exitCode !== Command::SUCCESS) {
            return $exitCode;
        }

        if ($this->option('prune')) {
            $prunedAssets = $this->prunePublicAssets();

            $this->info("Pruned {$prunedAssets} obsolete SHIFT public asset(s).");
        }

        $this->info("SHIFT {$group} assets published successfully.");

        return Command::SUCCESS;
    }

    private function prunePublicAssets(): int
    {
        $sourceDirectory = dirname(__DIR__, 2).'/public/shift-assets';
        $destinationDirectory = public_path('shift-assets');

        if (! File::isDirectory($sourceDirectory) || ! File::isDirectory($destinationDirectory)) {
            return 0;
        }

        $sourceFiles = collect(File::allFiles($sourceDirectory, true))
            ->mapWithKeys(fn ($file): array => [$this->relativePath($file->getRelativePathname()) => true])
            ->all();

        $prunedAssets = 0;

        foreach (File::allFiles($destinationDirectory, true) as $file) {
            if (isset($sourceFiles[$this->relativePath($file->getRelativePathname())])) {
                continue;
            }

            if (File::delete($file->getPathname())) {
                $prunedAssets++;
                $this->removeEmptyParentDirectories($file->getPath(), $destinationDirectory);
            }
        }

        return $prunedAssets;
    }

    private function relativePath(string $path): string
    {
        return str_replace('\\', '/', $path);
    }

    private function removeEmptyParentDirectories(string $directory, string $rootDirectory): void
    {
        while ($directory !== $rootDirectory && str_starts_with($directory, $rootDirectory.DIRECTORY_SEPARATOR)) {
            if (! @rmdir($directory)) {
                return;
            }

            $directory = dirname($directory);
        }
    }
}
