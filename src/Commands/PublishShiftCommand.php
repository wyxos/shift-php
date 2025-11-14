<?php

namespace Wyxos\Shift\Commands;

use Illuminate\Console\Command;

class PublishShiftCommand extends Command
{
    protected $signature = 'shift:publish {--group=public : The asset group to publish (config, public, all)}';

    protected $description = 'Publish SHIFT SDK assets (config, public assets, or all). Defaults to public assets only.';

    public function handle()
    {
        $group = $this->option('group');

        $validGroups = [
            'config' => 'shift-config',
            'public' => 'shift-assets',
            'all' => 'shift',
        ];

        if (!array_key_exists($group, $validGroups)) {
            $this->error("Invalid group: $group. Choose from config, assets, or all.");
            return Command::INVALID;
        }

        $this->call('vendor:publish', [
            '--tag' => $validGroups[$group],
            '--force' => true,
        ]);

        $this->info("SHIFT {$group} assets published successfully.");
        return Command::SUCCESS;
    }
}
