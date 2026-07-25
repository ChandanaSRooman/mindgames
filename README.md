# Rooman Alumni Network — "Root Connect"

A LinkedIn-style alumni platform for Rooman Technologies: feed, connections,
mentorship, StartupVarsity, communities and an admin invite console.

- **Frontend** — Vite + React 19 + TypeScript + Tailwind (`frontend/`, :5173)
- **Backend** — Express + TypeScript, **PostgreSQL via raw SQL (`pg`)** (`backend/`, :4000)
- **Database** — PostgreSQL, **Amazon RDS in production**, local Docker in dev

The frontend proxies `/api/*` to the backend (`frontend/vite.config.ts`).

## Status

**Every feature is persisted in Postgres/RDS with real JWT auth:** users,
posts, comments, likes, saves, connections, direct-message chats, communities
(join/create), mentorship (sessions, booking, admin-approved applications),
startups, notifications (generated on like/comment/connect/accept/booking/
announcement), pinned admin announcements, and the admin invitee directory.
Auth is real (bcrypt + JWT); routes are protected; the session survives reload.
Runs live against **Amazon RDS in ap-south-1** (`rooconnect-db`, PostgreSQL,
db.t4g.micro).

**Accounts:** the seeded demo data has been cleared — the database holds real
accounts only. **Admin console** (`/admin`): `admin@rooman.com` (password in
`ADMIN_PASSWORD`, backend/.env). The invitee directory, invites, mentor
approvals, community approvals and announcements are admin-gated (403
otherwise). `npm --prefix backend run db:seed -- --force` would restore the
demo dataset, but it **wipes all real accounts** — don't run it casually (the
guard refuses without `--force`).

**Google sign-in:** real when `GOOGLE_CLIENT_ID` is set (see below); otherwise
the button falls back to a simulated demo account.

**Still simulated (`ponytail:` markers):** LinkedIn OAuth, WhatsApp invites,
session date scheduling labels.

### Enable real "Continue with Google"

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   → **Create Credentials → OAuth client ID → Web application**.
2. Under **Authorized JavaScript origins** add `http://localhost:5173`
   (and your production URL when you deploy). No redirect URI needed —
   the app uses the GIS popup token flow.
3. Copy the client ID into `backend/.env`: `GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com`
4. Restart the backend. The frontend detects it via `GET /api/auth/config`.

Flow: browser popup → Google access token → `POST /api/auth/google` →
backend validates the token audience with Google, upserts the account by
email, and issues the app JWT.

## Getting started (dev)

```bash
npm run install:all          # install backend + frontend deps
cp backend/.env.example backend/.env   # then set DATABASE_URL (see below)
```

### Database

You develop directly against **Amazon RDS**. Point `DATABASE_URL` in
`backend/.env` at your instance and set `DATABASE_SSL=true`:

```
DATABASE_URL=postgres://<user>:<password>@<rds-endpoint>:5432/rooconnect
DATABASE_SSL=true
```

> Prefer a throwaway local DB while iterating? `docker run -d --name roo-pg -e
> POSTGRES_USER=roo -e POSTGRES_PASSWORD=roo_dev_pw -e POSTGRES_DB=rooconnect -p
> 5433:5432 postgres:16-alpine` — the default `DATABASE_URL` already targets it.

Then create the schema (and optionally load demo data on a FRESH database):

```bash
npm --prefix backend run db:migrate   # apply schema.sql (idempotent)
npm --prefix backend run db:seed      # demo dataset — fresh DBs only (guarded)
npm run dev                           # API (:4000) + web (:5173)
```

Open http://localhost:5173 and create an account via **Accept Invite**, or sign
in as the admin (`admin@rooman.com`, password = `ADMIN_PASSWORD` in .env).
If you seeded the demo data, every seeded alum uses `SEED_PASSWORD`
(default `roomandemo`).

## Scripts

- `npm run dev` — both servers
- `npm run dev:api` / `npm run dev:web` — one server
- `npm run build` — typecheck + build both
- `npm --prefix backend run db:migrate` / `db:seed` — schema + demo data (dev, tsx)
- `npm --prefix backend run db:migrate:prod` / `db:seed:prod` — same, from `dist/` (prod)

> **`db:seed` is a destructive reset** (truncate + re-insert demo data), but it
> refuses to run if any real (non-seed) account exists. To wipe everything
> anyway: `npm --prefix backend run db:seed -- --force`.

