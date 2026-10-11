# 3DIGIT CLUB Implementation Guide

Version 1.0, 11 October 2026.

This repository implements the supplied Discipline Club product specification under the public product title **3DIGIT CLUB**. The rules use exactly two members, Europe/Bucharest boundaries, four fixed-budget categories, mutual weekly approval, and immutable result snapshots. Both members can see each other's weight and activity statistics; raw personal notes remain owner-only.

## Architecture

- React, TypeScript, Vite, Tailwind CSS, HashRouter, TanStack Query, Zod, Motion.
- Supabase Auth and Postgres. Browser code receives only the project URL and publishable key.
- Ten RLS-enabled application tables and narrowly scoped `security definer` RPCs.
- GitHub Pages deploys only `dist` at `/discipline-club/`.

## Invariants

- Postgres is authoritative for membership, time, revisions, activity credit, scores, badges, and winners.
- Scores use integer basis points and floor every category before summing.
- Weight entries and safe activity projections (including daily kcal) are visible to both club members through member-only RLS/RPC access. Raw personal notes remain owner-only.
- Weekly plans may be revised during the active week. A revision clears approvals and pauses ranked display until both members approve again; the new plan is applied to the full week.
- Missing backend configuration and network failures are explicit errors, never mock success.
- No weight value or under-eating behavior earns competition points.

## Delivery phases

1. Foundation and route shells.
2. Tables, constraints, RLS, and grants.
3. Weekly lifecycle, approval, logging, summary, scoring, and finalization RPCs.
4. Authenticated Pact, Ledger, Duel, settings, and recovery pause.
5. Journal, export, immutable cabinet, badges, and seen state.
6. Responsive editorial UI, deterministic memes, and reduced-motion ceremony.
7. Provisioning, release verification, and Pages deployment.

See `README.md` for setup and operations. The detailed source product specification supplied for this build remains the acceptance contract.
