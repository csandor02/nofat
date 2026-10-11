# 3DIGIT CLUB

A private two-person weekly discipline pact for Catalina and Cristian.

## Requirements

- Node.js 24 LTS and npm
- Docker for local Supabase
- Supabase CLI (installed as a development dependency)

## Local setup

1. Run `npm ci`.
2. Run `npx supabase start` and `npx supabase db reset`.
3. Copy `.env.example` to `.env.local` and use the local API URL and publishable/anon key from `npx supabase status`.
4. Provision Catalina and Cristian using the process below.
5. Run `npm run dev` and open `/discipline-club/#/login`.

## Provisioning

Create a gitignored `.env.provision.local` containing:

```dotenv
PROVISION_SUPABASE_URL=http://127.0.0.1:54321
PROVISION_SUPABASE_SECRET_KEY=LOCAL_OR_HOSTED_SECRET_KEY
CATALINA_EMAIL=...
CATALINA_PASSWORD=...
CRISTIAN_EMAIL=...
CRISTIAN_PASSWORD=...
```

Run `node --env-file=.env.provision.local scripts/provision-users.mjs`. The operation is idempotent and stops if an email or member slot conflicts. Delete the credential file after hosted provisioning.

Public signup must remain disabled. To recover an account, verify the member and use a trusted local admin script or Supabase dashboard to call `updateUserById`; never put an administrative key in a `VITE_` variable.

## Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:db`
- `npm run test:e2e`
- `npm run build`
- `npm run verify:release`

## Deployment

Create a public GitHub repository named `discipline-club`. In repository variables set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Select GitHub Actions as the Pages source. The workflow verifies locally and publishes only `dist`.

## Operations

- Paused free project: restore it in the Supabase dashboard, wait for healthy status, then sign in and let `sync_duel` process overdue weeks.
- Backup: periodically run the supported Supabase/Postgres logical dump command against the hosted database and store the encrypted output outside this public repository.
- Personal JSON exports are data copies, not database backups or restore artifacts.
- Recheck Supabase free-tier limits and GitHub action versions before a production release.
