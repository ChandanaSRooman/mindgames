# Rooman Alumni Network

A responsive, enterprise-themed (Deep Navy + Teal) alumni platform — React + TypeScript frontend with an Express + TypeScript API stub. Every "smart" action (invites, social auth, AI resume parsing) is **simulated**; the app ships pre-loaded with mock data.

## Structure

```
.
├── package.json     # root orchestrator (no dependencies)
├── backend/         # Express + TypeScript API  → http://localhost:4000
└── frontend/        # Vite + React + TS app      → http://localhost:5173
```

The frontend proxies `/api/*` to the backend (see `frontend/vite.config.ts`).

## Getting started

```bash
npm run install:all   # install backend + frontend deps
npm run dev           # runs API (:4000) and web (:5173) together
```

Then open http://localhost:5173.

## Routes

| Route             | View                                                            |
| ----------------- | --------------------------------------------------------------- |
| `/admin`          | Admin dashboard: stats, CSV upload, manual add, invite table    |
| `/accept-invite`  | Invitation landing + Google/LinkedIn/email signup               |
| `/onboarding`     | AI resume parse → experience, skills, status tags               |
| `/feed`           | LinkedIn-style feed with composer + status-tag filter sidebar   |

Flow: `/accept-invite` → `/onboarding` → `/feed`. `/` redirects to `/admin`.

## Scripts

- `npm run dev` — both servers
- `npm run dev:web` / `npm run dev:api` — one server
- `npm run build` — typecheck + build both
- `npm run check` — runs the CSV parser self-check (`frontend/src/lib/csv.check.ts`)

## Notes

- State is **in-memory**: restarting the backend resets data; refreshing the browser reloads seed data.
- Search the code for `ponytail:` to find intentional simulation shortcuts and their upgrade paths (e.g. swap the hand-rolled CSV parser for `papaparse`, wire real email/WhatsApp/OAuth/PDF parsing).
