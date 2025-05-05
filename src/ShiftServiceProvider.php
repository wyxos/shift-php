<?php

namespace Wyxos\Shift;

use Illuminate\Support\ServiceProvider;

class ShiftServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Register package services here (config, bindings, etc.)
        $this->mergeConfigFrom(
            __DIR__ . '/../config/shift.php', 'shift'
        );
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../views/', 'shift');

        // Register routes, publish files, commands
        $this->loadRoutesFrom(__DIR__.'/../routes/shift.php');

        $this->publishes([
            __DIR__.'/../resources' => resource_path('shift'),
            __DIR__ . '/../config/shift.php' => config_path('shift.php'),
        ], 'shift');

        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallShiftCommand::class,
                ShiftTestCommand::class,
            ]);
        }
    }
}
