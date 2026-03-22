# SHIFT Dashboard UI (`packages/shift-php/ui/`)

Applies inside `packages/shift-php/ui/**` in addition to the package root file.

## Shared UI Rules
- This is the real `/shift` dashboard SPA shipped by the package.
- Treat the main SHIFT portal (`../shift/resources/js/**`) as the source of truth for shared task UX.
- Keep task sheets, comments and editor behavior, attachment flows, ButtonGroup interactions, collaborator UX, and status and priority visuals aligned with the portal in the same task.
- Prefer shared imports before creating SDK-only variants: `@shared/**` for shared task modules, `@shift/**` for portal components and shared utilities, and `@/` only for SDK-local files under `src/**`.
- Keep new toast and notification work on `vue-sonner`.
- Do not introduce new Oruga UI components for new work.

## API and Runtime Rules
- The SDK runtime does not expose a global Ziggy `route()` helper. Use explicit `/shift/api/**` endpoints.
- Centralize Axios defaults in `src/axios-config.ts`; do not hardcode portal URLs in components.
- `vite.config.ts` proxies `/shift/api` to the local host app during dev. Preserve that shape when changing API paths.
- `tsconfig.app.json` intentionally includes portal and shared type paths. Do not remove those includes while shared portal imports still exist.
- If a UI change depends on login, logout, base URL, or app metadata, keep it aligned with `src/Http/Controllers/ShiftController.php` and `window.shiftConfig`.

## Dev and Build Rules
- Local dev server defaults to `https://shift-sdk-package.test:5174`.
- HTTPS is driven by Herd or Valet certificate discovery or `VITE_CERT_NAME`, `VITE_SSL_KEY_PATH`, and `VITE_SSL_CERT_PATH`.
- After UI changes, run `npm run build`, then publish from the outer repo with `php artisan shift:publish --group=public`.
- Root convenience command: `npm run dev:shift`.
- Do not hand-edit generated files in `packages/shift-php/public/shift-assets/**`.
