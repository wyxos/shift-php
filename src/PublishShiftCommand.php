<?php

namespace Wyxos\Shift;

use Illuminate\Console\Command;

class PublishShiftCommand extends Command
{
    protected $signature = 'shift:publish';

    protected $description = 'Publish SHIFT SDK assets.';

    public function handle()
    {
        $this->call('vendor:publish', [
            '--tag' => 'shift',
            '--force' => true,
        ]);

        $this->info('SHIFT assets published successfully.');
    }
}
