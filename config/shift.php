<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SHIFT Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains the configuration settings for the SHIFT SDK integration.
    |
    */

    'token' => env('SHIFT_TOKEN'),
    'project' => env('SHIFT_PROJECT'),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),
    'errors' => [
        'enabled' => env('SHIFT_ERROR_REPORTING_ENABLED', true),
        'endpoint' => env('SHIFT_ERROR_REPORTING_ENDPOINT', '/api/errors'),
        'timeout' => env('SHIFT_ERROR_REPORTING_TIMEOUT', 3),
    ],
    'ai' => [
        'enabled' => env('SHIFT_AI_ENABLED', false),
    ],

    'widget' => [
        'enabled' => env('SHIFT_WIDGET_ENABLED', true),

        'auth' => [
            'guard' => env('SHIFT_WIDGET_AUTH_GUARD'),
        ],

        'login' => [
            'credential_field' => env('SHIFT_WIDGET_LOGIN_CREDENTIAL_FIELD', 'email'),
            'handler' => null,
        ],

        'routes' => [
            'middleware' => ['web'],
        ],

        'assets' => [
            'entry' => env('SHIFT_WIDGET_ASSET_ENTRY', 'src/widget.ts'),
            'manifest_path' => env('SHIFT_WIDGET_ASSET_MANIFEST', 'shift-assets/.vite/manifest.json'),
            'base_path' => env('SHIFT_WIDGET_ASSET_BASE_PATH', 'shift-assets'),
            'script_url' => env('SHIFT_WIDGET_SCRIPT_URL'),
            'vite_dev_server' => [
                'enabled' => env('SHIFT_WIDGET_VITE_DEV_SERVER', true),
                'url' => env('SHIFT_WIDGET_VITE_DEV_SERVER_URL'),
                'host' => env('SHIFT_WIDGET_VITE_DEV_HOST'),
                'port' => env('SHIFT_WIDGET_VITE_DEV_PORT', 5174),
            ],
        ],
    ],

    'collaborators' => [
        'resolver' => env('SHIFT_COLLABORATORS_RESOLVER', App\Services\ShiftCollaboratorResolver::class),
    ],

    /*
    |--------------------------------------------------------------------------
    | Default Routes
    |--------------------------------------------------------------------------
    |
    | Configure the default routes for the SHIFT SDK integration.
    |
    */

    'routes' => [
        'prefix' => 'shift',
        'middleware' => ['web', 'auth'],
    ],
];
