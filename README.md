# SHIFT SDK for Laravel

[![Latest Version on Packagist](https://img.shields.io/packagist/v/wyxos/shift-sdk.svg?style=flat-square)](https://packagist.org/packages/wyxos/shift-sdk)
[![MIT Licensed](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE.md)

Laravel SDK to integrate and sync tasks with the SHIFT Dashboard.

## Overview

The SHIFT SDK allows you to easily integrate your Laravel application with the SHIFT Dashboard for task management. It provides a UI and API for managing tasks, and syncs them with the SHIFT Dashboard.

## Installation

You can install the package via composer:

```bash
composer require wyxos/shift-sdk
```

After installing the package, you can run the installation command:

```bash
php artisan install:shift
```

This command will:
1. Prompt you for your SHIFT API key
2. Ask you to select or create a project
3. Save the configuration to your .env file
4. Publish the necessary assets

## Configuration

The package can be configured via your `.env` file:

```
SHIFT_API_TOKEN=your-api-token
SHIFT_PROJECT_ID=your-project-id
SHIFT_URL=https://shift.wyxos.com
```

You can also publish the configuration file:

```bash
php artisan vendor:publish --tag=shift
```

This will create a `config/shift.php` file where you can modify the configuration:

```php
return [
    'api_token' => env('SHIFT_API_TOKEN'),
    'project_id' => env('SHIFT_PROJECT_ID'),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),
    'routes' => [
        'prefix' => 'shift',
        'middleware' => ['web']
    ]
];
```

## Usage

### Dashboard

Once installed, you can access the SHIFT dashboard at `/shift` in your application.

### API Endpoints

The package provides the following API endpoints:

- `GET /shift/api/tasks` - List tasks
- `GET /shift/api/tasks/{id}` - Get a specific task
- `POST /shift/api/tasks` - Create a new task
- `PUT /shift/api/tasks/{id}` - Update a task

### Creating Tasks Programmatically

You can create tasks programmatically by making requests to the API endpoints:

```php
use Illuminate\Support\Facades\Http;

// Create a task
$response = Http::post('/shift/api/tasks', [
    'title' => 'Task Title',
    'description' => 'Task Description',
    // other task attributes
]);

// Get tasks
$tasks = Http::get('/shift/api/tasks')->json();
```

## Testing

You can test the integration by running:

```bash
php artisan shift:test
```

This will create a dummy task to verify that the integration is working correctly.

## Commands

The package provides the following commands:

- `install:shift` - Install and configure the SHIFT SDK
- `shift:test` - Test the integration by creating a dummy task
- `shift:publish` - Publish the SHIFT SDK assets

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