## Backend layout

```
backend/src/
├── config.ts            # validated env (DATABASE_URL, JWT_SECRET, …)
├── db/
│   ├── pool.ts          # pg Pool (+ SSL for RDS) + query/withTransaction helpers
│   ├── schema.sql       # DDL — the single source of truth for tables
│   ├── migrate.ts       # applies schema.sql
│   ├── seed.ts          # resets DB to the demo seed
│   └── seed-data.ts     # ported mock data
├── auth/                # password hashing, JWT, requireAuth/requireAdmin
├── notify.ts            # notification fan-out (single + broadcast)
├── routes/              # auth, users, posts, connections, messages, communities,
│                        #   mentorship, startups, notifications, invitees, invites, resume
├── mappers.ts           # DB row (snake_case) → API JSON (camelCase)
├── http.ts              # asyncHandler + error middleware
├── ai.ts / email.ts     # Claude resume parsing + SMTP invites
└── server.ts            # mounts routers
```

## API (Phase 1)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/api/health` | – | Liveness + DB check |
| POST | `/api/auth/signup` `/login` `/google` `/social/:provider` | – | Returns `{ token, user }` |
| GET | `/api/auth/config` | – | Which social providers are real |
| GET | `/api/auth/me` | ✔ | Current user |
| GET | `/api/users`, `/api/users/:id` | – | Directory / profile |
| PATCH | `/api/users/me` | ✔ | Update own profile |
| GET/POST | `/api/posts` | opt/✔ | Feed / create post |
| POST/DELETE | `/api/posts/:id/like` `/save` | ✔ | Like / bookmark toggles |
| POST | `/api/posts/:id/comments` | ✔ | Add comment |
| GET | `/api/connections` | ✔ | Connection graph |
| POST | `/api/connections/:id` `/:id/accept` `/:id/ignore` | ✔ | Requests |
| GET | `/api/messages/threads` | ✔ | Chat threads (unread + messages) |
| POST | `/api/messages/thread` | ✔ | Get-or-create a conversation with `{ userId }` |
| POST | `/api/messages/:id` `/:id/read` | ✔ | Send message / mark read |
| GET/POST | `/api/communities` | opt/✔ | List (joined flag) / create |
| POST/DELETE | `/api/communities/:id/join` | ✔ | Join / leave |
| GET/POST | `/api/mentorship/sessions` | ✔ | My sessions / book with `{ mentorId, topic }` |
| GET | `/api/mentorship/applications` | admin | Pending mentor applications |
| POST | `/api/mentorship/applications/:id/approve` `/decline` | admin | Approvals |
| GET/POST | `/api/startups` | opt/✔ | StartupVarsity listings / submit |
| GET | `/api/notifications` | ✔ | My notifications |
| POST | `/api/notifications/read-all` | ✔ | Mark all read |
| POST | `/api/posts/announce` | admin | Pin announcement + notify everyone |
| GET/POST | `/api/alumni`, `/api/alumni/bulk` | admin | Admin invitee directory |
| POST | `/api/invites/batch` | admin | Send invites (SMTP or simulated) |
| POST | `/api/resume/parse` | – | Claude resume parsing |

## Deploying to AWS

High-level target (details in your infra tooling):

1. **RDS for PostgreSQL** — private subnet; security group allows :5432 only
   from the backend's SG. Store credentials in **Secrets Manager**; the app
   reads them into `DATABASE_URL` at boot. `DATABASE_SSL=true`.
2. **Backend** — container (ECS Fargate / App Runner / Elastic Beanstalk).
   Run `npm run build`, then `db:migrate:prod` as a one-off release step, then
   `npm start`. Health check: `GET /api/health`. Set `JWT_SECRET`, `APP_URL`,
   and optional `ANT_KEY` / `SMTP_*` from Secrets Manager / env.
3. **Frontend** — `npm --prefix frontend run build` → upload `dist/` to **S3**,
   serve via **CloudFront** (HTTPS via ACM). Point `/api/*` at the backend
   (CloudFront behavior or an ALB) so the browser stays same-origin.

## Notes

- `ponytail:` marks intentional simulation shortcuts and their upgrade paths
  (WhatsApp invites, real OAuth, admin-route auth, DOCX resume parsing).
