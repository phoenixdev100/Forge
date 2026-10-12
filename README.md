<div align="center">

<img src="client/public/favicon.svg" alt="Forge" width="72" />

# Forge

**Build your workout. Track every set.**

A personal gym system - not a form for exercises. Plan a training block,
schedule it, perform the workout, record every set, and watch the proof
stack up over time.

`React 19` · `TypeScript` · `Express 5` · `Prisma 7` · `PostgreSQL` · `Tailwind v4`

</div>

---

<div align="center">

## The loop

</div>

```
Create a plan  →  Schedule it  →  Perform the workout  →  Record every set
       ↑                                                        │
       └────────  Compare performance, track progress  ◄────────┘
```

- **Plans describe intent** - days, exercises, target sets/reps, planned set details
- **Sessions record reality** - a snapshot of the plan taken at workout start
- **History never rewrites itself** - editing or deleting a plan later cannot mutate what you actually did
- **Live plan sync** - exercises added to or removed from a plan day land in an in-progress workout instantly (logged sets are always protected)
- **Completed workouts are immutable** - reopening for corrections is explicit, and PRs are re-detected afterwards

<div align="center">

## Features

</div>

| Area | What you get |
| --- | --- |
| **Plans** | Custom cycle length, day labels, muscle-group tagging, per-set targets, drag-and-drop ordering, templates, duplicate days/exercises |
| **Calendar & scheduling** | Plan-driven day resolution, rest/workout overrides, one-time and ongoing shift-forward, actionable empty days |
| **Workout mode** | Set-by-set logging (weight/reps/time/distance), previous-performance hints, auto-start rest timer, exercise swap, supersets, plate calculator, warm-up ramp, 1RM calculator, add/remove exercises mid-workout, end-early |
| **Progress** | Volume & e1RM trends, muscle-balance radar, muscle recovery map, per-exercise history, streaks, double-progression coaching hints |
| **Records** | PRs detected on entered values only (weight, reps, time, distance) - grouped by the session's marked date |
| **Goals & achievements** | Custom goals, automatic milestone badges |
| **Body profile** | Onboarding collects sex/height/weight/DOB; dedicated profile page with measurements and progress photos |
| **Exercise library** | Searchable, filterable catalog with custom exercises and admin-managed media |
| **Data & PWA** | JSON/CSV export, installable app, offline shell + last-loaded data, session compare, shareable summary card, repeat-last-workout |
| **Admin** | Exercise curation, publish states, upload demos |

<div align="center">

## Project layout

</div>

```
gym-website/
├── client/                React SPA (Vite) - the app you see
│   └── src/
│       ├── components/    Shared UI: buttons, dialogs, pickers, steppers…
│       ├── pages/         Route-level screens (workout, plans, progress…)
│       ├── lib/           API client, query keys, formatting, units
│       └── providers/     Auth, unit preference
└── server/                Express API - the system of record
    ├── prisma/            Schema + seed
    └── src/
        ├── modules/       One folder per domain (sessions, plans, progress…)
        │   └── */         *.routes.ts  *.service.ts  *.serializer.ts  *.schemas.ts
        ├── lib/           Dates, errors, strength math, serialization
        └── db/            Prisma client (driver adapter)
```

<div align="center">

## Getting started

</div>

**Prerequisites:** Node.js 20+ and a Postgres database (Neon works great).

```bash
# 1 - API
cd server
npm install
cp .env.example .env    # fill in DATABASE_URL + secrets (see below)
npm run db:migrate      # create tables (versioned migration)
npm run db:seed         # demo + admin accounts, exercise catalog
npm run dev             # http://localhost:4000

# 2 - Web app (new terminal)
cd client
npm install
npm run dev             # http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to `:4000`, so auth cookies
stay same-site `Lax` with zero CORS friction. `GET http://localhost:4000/`
returns `{ name, status, health }` once the API is up.

<div align="center">

## Environment

</div>

Everything lives in `server/.env` - the file is commented section by section.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres connection used at runtime |
| `SHADOW_DATABASE_URL` | Optional direct endpoint for `migrate dev` (poolers can't run DDL in a transaction) |
| `PORT` | API port - default `4000` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing keys - generate with `crypto.randomBytes` |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS` | Session lifetimes (`15m` / `30` defaults) |
| `COOKIE_CROSS_SITE` / `COOKIE_DOMAIN` | Set only for cross-site HTTPS deployments |
| `APP_URL` / `RESET_TOKEN_TTL_MINUTES` | Password-reset links |
| `MAIL_PROVIDER` / `MAIL_FROM` | Email delivery - `smtp` or `none` (logs reset links in dev) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Your own SMTP account - Gmail: `smtp.gmail.com:465` + app password |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | Exercise demos & progress photos |
| `SEED_*` | Accounts created by `npm run db:seed` |

**Production deploy:** run `npm run db:deploy` (`prisma migrate deploy`) before `npm start` so pending migrations apply safely. Schema changes go through `npm run db:migrate` - never `db push` against production. Full runbook: [DEPLOYMENT.md](DEPLOYMENT.md).

<div align="center">

## Scripts

</div>

**server/**

| Script | Does |
| --- | --- |
| `npm run dev` | `tsx watch` - API with reload |
| `npm run build` | `prisma generate` + `tsc` → `dist/` |
| `npm start` | Run the built server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create + apply a migration in dev |
| `npm run db:deploy` | Apply pending migrations (production deploys) |
| `npm run db:push` | Schema sync without history - dev only |
| `npm run db:seed` | Seed catalog + demo accounts |
| `npm run db:studio` | Prisma Studio |

**client/**

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server on `:5173` |
| `npm run build` | Typecheck + production bundle |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |

<div align="center">

## API surface

</div>

All endpoints live under `/api`, authenticated via `HttpOnly` cookie JWTs
(access + refresh, rotating). Routers are thin; logic lives in `*.service.ts`.

| Mount | Domain |
| --- | --- |
| `/api/auth` | Register, login, refresh, logout, logout-all, password reset |
| `/api/plans` | Plans, days, exercises, planned sets, templates |
| `/api/schedule` | Per-date resolution, overrides, shift-forward |
| `/api/sessions` | Start/resume, log sets, complete/abandon/reopen, live exercise add-remove |
| `/api/exercises`, `/api/muscle-groups`, `/api/taxonomy` | Exercise library & filters |
| `/api/progress` | Trends, per-exercise history, recovery map, personal records |
| `/api/dashboard`, `/api/goals`, `/api/achievements`, `/api/measurements`, `/api/users` (profile + export), `/api/admin` | Everything else |

<div align="center">

## Docs

</div>

| Doc | Covers |
| --- | --- |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deploy runbook - env, migrations, SMTP, scaling notes |
| [SECURITY.md](SECURITY.md) | Security architecture + how to report vulnerabilities |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Module conventions, schema rules, dev workflow |
| [LICENSE](LICENSE) | MIT |

<div align="center">

**Forge your consistency.** 🔥

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

Made with ❤️ by **Deepak**

</div>
