# SHIFT PHP SDK Package (`packages/shift-php/`)

## Package Identity
- Laravel package that provides:
  - `/shift/**` dashboard (served from built SPA assets)
  - `/shift/api/**` endpoints that proxy to the SHIFT portal API
  - Artisan commands for install/publish/test

## Setup & Run
- Local dev (from repo root):
  - Install package into the portal app: `composer install`
  - Publish package assets/config: `php artisan shift:publish --group=all`
  - Run installer prompts: `php artisan install:shift`
  - Create a test task: `php artisan shift:test`
- UI build + publish (from repo root):
  - Build SDK UI: `npm run build:shift`
  - Publish built assets: `php artisan shift:publish --group=public`
  - One-shot: `npm run shift:test`
- Release (nested repo): run `npm run release` from `packages/shift-php/` (or root `npm run release` to publish after).
-
- When used from the real SHIFT Portal repo, prefer toggling local/online with: `php artisan shift:toggle --local --path=/path/to/shift-sdk-package/packages/shift-php`

## Patterns & Conventions
- Service provider is the integration hub:
  - ✅ DO: Register publish tags/commands/routes via `packages/shift-php/src/ShiftServiceProvider.php`
- Routes live in the package:
  - ✅ DO: Add/modify package routes in `packages/shift-php/routes/shift.php`
  - ❌ DON'T: Add SDK routes to the portal app’s `routes/web.php`
- Controllers are organized under `src/Http/Controllers/**`:
  - ✅ DO: Follow the proxy pattern used in `packages/shift-php/src/Http/Controllers/ShiftTaskController.php`
  - ✅ DO: Keep dashboard serving logic in `packages/shift-php/src/Http/Controllers/ShiftController.php`
- Commands live under `src/Commands/**`:
  - ✅ DO: Follow the signature/handle pattern in `packages/shift-php/src/Commands/InstallShiftCommand.php`
  - ✅ DO: Use publish tags via `packages/shift-php/src/Commands/PublishShiftCommand.php`
- Frontend build artifacts:
  - ❌ DON'T: Edit generated files in `packages/shift-php/public/shift-assets/**` (e.g. `packages/shift-php/public/shift-assets/index.html`)
  - ✅ DO: Edit source in `packages/shift-php/ui/src/**` and rebuild/publish

## Touch Points / Key Files
- Package entrypoint: `packages/shift-php/src/ShiftServiceProvider.php`
- Package routes: `packages/shift-php/routes/shift.php`
- Dashboard HTML/proxy: `packages/shift-php/src/Http/Controllers/ShiftController.php`
- Task API proxy: `packages/shift-php/src/Http/Controllers/ShiftTaskController.php`
- Install/publish commands: `packages/shift-php/src/Commands/InstallShiftCommand.php`, `packages/shift-php/src/Commands/PublishShiftCommand.php`
- Package config template: `packages/shift-php/config/shift.php`

## JIT Index Hints
- Find publish tags: `rg -n \"publishes\\(\" packages/shift-php/src`
- Find /shift routes: `rg -n \"^Route::\" packages/shift-php/routes/shift.php`
- Find API proxy calls: `rg -n \"Http::withToken\" packages/shift-php/src/Http/Controllers`

## Common Gotchas
- Dashboard in local dev proxies to the Vite dev server (see `packages/shift-php/src/Http/Controllers/ShiftController.php`); for UI work prefer running `npm run dev:shift`.
- After changing SDK public assets or config templates, run `php artisan shift:publish --group=all` so the portal app reflects the update.
- `packages/shift-php/` is a nested git repo; `git status` at repo root won’t show changes inside it.

## Pre-PR Checks
- `npm run build:shift && php artisan shift:publish --group=public && ./vendor/bin/phpunit`
