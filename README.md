# SHIFT SDK for Laravel

[![Latest Version on Packagist](https://img.shields.io/packagist/v/wyxos/shift-sdk.svg?style=flat-square)](https://packagist.org/packages/wyxos/shift-sdk)
[![MIT Licensed](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE.md)

Laravel SDK to integrate and sync tasks with the SHIFT Dashboard.

## Overview

The SHIFT SDK is a Laravel package that provides a UI component for submitting tasks/issues from any Laravel application to the core SHIFT system. It allows you to easily integrate your Laravel application with the SHIFT Dashboard for task management.

This package:
- Is a Laravel package, not a full Laravel app
- Avoids global routes, views, or assumptions about the host app
- Sends HTTP requests to SHIFT's public API
- Provides a Vue.js-based UI form via a Blade component

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
1. Prompt you for your SHIFT API token
2. Ask you for your SHIFT project token
3. Save the configuration to your .env file
4. Publish the necessary assets

## Configuration

The package can be configured via your `.env` file:

```
SHIFT_TOKEN=your-api-token
SHIFT_PROJECT=your-project-token
SHIFT_URL=https://shift.wyxos.com
```

You can also publish the configuration file:

```bash
php artisan vendor:publish --tag=shift
```

This will create a `config/shift.php` file where you can modify the configuration:

```php
return [
    'token' => env('SHIFT_TOKEN'),
    'project' => env('SHIFT_PROJECT'),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),
    'routes' => [
        'prefix' => 'shift',
        'middleware' => ['web']
    ]
];
```

## Usage

### Dashboard

Once installed, you can access the SHIFT dashboard at `/shift` in your application. The dashboard is protected by the 'web' and 'auth' middleware, so users must be authenticated to access it.

### API Endpoints

The package provides the following API endpoints, all of which require authentication:

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

### Task Submissions

The SDK automatically includes the authenticated user's information (name, email, user ID) along with environment and URL information when submitting tasks to the SHIFT API.

When a user submits a task through the SDK, the following information is automatically included:
- User's name
- User's email
- User's ID
- Application environment
- Application URL

This information helps track who submitted the task and from where.

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

## Directory Structure

- `src/` – Main package code
  - `src/Http/Controllers` – Controllers for SDK routes
- `routes/` – Contains package-specific routes (prefixed)
- `config/shift.php` – Package config
- `ui/` – Vue components (compiled via host app)

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
