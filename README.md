# SHIFT php for Laravel

[![Latest Version on Packagist](https://img.shields.io/packagist/v/wyxos/shift-php.svg?style=flat-square)](https://packagist.org/packages/wyxos/shift-php)
[![MIT Licensed](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE.md)

A Laravel package for embedding SHIFT task intake and collaboration inside a Laravel application. It ships the `/shift` dashboard, task and comment proxy endpoints, external collaborator lookup, install-session onboarding, and scrubbed backend error reporting to your SHIFT project.

## Installation

```bash
composer require wyxos/shift-php
php artisan install:shift
```

By default, `install:shift` uses the SHIFT browser verification flow:

- Validates `APP_ENV` and `APP_URL`
- Creates a SHIFT install session
- Prints the verification URL and short code for browser approval
- Waits for approval through Reverb when available, with polling fallback for older or unreachable SHIFT instances
- Loads the projects you can install into and lets you choose one, or create a new standalone SHIFT project if none exist yet
- Finalizes the install and writes `SHIFT_TOKEN` / `SHIFT_PROJECT`
- Registers the current app environment for external collaborator lookup
- Scaffolds `App\Services\ShiftCollaboratorResolver` when it does not exist
- Publishes frontend assets and config files

If `SHIFT_TOKEN` and `SHIFT_PROJECT` are already configured, the installer keeps using those values and skips browser verification.

If you need the old raw-token path, run:

```bash
php artisan install:shift --manual
```

## Configuration

Add your SHIFT credentials to `.env`:

```env
SHIFT_TOKEN=your-api-token
SHIFT_PROJECT=your-project-token
SHIFT_URL=https://shift.wyxos.com
SHIFT_COLLABORATORS_RESOLVER=App\Services\ShiftCollaboratorResolver
```

Optional: publish config to customize routes and middleware.

```bash
php artisan vendor:publish --tag=shift
```

`config/shift.php` example:

```php
return [
    'token' => env('SHIFT_TOKEN'),
    'project' => env('SHIFT_PROJECT'),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),
    'errors' => [
        'enabled' => env('SHIFT_ERROR_REPORTING_ENABLED', true),
        'endpoint' => env('SHIFT_ERROR_REPORTING_ENDPOINT', '/api/errors'),
        'release' => env('SHIFT_RELEASE'),
        'revision' => env('SHIFT_GIT_SHA') ?: env('HERD_DEPLOYMENT_COMMIT') ?: env('SOURCE_VERSION'),
        'timeout' => env('SHIFT_ERROR_REPORTING_TIMEOUT', 3),
    ],
    'routes' => [
        'prefix' => 'shift',
        'middleware' => ['web', 'auth'],
    ],
];
```

## Usage

### UI Dashboard

After installing, the embedded task dashboard is available at:

```text
/shift
```

This route uses the default `web` and `auth` middleware unless you customize it. Users can create and edit tasks, comment in task threads, and manage collaborators through the configured SHIFT project.

### API Endpoints

All endpoints are prefixed by default with `/shift/api` and require authentication:

- `GET /shift/api/tasks` - List tasks
- `POST /shift/api/tasks` - Create a new task
- `GET /shift/api/tasks/{id}` - View a task
- `PUT /shift/api/tasks/{id}` - Update a task
- `PATCH /shift/api/tasks/{id}/collaborators` - Update task collaborators
- `GET /shift/api/tasks/{taskId}/threads` - List task comments
- `POST /shift/api/tasks/{taskId}/threads` - Add a task comment

You can interact with them using Laravel's `Http` facade:

```php
$response = Http::post('/shift/api/tasks', [
    'title' => 'Bug in report form',
    'description' => 'Submit button does not work on mobile.',
]);
```

When tasks are submitted, the package automatically includes:

- The authenticated user's name, email, and ID
- The current environment and application URL

### Error Reporting

When `SHIFT_ERROR_REPORTING_ENABLED` is true, the package registers a Laravel exception reporter that sends scrubbed backend exception payloads to SHIFT. The reporter includes the project token, environment, app URL, release/revision metadata when configured, request context, user context, and normalized stack frames.

Reporting is best-effort: missing SHIFT credentials, disabled reporting, connection failures, or non-success responses are ignored so your application error handling is not blocked by SHIFT.

Set `SHIFT_RELEASE` and one of `SHIFT_GIT_SHA`, `HERD_DEPLOYMENT_COMMIT`, or `SOURCE_VERSION` in deployed environments when you want SHIFT error reports tied back to a release.

### External Collaborators

`install:shift` registers the current consumer environment with SHIFT, and the package exposes:

- `GET /shift/api/collaborators/external`

SHIFT calls this endpoint using the project token to retrieve eligible external users for the selected project environment.

The generated resolver is intentionally permissive only for `APP_ENV=local`. For every other environment it returns no users until you replace the TODO stub with your app-specific rules.

## Testing

Run a test submission with:

```bash
php artisan shift:test
```

This creates a real QA task in the configured SHIFT project to verify setup. Do not run it against a production-backed project unless you intend to create that QA task there.

## Artisan Commands

- `install:shift` - Interactive installation
- `install:shift --manual` - Manual raw token and project entry
- `shift:test` - Submit a QA task to verify SDK configuration
- `shift:publish` - Manually publish package assets

## License

MIT [Wyxos](https://wyxos.com). See [LICENSE.md](LICENSE.md) for details.
