# SHIFT Dashboard UI (`packages/shift-php/ui/`)

## Package Identity
- Vue 3 + Vite SPA for the `/shift` dashboard shipped with the PHP SDK package.
- Built output is written to `packages/shift-php/public/shift-assets/` (do not hand-edit).

## Setup & Run
- Install (in this folder): `npm install`
- Dev server: `npm run dev` (root convenience: `npm run dev:shift`)
- Build (includes typecheck): `npm run build`
- Preview build: `npm run preview`

## Patterns & Conventions
- App entry/router:
  - ✅ DO: Keep SPA wiring in `packages/shift-php/ui/src/main.ts` and `packages/shift-php/ui/src/router.ts`
- API client:
  - ✅ DO: Centralize Axios defaults in `packages/shift-php/ui/src/axios-config.ts`
  - ❌ DON'T: Hardcode portal URLs in components; rely on `/shift/api/**` + Vite proxy (see `packages/shift-php/ui/vite.config.ts`)
- Components:
  - ✅ DO: Keep feature components in `packages/shift-php/ui/src/components/**` (e.g. `packages/shift-php/ui/src/components/TaskList.vue`)
  - ✅ DO: Keep shared UI primitives in `packages/shift-php/ui/src/components/ui/**` (e.g. `packages/shift-php/ui/src/components/ui/button.vue`)
- Aliases / shared imports:
  - ✅ DO: Use `@/…` for UI-local imports (mapped to `packages/shift-php/ui/src`)
  - ✅ DO: Use `@shift/...` aliases to import shared portal resources when needed (see paths in `packages/shift-php/ui/tsconfig.app.json`)
- Build output:
  - ❌ DON'T: Edit `packages/shift-php/public/shift-assets/assets/index-*.js` or `packages/shift-php/public/shift-assets/index.html`

## Touch Points / Key Files
- Vite config (proxy, host, output dir): `packages/shift-php/ui/vite.config.ts`
- TypeScript paths: `packages/shift-php/ui/tsconfig.app.json`
- SPA shell: `packages/shift-php/ui/src/App.vue`
- Task UI: `packages/shift-php/ui/src/components/TaskList.vue`, `packages/shift-php/ui/src/components/TaskDetails.vue`

## JIT Index Hints
- Find a component: `rg -n \"<script setup\" packages/shift-php/ui/src/components`
- Find API calls: `rg -n \"axios\\.|/shift/api\" packages/shift-php/ui/src`
- Find UI primitives: `ls packages/shift-php/ui/src/components/ui`

## Common Gotchas
- HTTPS in dev is enabled only when Herd/Valet certs are found; customize with `VITE_CERT_NAME`, `VITE_SSL_KEY_PATH`, `VITE_SSL_CERT_PATH` (see `packages/shift-php/ui/vite.config.ts`).
- After `npm run build`, publish to the portal app with `php artisan shift:publish --group=public`.

## Pre-PR Checks
- `npm run build`
