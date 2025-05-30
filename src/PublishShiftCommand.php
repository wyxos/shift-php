<?php

namespace Wyxos\Shift;

use Illuminate\Console\Command;

class PublishShiftCommand extends Command
{
    protected $signature = 'shift:publish {--group=all : The asset group to publish (config, assets, all)}';

    protected $description = 'Publish SHIFT SDK assets (config, assets, or all).';

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
