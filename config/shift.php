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

    'api_token' => env('SHIFT_API_KEY'),
    'project_id' => env('SHIFT_PROJECT_ID'),
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

