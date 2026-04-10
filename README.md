# Nexus Scheduler — AI-powered To-Do + Calendar

Production-lean MVP: one data model surfaced as **To-Do**, **Calendar**, and **Dashboard**, with a bottom-right **OpenAI tool-calling assistant** that creates, updates, deletes, and queries tasks and events.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Prisma 6** + **PostgreSQL** (Neon / Vercel Postgres / local; required for Vercel deploy)
- **FullCalendar** (month / week / list)
- **OpenAI** Chat Completions + function tools
- **Zustand** for a tiny cross-page refresh signal after AI mutations
- **Radix UI** primitives + **class-variance-authority** for components

## Architecture

```
app/
  (main)/                 # Shell layout: sidebar + main + chat widget
  api/                    # REST-style JSON routes
components/
  layout/                 # Sidebar, app shell
  dashboard/              # Summary + urgent Task Boxes
  todo/                   # List, filters, CRUD dialogs
  calendar/               # FullCalendar + event CRUD
  ai/                     # Floating chat
lib/
  db.ts                   # Prisma singleton (dev HMR safe)
  constants/workload.ts   # Workload → color: 1 green, 2 blue, 3 red
  types/api.ts            # DTO shapes shared FE/BE
  services/
    task-service.ts       # Task CRUD + queries
    event-service.ts      # Event CRUD + queries
    sync-service.ts       # Task ↔ calendar sync rules
    dashboard-service.ts  # Aggregates + urgency badges
  ai/
    config.ts             # API key check, timeouts, model defaults
    tool-definitions.ts   # OpenAI tool schemas
    execute-tools.ts      # Validates args → service calls
    run-agent.ts          # Multi-step tool loop + errors + truncation
```

### AI (production-oriented)

1. Copy `.env.example` → `.env` and set **`OPENAI_API_KEY`** (must start with `sk-` for standard OpenAI keys).
2. Optional: **`OPENAI_MODEL`** (default `gpt-4o-mini`), **`OPENAI_BASE_URL`** for OpenAI-compatible gateways.
3. **`GET /api/ai/status`** — returns `{ ready, model, defaultModel, reason }` for the chat widget (no secrets).
4. **`POST /api/ai/chat`** — returns `{ reply, toolCallsApplied, meta }` where `meta` includes `configured`, `model`, and optional `finishReason` (e.g. rate limit, auth).
5. Server-side: **90s timeout**, **2 retries**, tool results **truncated** if huge to avoid context blow-ups; system prompt includes **current UTC date** for relative dates.

Billing and quotas are your OpenAI (or provider) account — not included in this repo.

### Sync rules (high level)

- **Task with `dueDate` and not `done`** → exactly one linked `CalendarEvent` (`linkedTaskId`). Title, detail, workload, and the **calendar day** stay aligned; when an event already exists, its **clock time** is preserved and only the date part follows the task deadline.
- **Task loses `dueDate`, or becomes `done`** → linked calendar block is **removed**.
- **Standalone calendar event** → creates a **mirror task** (`source: calendar`) and links; edits on either side stay merged through `syncLinkedTaskFromEvent` + `syncTaskToCalendar`.
- **Delete task** → cascade removes linked event (FK on `CalendarEvent.linkedTaskId`).
- **Delete event** → task remains; **due date cleared** on the linked task so the list does not imply a phantom deadline.

## Setup

```bash
cd ai-scheduler
npm install
cp .env.example .env
# edit .env — DATABASE_URL (Postgres) + OPENAI_API_KEY

npx prisma migrate dev
npm run db:seed   # optional; needs at least one registered user first

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/dashboard`).

### Deploy on Vercel (friends / multi-user)

Vercel serverless has **no persistent disk**, so **`file:./dev.db` SQLite will not work**. This repo uses **PostgreSQL**.

