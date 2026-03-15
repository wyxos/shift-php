# SHIFT php for Laravel

[![Latest Version on Packagist](https://img.shields.io/packagist/v/wyxos/shift-php.svg?style=flat-square)](https://packagist.org/packages/wyxos/shift-php)
[![MIT Licensed](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE.md)

A Laravel package for submitting tasks to the SHIFT Dashboard from within your application. Provides a clean Vue-based UI component and simple API endpoints to send issue reports or feature requests directly to your SHIFT project.

---

## 🚀 Installation

```bash
composer require wyxos/shift-php
php artisan install:shift
````

This will:

* Prompt for your SHIFT API token and project token
* Save them to your `.env`
* Register the current `APP_ENV` and `APP_URL` with SHIFT for external collaborator lookups
* Scaffold `App\Services\ShiftCollaboratorResolver` when it does not exist
* Publish frontend and config files

---

## ⚙️ Configuration

Add your SHIFT credentials to `.env`:

```env
SHIFT_TOKEN=your-api-token
SHIFT_PROJECT=your-project-token
SHIFT_URL=https://shift.wyxos.com
SHIFT_COLLABORATORS_RESOLVER=App\Services\ShiftCollaboratorResolver
```

Optional: Publish config to customize routes/middleware.

```bash
php artisan vendor:publish --tag=shift
```

`config/shift.php` example:

```php
return [
    'token' => env('SHIFT_TOKEN'),
    'project' => env('SHIFT_PROJECT'),
    'url' => env('SHIFT_URL', 'https://shift.wyxos.com'),
    'routes' => [
        'prefix' => 'shift',
        'middleware' => ['web', 'auth']
    ]
];
```

---

## 🧩 Usage

### UI Dashboard

After installing, a Vue-based task submission UI is available at:

```
/shift
```

This route is protected by the default `web` and `auth` middleware (can be customized).

### API Endpoints

All endpoints are prefixed (by default with `/shift/api`) and require authentication:

* `GET /shift/api/tasks` – List tasks
* `POST /shift/api/tasks` – Create a new task
* `GET /shift/api/tasks/{id}` – View a task
* `PUT /shift/api/tasks/{id}` – Update a task

You can interact with them using Laravel’s `Http` facade:

```php
$response = Http::post('/shift/api/tasks', [
    'title' => 'Bug in report form',
    'description' => 'Submit button doesn’t work on mobile.',
]);
```

When tasks are submitted, the package automatically includes:

* Authenticated user's name, email, and ID
* Current environment and application URL

### External Collaborators

`install:shift` registers the current consumer environment with SHIFT, and the package exposes:

* `GET /shift/api/collaborators/external`

SHIFT calls this endpoint using the project token to retrieve eligible external users for the selected project environment.

The generated resolver is intentionally permissive only for `APP_ENV=local`. For every other environment it returns no users until you replace the TODO stub with your app-specific rules.

---

## 🧪 Testing

Run a test submission with:

```bash
php artisan shift:test
```

This creates a dummy task to verify setup.

---

## 🔧 Artisan Commands

* `install:shift` – Interactive installation
* `shift:test` – Submit a test task
* `shift:publish` – Manually publish package assets

---

## 📄 License

MIT © [Wyxos](https://wyxos.com). See [LICENSE.md](LICENSE.md) for details.
