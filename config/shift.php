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

    'api_token' => env('SHIFT_API_TOKEN'),
    'project_api_token' => env('SHIFT_PROJECT_API_TOKEN', env('SHIFT_API_TOKEN')),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),

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
        'middleware' => ['web']
    ]
];
