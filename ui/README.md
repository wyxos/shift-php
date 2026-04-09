# SHIFT Dashboard UI

This is the Vue 3 + TypeScript dashboard shipped inside `wyxos/shift-php`.

Its job is to bring SHIFT's client-facing intake and workflow layer into Laravel apps, so reporting can feel native inside the app while triage, collaboration, and follow-up stay structured in one place.

## Development

- Run `npm run dev:shift` from the outer `shift-sdk-package` repo to start the package UI dev server.
- Run `npm run build:shift` from the outer repo to build the package UI.
- After UI changes, publish assets from the outer repo with `php artisan shift:publish --group=public`.
