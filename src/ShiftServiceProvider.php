<?php

namespace Wyxos\Shift;

use Illuminate\Support\ServiceProvider;

class ShiftServiceProvider extends ServiceProvider
{
    public function register()
    {
        // Register package services here (config, bindings, etc.)
    }

    public function boot()
    {
        // Register routes, publish files, commands
//        $this->loadRoutesFrom(__DIR__.'/../routes/shift.php');

        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallShiftCommand::class,
                ShiftTestCommand::class,
            ]);
        }
    }
}
