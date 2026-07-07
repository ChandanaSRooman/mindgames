-- RooConnect — Phase 1 schema (users, posts, comments, likes, saves, connections, invitees).
-- Idempotent: safe to run repeatedly (CREATE ... IF NOT EXISTS).
-- Raw SQL, targets Postgres 14+ (Amazon RDS in prod, local Docker in dev).

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- users: the rich alumni profile + auth credentials.
-- id is TEXT: seed accounts keep stable ids ('rooman', 'a1'…); new signups
-- get a uuid. email is the login identity.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  password_hash       TEXT,                          -- null for the official 'rooman' account
  is_admin            BOOLEAN NOT NULL DEFAULT FALSE,
  avatar              TEXT NOT NULL DEFAULT '',       -- initials seed rendered by <Avatar>
  batch_year          INTEGER NOT NULL DEFAULT 0,
  course              TEXT NOT NULL DEFAULT '',
  company             TEXT NOT NULL DEFAULT '',
  designation         TEXT NOT NULL DEFAULT '',
  experience_years    INTEGER NOT NULL DEFAULT 0,
  domain              TEXT NOT NULL DEFAULT 'Web Dev',
  employment_type     TEXT NOT NULL DEFAULT 'Employed',
  city                TEXT NOT NULL DEFAULT '',
  bio                 TEXT NOT NULL DEFAULT '',
  linkedin            TEXT,
  expertise           TEXT[] NOT NULL DEFAULT '{}',
  willing_to_mentor   BOOLEAN NOT NULL DEFAULT FALSE,
  interested_in_startup BOOLEAN NOT NULL DEFAULT FALSE,
  connections_count   INTEGER NOT NULL DEFAULT 0,
  is_mentor           BOOLEAN NOT NULL DEFAULT FALSE,
  mentor_rate         INTEGER,
  sessions_conducted  INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_domain ON users (domain);

-- ---------------------------------------------------------------------------
-- posts: feed items authored by a user.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'Update'
                 CHECK (type IN ('Update','Hiring','Open to Work','Mentorship','StartupVarsity')),
  content      TEXT NOT NULL,
  image        TEXT,
  visibility   TEXT NOT NULL DEFAULT 'All Alumni'
                 CHECK (visibility IN ('All Alumni','My Network','Specific Community')),
  community_id TEXT,
  domain       TEXT,
  city         TEXT,
  batch        INTEGER,
  role         TEXT,
  company      TEXT,
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Denormalised like counter. post_likes tracks *who* liked (for likedByMe);
  -- this column carries the displayed total and is kept in sync on like/unlike.
  likes        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- ---------------------------------------------------------------------------
-- comments on a post.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at);

-- ---------------------------------------------------------------------------
-- likes & saves: one row per (post, user). Counts are derived, not stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_likes (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_saves (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- connections: directed request that becomes a mutual link when accepted.
--   pending  = requester asked addressee
--   accepted = connected (either direction implies connection)
--   ignored  = addressee dismissed the request
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connections (
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','ignored')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_addressee ON connections (addressee_id, status);

-- ---------------------------------------------------------------------------
-- invitees: contacts the admin adds / uploads and invites. On acceptance they
-- sign up and become a `users` row. (This is the old in-memory "Alumni" list.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitees (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'New Member',
  batch_year  INTEGER NOT NULL DEFAULT date_part('year', now()),
  status_tags TEXT[] NOT NULL DEFAULT '{}',
  invited_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Direct messages (1:1). A conversation is a unique unordered pair of users,
-- stored canonically as (user_lo < user_hi) so get-or-create is a single upsert.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_lo    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_hi    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_lo, user_hi),
  CHECK (user_lo < user_hi)
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);

-- Per-user read cursor: unread = messages from the other party after last_read_at.
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- ---------------------------------------------------------------------------
-- communities: member_count is denormalised (like posts.likes) so the seeded
-- display numbers survive; community_members tracks who actually joined.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'General'
                 CHECK (category IN ('Domain','City','Batch','General')),
  tag          TEXT NOT NULL DEFAULT '',
  color        TEXT NOT NULL DEFAULT 'from-orange-500 to-rose-600',
  member_count INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Acceptance flow: member-created communities start 'pending' and appear only
-- to their creator until an admin approves. Admin-created ones are 'approved'.
ALTER TABLE communities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_status_check;
ALTER TABLE communities
  ADD CONSTRAINT communities_status_check CHECK (status IN ('pending','approved','rejected'));

CREATE TABLE IF NOT EXISTS community_members (
  community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

-- ---------------------------------------------------------------------------
-- mentorship sessions + mentor applications (admin-approved).
-- date/time are display labels for now ("Mon, 30 Jun 2026", "6:00 PM IST").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mentor_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL,
  date_label TEXT NOT NULL DEFAULT 'To be scheduled',
  time_label TEXT NOT NULL DEFAULT 'TBD',
  status     TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session lifecycle: requested → (mentor accepts) upcoming → (mentor completes)
-- past; or requested → declined. Constraint re-applied so upgrades pick up new
-- statuses.
ALTER TABLE mentorship_sessions DROP CONSTRAINT IF EXISTS mentorship_sessions_status_check;
ALTER TABLE mentorship_sessions
  ADD CONSTRAINT mentorship_sessions_status_check
  CHECK (status IN ('requested','upcoming','declined','past'));
ALTER TABLE mentorship_sessions ALTER COLUMN status SET DEFAULT 'requested';

CREATE INDEX IF NOT EXISTS idx_sessions_mentee ON mentorship_sessions (mentee_id, status);

CREATE TABLE IF NOT EXISTS mentor_applications (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- startups (StartupVarsity applications).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startups (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  founder_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  domain      TEXT NOT NULL DEFAULT 'Web Dev',
  stage       TEXT NOT NULL DEFAULT 'Idea' CHECK (stage IN ('Idea','MVP','Early Revenue','Scaling')),
  team_size   INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- job applications: an alumnus applying to a Hiring post. One row per
-- (post, applicant) — applying twice is a no-op.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_applications (
  post_id      TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_job_applications_post ON job_applications (post_id, created_at);

-- ---------------------------------------------------------------------------
-- notifications: one row per recipient. Generated on like/comment/connect/
-- accept/booking/announcement.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
               CHECK (type IN ('connection','like','comment','job','mentorship','community','announcement')),
  text       TEXT NOT NULL,
  actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
