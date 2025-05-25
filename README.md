### 🧠 Critique – What's Good:

* ✅ Clear intro and purpose
* ✅ Good installation and config instructions
* ✅ Useful command references
* ✅ Highlights both UI and programmatic usage

---

### ⚠️ What Could Be Improved:

1. **Redundant or irrelevant lines:**

    * "This package: Is a Laravel package..." — obvious from context.
    * "Avoids global routes/views..." — devs care more about what routes exist, not what doesn't.
    * "Automatically includes user info..." — should be briefly mentioned, not over-explained.

2. **Too much focus on internals:**

    * Directory structure is unnecessary for most users unless they're contributors.
    * Implementation details about middleware and route prefixes should be part of config docs, not the main README.

3. **API usage with `Http::post('/shift/api/tasks')`** is misleading:

    * That’s calling your **own app**, not the remote SHIFT API.
    * It could confuse devs into thinking they're hitting the real SHIFT dashboard.

---

### ✅ Suggested Cleaned-Up README

````markdown
# SHIFT SDK for Laravel

[![Latest Version on Packagist](https://img.shields.io/packagist/v/wyxos/shift-sdk.svg?style=flat-square)](https://packagist.org/packages/wyxos/shift-sdk)
[![MIT Licensed](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE.md)

A Laravel SDK for submitting tasks to the SHIFT Dashboard from within your application. Provides a clean Vue-based UI component and simple API endpoints to send issue reports or feature requests directly to your SHIFT project.

---

## 🚀 Installation

```bash
composer require wyxos/shift-sdk
php artisan install:shift
````

This will:

* Prompt for your SHIFT API token and project token
* Save them to your `.env`
* Publish frontend and config files

---

## ⚙️ Configuration

Add your SHIFT credentials to `.env`:

```env
SHIFT_TOKEN=your-api-token
SHIFT_PROJECT=your-project-token
SHIFT_URL=https://shift.wyxos.com
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

When tasks are submitted, the SDK automatically includes:

* Authenticated user's name, email, and ID
* Current environment and application URL

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
* `shift:publish` – Manually publish SDK assets

---

## 📄 License

MIT © [Wyxos](https://wyxos.com). See [LICENSE.md](LICENSE.md) for details.
