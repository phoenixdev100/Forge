<div align="center">

# Contributing

</div>

## Dev setup

```bash
cd server && npm install && cp .env.example .env   # fill in DATABASE_URL + secrets
npm run db:migrate && npm run db:seed && npm run dev
cd client && npm install && npm run dev
```

Verify changes with `npm run typecheck` (both), `npm run lint` (client),
`npm run build` (both) before pushing.

## The one rule that matters most

**Plans are intent. Sessions are reality. History is immutable.**

`WorkoutPlan/PlanDay/PlanExercise/PlanSet` describe what you intend to do.
`WorkoutSession/SessionExercise/SessionSet` record what you actually did.
Sessions **snapshot** names, targets, units and grouping at start time, so
editing a plan later can never rewrite recorded history. Never "fix" this by
joining back to plan data when rendering history.

Corollaries:

- Completed sessions are read-only; corrections go through explicit reopen
- Sets already logged are protected - even live plan sync skips them
- PRs are detected from **entered** set values, dated by the session's marked
  calendar date (`session.date`), not by when you pressed finish

## Conventions

**Server** - one folder per domain under `src/modules/`:

```
sessions/
  sessions.routes.ts      thin HTTP layer only
  sessions.service.ts     all business logic + prisma calls
  sessions.serializer.ts  DB row -> API shape (Decimal -> number etc.)
  sessions.schemas.ts     zod input schemas
```

- Validate every input via `validate({ body, query, params })` - it replaces
  raw input with parsed data
- Scope every query by `userId`; check ownership before mutating
- Throw `AppError` helpers from `lib/errors.ts` - the error handler
  normalises status/code/message
- All weights stored in **kg**, lengths in **cm**; display units live on
  `User.unit`/`WorkoutSession.unit` only
- Calendar dates are `YYYY-MM-DD`/`@db.Date` - timezone-free by design

**Schema changes** - `npm run db:migrate` in dev, commit the generated
`prisma/migrations/` folder. `db push` is allowed only for throwaway local DBs.

**Client**

- Routes are lazy-loaded in `App.tsx`; auth gating lives there, not in pages
- API calls go through `lib/api.ts` (`api.get/post/...`) - it handles the
  401 → refresh → retry cycle; use `apiForm`/`apiDownload` for files
- Server state via TanStack Query (`lib/queryClient.ts` query keys);
  invalidate `['sessions']` when plan structure can affect live workouts

## Commits & PRs

- Conventional-ish messages focused on *why* (`fix PR date for backfilled sessions`)
- Run typecheck + lint + build before opening a PR
- Never commit `.env`, uploads, or anything derived from secrets
