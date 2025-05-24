# Junie Guidelines – shift-sdk (Laravel SDK Package)

## 📌 Project Role
This is a **Laravel package** that provides a UI component for submitting tasks/issues from any Laravel application to the core **SHIFT** system.

This package:
- Is **not a full Laravel app**
- Should avoid global routes, views, or assumptions about the host app
- Sends HTTP requests to SHIFT's public API
- Provides a Vue.js-based UI form via a Blade component

## 📁 Directory Structure
- `src/` – Main package code
    - `src/Http/Controllers` – Controllers for SDK routes
- `routes/` – Contains package-specific routes (prefixed)
- `config/shift.php` – Package config
- `ui/` – Vue components (compiled via host app)

## ⚙️ Package Behavior
- Publishes config file and views
- Registers a service provider
- Uses Laravel's HTTP client to communicate with SHIFT
- Sends task creation data to `/api/tasks` endpoint on the SHIFT app

## 🧪 Testing
- This package is **tested externally** via `shift-sdk-package`
- Do **not** include tests in this repo
- Keep code loosely coupled and testable by consumers

## ✅ Conventions
- Use Laravel’s `Route::group()` with `config()`-based middleware and prefix
- Avoid database access or migrations
- Use `Http::withToken(...)->post(...)` to send data to SHIFT

## 🔒 Security & Safety
- Do not store sensitive data in local logs
- Validate user input with custom `FormRequest` classes
- Make endpoints optional via config

## 🌐 Integration Notes
- All SDK requests must use Bearer Token auth
- Main SHIFT service found at ../shift

## 🎯 Good Junie Tasks
- Scaffold new components for task forms (priority/status selector, etc.)
- Generate Blade component wrappers for Vue widgets
- Add services for API communication
- Add Laravel service provider
