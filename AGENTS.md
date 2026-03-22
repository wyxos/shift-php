# SHIFT PHP SDK Package (`packages/shift-php/`)

Applies inside `packages/shift-php/**` except where `ui/AGENTS.md` is more specific.

## Package Boundaries
- This directory is the nested Composer package and its own Git repo.
- `/shift/**` routes belong here, not in the harness app.
- The dashboard shell is served by `src/Http/Controllers/ShiftController.php`.
- `/shift/api/**` controllers proxy authenticated user context back to the SHIFT portal using `config('shift.url')`, `config('shift.token')`, and `config('shift.project')`.
- Keep package routes, proxy payloads, and portal expectations aligned with the main SHIFT repo `../shift`.

## Current Contract Rules
- `routes/shift.php` keeps two public endpoints outside the main middleware group: `POST /shift/api/notifications` and `GET /shift/api/collaborators/external`.
- `POST /shift/api/notifications` is intentionally public but must stay signed with `X-Shift-Timestamp` and `X-Shift-Signature`. Keep it aligned with `src/Http/Controllers/ShiftNotificationController.php` and the portal sender.
- `GET /shift/api/collaborators/external` stays outside the main middleware group but authorizes with the configured project token.
- All other `/shift/api/**` task, thread, attachment, and dashboard endpoints stay behind `config('shift.routes.middleware')`.
- Attachment downloads must keep using the client-app proxy route (`/shift/api/attachments/{attachment}/download`), not direct portal URLs.
- In local development, `src/Http/Controllers/ShiftController.php` prefers the Vite dev server and falls back to built files in `public/shift-assets/`.

## Install, Publish, and Release Rules
- `php artisan install:shift` supports browser verification and install sessions, registers the consumer app environment and URL with SHIFT, writes `SHIFT_TOKEN` and `SHIFT_PROJECT`, scaffolds `App\Services\ShiftCollaboratorResolver` when needed, and publishes assets and config at the end.
- After UI or public asset changes, publish with `php artisan shift:publish --group=public`.
- After config or template changes, publish with `php artisan shift:publish --group=all`.
- This directory has its own `.git`; package commits, tags, and releases happen here.
- `npm run release` still runs `release.mjs`, but unattended releases should prefer `node ~/Developer/wyxos/scripts/release-shift.mjs shift-php ...` or `... both ...`.

## Local and Private Environment Rules
- Do not break local or private `.test` and LAN flows when touching install, collaborator, or proxy code.
- The package intentionally supports local and private SHIFT URLs in install-session requests, collaborator lookup, and other local development flows.
