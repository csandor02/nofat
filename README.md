# 3DIGIT CLUB

A private two-person weekly discipline pact for Catalina and Cristian.

Weekly goals can be revised during the active week. A revision temporarily pauses ranked display until both members approve the updated plan; approved changes apply to the full week. The interface uses warm translucent surfaces over a calm paper background.

Weight observations, daily calorie totals, and activity statistics are shared between Catalina and Cristian. Private check-in notes remain visible only to the author. Weight and calorie statistics never add competition points.

## Requirements

- Node.js 24 LTS and npm
- Docker for local Supabase
- Supabase CLI (installed as a development dependency)

## Local setup

1. Run `npm ci`.
2. Run `npx supabase start` and `npx supabase db reset`.
3. Copy `.env.example` to `.env.local` and use the local API URL and publishable/anon key from `npx supabase status`.
4. Provision Catalina and Cristian using the process below.
5. Run `npm run dev` and open `/nofat/#/login`.

## Provisioning

Sign in to the Supabase CLI first with `bunx supabase login`. Create a gitignored `.env.provision.local` containing the project URL:

```dotenv
PROVISION_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
```

Run `bun --env-file=.env.provision.local scripts/provision-users.mjs`. The script asks the authenticated Supabase CLI for the project's secret API key in memory; it does not print the key. The operation creates the fixed Catalina and Cristian member accounts. Both use club code `2000`; their internal Supabase email identifiers are not shown in the interface. The operation is idempotent and stops if an existing identity or member slot conflicts. Delete the URL file after hosted provisioning.

Public signup must remain disabled. The shared four-digit code is intentionally low security: anyone who knows the site URL and code can impersonate either member. Never put an administrative key in a `VITE_` variable.

## Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:db`
- `npm run test:e2e`
- `npm run build`
- `npm run verify:release`

## Deployment

This checkout is connected to `csandor02/nofat`, so Vite builds for the `/nofat/` repository subpath.

1. Apply pending database migrations with `bunx supabase db push`.
2. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://csandor02.github.io/nofat/`; keep public sign-up disabled.
3. In GitHub **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and the **publishable** `VITE_SUPABASE_PUBLISHABLE_KEY` (never the secret API key).
4. In GitHub **Settings → Pages**, choose **GitHub Actions** as the source.
5. Commit and push the project to `main`. The workflow runs the release checks and publishes only `dist`.

The site URL will be `https://csandor02.github.io/nofat/`.

## Operations

- Paused free project: restore it in the Supabase dashboard, wait for healthy status, then sign in and let `sync_duel` process overdue weeks.
- Backup: periodically run the supported Supabase/Postgres logical dump command against the hosted database and store the encrypted output outside this public repository.
- Personal JSON exports are data copies, not database backups or restore artifacts.
- Recheck Supabase free-tier limits and GitHub action versions before a production release.
