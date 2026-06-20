# SHIFT PHP for Laravel

[![Latest Version on Packagist](https://img.shields.io/packagist/v/wyxos/shift-php.svg?style=flat-square)](https://packagist.org/packages/wyxos/shift-php)
[![MIT Licensed](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE.md)

`wyxos/shift-php` embeds issue intake and task follow-up inside a Laravel application. It ships the `/shift` dashboard, an optional in-app report widget, task and thread proxy endpoints, external collaborator lookup, install-session onboarding, and scrubbed backend error reporting.

A Laravel app user reports an issue from the page where it happened, the package sends useful app context to the portal, and the developer follows up on the resulting task.

## Installation

```bash
composer require wyxos/shift-php
php artisan install:shift
```

The default installer uses browser verification:

- Reads `APP_ENV` and `APP_URL` from the Laravel app.
- Creates an install session in the portal.
- Prints a verification URL and short code for browser approval.
- Waits for approval through Reverb when available, with polling fallback.
- Lets you choose an installable project or create a standalone one when the account has no available option.
- Writes `SHIFT_TOKEN` and `SHIFT_PROJECT` to the app `.env`.
- Registers the current app environment and URL.
- Scaffolds `App\Services\ShiftCollaboratorResolver` when the app does not already have one.
- Publishes config and frontend assets.

If `SHIFT_TOKEN` and `SHIFT_PROJECT` already exist, the installer keeps those values and skips browser verification.

For a raw-token install, run:

```bash
php artisan install:shift --manual
```

## Configuration

Typical `.env` values:

```env
SHIFT_URL=https://shift.wyxos.com
SHIFT_TOKEN=your-shift-api-token
SHIFT_PROJECT=your-shift-project-token
SHIFT_COLLABORATORS_RESOLVER=App\Services\ShiftCollaboratorResolver

SHIFT_ERROR_REPORTING_ENABLED=true
SHIFT_RELEASE=
SHIFT_GIT_SHA=
```

Hosted portal:

```env
SHIFT_URL=https://shift.wyxos.com
```

Local or self-hosted portal:

```env
SHIFT_URL=https://shift.test
```

Local, `.test`, `.local`, localhost, and private IP portal URLs are treated as private by the package client, so SSL verification is skipped for package-to-portal requests. The active portal still needs network access to the app URL when it calls the app for collaborator lookup.

Publish the config when you need to customize middleware, widget behavior, or error-reporting settings:

```bash
php artisan vendor:publish --tag=shift
```

Important config keys:

```php
return [
    'token' => env('SHIFT_TOKEN'),
    'project' => env('SHIFT_PROJECT'),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),

    'routes' => [
        'prefix' => 'shift',
        'middleware' => ['web', 'auth'],
    ],

    'widget' => [
        'enabled' => env('SHIFT_WIDGET_ENABLED', true),
        'routes' => [
            'middleware' => ['web'],
        ],
    ],

    'errors' => [
        'enabled' => env('SHIFT_ERROR_REPORTING_ENABLED', true),
        'endpoint' => env('SHIFT_ERROR_REPORTING_ENDPOINT', '/api/errors'),
        'release' => env('SHIFT_RELEASE'),
        'revision' => env('SHIFT_GIT_SHA') ?: env('HERD_DEPLOYMENT_COMMIT') ?: env('SOURCE_VERSION'),
        'timeout' => env('SHIFT_ERROR_REPORTING_TIMEOUT', 3),
    ],
];
```

## Task Creation From A Laravel App

After installation, the embedded dashboard is available at:

```text
/shift
```

It uses the configured route middleware, which defaults to `web` and `auth`. Authenticated users can create tasks, edit task details, comment in threads, upload attachments, and manage collaborators for the linked project.

For a lightweight report form inside the host app, use the widget endpoint:

```http
POST /shift/api/widget/tasks
```

Example browser submission:

```js
await fetch('/shift/api/widget/tasks', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
    },
    body: JSON.stringify({
        kind: 'issue',
        title: 'Invoice export does not download',
        description: 'I clicked Export CSV on invoice INV-1047 and no file downloaded.',
        anonymous: false,
        metadata: {
            page_url: window.location.href,
            page_title: document.title,
            referrer: document.referrer || null,
        },
    }),
});
```

For the authenticated dashboard/task surface, the package proxies:

- `GET /shift/api/tasks`
- `POST /shift/api/tasks`
- `GET /shift/api/tasks/{id}`
- `PUT /shift/api/tasks/{id}`
- `PATCH /shift/api/tasks/{id}/collaborators`
- `GET /shift/api/tasks/{taskId}/threads`
- `POST /shift/api/tasks/{taskId}/threads`

## Backend Error Intake

When `SHIFT_ERROR_REPORTING_ENABLED=true`, the package registers a Laravel exception reporter. It sends scrubbed backend exception payloads to the configured portal without blocking the app's normal exception handling.

Error reporting is best-effort. Missing credentials, disabled reporting, connection failures, timeouts, or non-success portal responses are ignored by the reporter.

Set release metadata in deployed environments when you want error reports tied to a build:

```env
SHIFT_RELEASE=2026.06.20
SHIFT_GIT_SHA=your-deploy-commit
```

## Data Sent

Task and dashboard proxy requests include:

- Project token.
- Authenticated app user name, email, and ID when available.
- App environment from `APP_ENV`.
- App URL from `APP_URL`.
- User-entered task fields such as title, description, status, priority, comments, attachments, and collaborator choices.

Widget submissions include:

- Report kind, title, and description.
- Anonymous flag.
- Page metadata supplied by the widget, such as current page URL, page title, and referrer.
- Authenticated app user details, or guest name/email when guest details are submitted and anonymous mode is not used.
- Consumer app name, environment, and URL.

Backend error reports include:

- Project token.
- App environment, app URL, release, and revision.
- Exception class and scrubbed message.
- Normalized stack frames and limited source context for in-app files.
- Request method, URL, path, referrer, IP, user agent, query, and body after scrubbing.
- PHP and Laravel versions.
- Authenticated user context when available.

The error scrubber removes common sensitive fields such as password, token, authorization, and cookie values. You should still avoid adding secrets or sensitive customer data to task descriptions, widget metadata, or exception messages.

## Local Testing Path

```bash
php artisan config:clear
php artisan shift:test
```

`shift:test` creates a QA task in the configured project. Use a local or self-hosted portal unless you intentionally want that task in a hosted project.

## Troubleshooting

### `SHIFT configuration missing`

Run the installer or set both `SHIFT_TOKEN` and `SHIFT_PROJECT`, then clear cached config:

```bash
php artisan install:shift
php artisan config:clear
```

### Browser verification cannot run

The default installer needs an interactive terminal. In CI or non-interactive setup, obtain an API token and project token first, then run:

```bash
php artisan install:shift --manual
```

### Local or private URL warning

The installer warns when `APP_URL` is local or private. Task submission still works when the package can reach the portal, but external collaborator lookup requires that portal to reach the app's `/shift/api/collaborators/external` endpoint.

### `/shift` loads old assets or a blank UI

In a consuming Laravel app, publish the current package assets:

```bash
php artisan shift:publish --group=public
```

### Widget returns `401` or `403`

Check whether the portal project has widget intake enabled and whether guest submissions are allowed. If guest submissions are disabled, the app user must be authenticated through the configured widget guard.

### Task creation returns `422`

Check the validation response from the portal. Common causes are missing title/description, an invalid project token, or project configuration that does not allow the requested intake path.

### Error reports do not appear

Check that error reporting is enabled and fully configured:

```bash
php artisan config:clear
php artisan tinker
>>> config('shift.errors.enabled')
>>> config('shift.url')
>>> filled(config('shift.token'))
>>> filled(config('shift.project'))
```

The reporter is intentionally silent on network failures and non-success portal responses so it does not interfere with application error handling.

## License

MIT [Wyxos](https://wyxos.com). See [LICENSE.md](LICENSE.md) for details.