1. **Database** — Create a free **[Neon](https://neon.tech)** project (or Vercel Postgres). Copy the connection string (include `?sslmode=require` if the provider shows it).
2. **Vercel** — Import the Git repo → **Environment variables**:
   - `DATABASE_URL` — Neon connection string
   - `OPENAI_API_KEY` — your `sk-...` key (same for everyone; visitors get the same AI features you do)
   - Optional: `OPENAI_MODEL`, `NEXT_PUBLIC_SITE_URL` (your custom domain, for metadata links)
3. **Build** — Root **`vercel.json`** sets `buildCommand` to `npm run vercel-build` (`prisma migrate deploy` then `next build`). The first deploy applies migrations to the empty database.
4. Open the production URL, **Register** two accounts, add each other by **email** on **Friends**.

Local development: point `.env` `DATABASE_URL` at the same Neon database (simplest) or a second Neon branch named `dev`.

## API

### List responses (pagination)

- `GET /api/tasks` returns `{ items, total, limit, offset }`. Defaults: `limit=200`, `offset=0`, max `limit=500`. Query: `q`, `sort` (`due` | `updated` | `created` | `workload`), optional `status` (single), or **`scope=active`** (todo + in_progress) / **`scope=done`** (completed only; default sort becomes `updated` if `sort` omitted).
- `GET /api/events` returns the same shape. With `start` & `end` (ISO), defaults to a large window cap (`MAX_EVENTS_IN_RANGE`) for calendar views. Without range, list is paginated like tasks.

### Dates (imports / spreadsheets)

`dueDate`, `startDateTime`, and `endDateTime` accept ISO strings, `YYYY-MM-DD`, and common datetime strings; values are normalized server-side (`lib/utils/date-parse.ts`).

### Bulk import (real data)

| Method | Path | Body |
|--------|------|------|
| POST | `/api/tasks/bulk` | `{ "tasks": [ { "title": "…", "dueDate": "2026-04-15", "expectedWorkload": 2, … }, … ] }` — up to **250** per request |
| POST | `/api/events/bulk` | `{ "events": [ { "title": "…", "startDateTime": "…", "endDateTime": "…" }, … ] }` — up to **250** |

Response: `{ created: [...], errors: [{ index, message }] }` (per-row failures do not roll back earlier rows).

### CRUD

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/tasks` | Paginated list / create |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Read / update / delete |
| GET/POST | `/api/events` | Paginated list / create |
| GET/PATCH/DELETE | `/api/events/[id]` | Read / update / delete |
| GET | `/api/dashboard` | Summary + urgent task boxes + recent list (no full-table scan) |
| GET | `/api/ai/status` | `{ ready, model, defaultModel, reason }` — chat readiness (no secrets) |
| POST | `/api/ai/chat` | `{ messages }` → `{ reply, toolCallsApplied, meta }` |

## AI tools

`createTask`, `updateTask`, `deleteTask`, `createEvent`, `updateEvent`, `deleteEvent`, `queryTasks`, `queryEvents`, `syncTaskAndCalendar`. Orchestration lives in `lib/ai/run-agent.ts`; execution is typed with Zod in `lib/ai/execute-tools.ts`.

## Calendar styling

FullCalendar v6 renders with its internal Preact layer. If the grid looks minimal in your browser, hard-refresh once; for fully custom chrome you can add project-level `.fc-*` rules in `app/globals.css`.

## Scripts

- `npm run dev` — development server  
- `npm run build` / `npm start` — production  
- `npm run db:seed` — Prisma seed via `tsx prisma/seed.ts`  
- `npm run db:migrate` — create/apply migrations  

## Acceptance checklist

- Create/edit/delete tasks with deadlines → calendar updates and dashboard urgency refresh.
- Create/edit/delete events → linked to-do updates; delete event clears task deadline.
- Dashboard shows **D-day style** badges and workload-colored Task Boxes (green / blue / red).
- Assistant with `OPENAI_API_KEY` performs tool calls; UI bumps data epoch so lists refetch.
