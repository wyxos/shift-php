<?php

namespace Wyxos\Shift;

use Illuminate\Support\ServiceProvider;
use Wyxos\Shift\Commands\InstallShiftCommand;
use Wyxos\Shift\Commands\PublishShiftCommand;
use Wyxos\Shift\Commands\ShiftTestCommand;
use Wyxos\Shift\Commands\ToggleShiftCommand;

class ShiftServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__ . '/../config/shift.php', 'shift'
        );
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__ . '/../routes/shift.php');

        // Publish public assets separately
        $this->publishes([
            __DIR__ . '/../public' => public_path(''),
        ], 'shift-assets');

        // Publish config separately
        $this->publishes([
            __DIR__ . '/../config/shift.php' => config_path('shift.php'),
        ], 'shift-config');

        // Combined group for convenience
        $this->publishes([
            __DIR__ . '/../public' => public_path(''),
            __DIR__ . '/../config/shift.php' => config_path('shift.php'),
        ], 'shift');

        if ($this->app->runningInConsole()) {
            $this->commands([
                InstallShiftCommand::class,
                ShiftTestCommand::class,
                PublishShiftCommand::class,
                ToggleShiftCommand::class,
            ]);
        }
    }
}
