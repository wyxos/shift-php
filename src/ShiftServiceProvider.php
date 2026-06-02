<?php

namespace Wyxos\Shift;

use Illuminate\Foundation\Http\Kernel as HttpKernel;
use Illuminate\Support\ServiceProvider;
use Wyxos\Shift\Commands\InstallShiftCommand;
use Wyxos\Shift\Commands\PublishShiftCommand;
use Wyxos\Shift\Commands\ShiftTestCommand;
use Wyxos\Shift\Commands\ToggleShiftCommand;
use Wyxos\Shift\Http\Middleware\InjectShiftWidget;

class ShiftServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__.'/../config/shift.php', 'shift'
        );

        $this->callAfterResolving(HttpKernel::class, function (HttpKernel $kernel) {
            $kernel->appendMiddlewareToGroup('web', InjectShiftWidget::class);
        });

    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'shift');

        $this->loadRoutesFrom(__DIR__.'/../routes/shift.php');

        // Publish public assets separately
        $this->publishes([
            __DIR__.'/../public' => public_path(''),
        ], 'shift-assets');

        // Publish config separately
        $this->publishes([
            __DIR__.'/../config/shift.php' => config_path('shift.php'),
        ], 'shift-config');

        // Combined group for convenience
        $this->publishes([
            __DIR__.'/../public' => public_path(''),
            __DIR__.'/../config/shift.php' => config_path('shift.php'),
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
