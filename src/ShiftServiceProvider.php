<?php

namespace Wyxos\Shift;

use Illuminate\Support\ServiceProvider;

class ShiftServiceProvider extends ServiceProvider
{
    public function register()
    {
        // Register package services here (config, bindings, etc.)
        $this->mergeConfigFrom(
            __DIR__ . '/../config/shift.php', 'shift'
        );
    }

    public function boot()
    {
        $this->publishes([
            __DIR__.'/../resources/js' => resource_path('js/pages/shift'),
            __DIR__ . '/../config/shift.php' => config_path('shift.php')
        ], 'shift');

        // Register routes, publish files, commands
        $this->loadRoutesFrom(__DIR__.'/../routes/shift.php');

        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallShiftCommand::class,
                ShiftTestCommand::class,
            ]);
        }
    }
}
