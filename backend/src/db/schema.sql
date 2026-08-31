-- Root Connect — Phase 1 schema (users, posts, comments, likes, saves, connections, invitees).
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
  -- Profile photo as a small data URL (client downscales to ~256px JPEG).
  photo               TEXT,
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;

-- Profile status tag shown on the profile header ('Mentor'/'Hiring'/'Open to Work').
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_tag TEXT;
-- Set when the user clicks the verification link emailed at signup.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
-- Weekly digest email opt-out (Settings toggle).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_digest BOOLEAN NOT NULL DEFAULT TRUE;
-- Current institution name — only meaningful when employment_type = 'Student'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS college TEXT NOT NULL DEFAULT '';

-- Employer verification: to post a Hiring/job, a user proves they work at a
-- company by verifying a work email (one-time OTP). work_verified_at NULL =
-- not a verified employer. Only verified employers (or admins) can post jobs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_email_domain TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_verified_at TIMESTAMPTZ;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_profile_tag_check;
ALTER TABLE users
  ADD CONSTRAINT users_profile_tag_check
  CHECK (profile_tag IS NULL OR profile_tag IN ('Mentor','Hiring','Open to Work'));

CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'Update'
                 CHECK (type IN ('Update','Hiring','Open to Work','Mentorship','StartupVarsity',
                                 'Achievement','Project','Article','Meetup')),
  content      TEXT NOT NULL,
  -- Format-specific fields for peer-to-peer news types (Achievement, Project,
  -- Article, Meetup). Shape varies by type — see mappers.ts / types.ts.
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  image        TEXT,
  visibility   TEXT NOT NULL DEFAULT 'All Alumni'
                 CHECK (visibility IN ('All Alumni','My Network','Specific Community')),
  community_id TEXT,
  domain       TEXT,
  city         TEXT,
  batch        INTEGER,
  role         TEXT,
  company      TEXT,
  -- Hiring posts: questions the poster wants every applicant to answer
  -- (JSON array of strings, max 5 enforced in the route).
  questions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Hiring posts: whether applicants must attach a resume when applying.
  wants_resume BOOLEAN NOT NULL DEFAULT FALSE,
  -- Hiring posts: FALSE = closed, no longer accepting applications.
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Denormalised like counter. post_likes tracks *who* liked (for likedByMe);
  -- this column carries the displayed total and is kept in sync on like/unlike.
  likes        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade path for databases created before application questions existed.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS wants_resume BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
-- Peer-to-peer news formats: structured per-type fields + the widened type set.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE posts ADD CONSTRAINT posts_type_check
  CHECK (type IN ('Update','Hiring','Open to Work','Mentorship','StartupVarsity',
                  'Achievement','Project','Article','Meetup'));

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
-- post_reactions: one emoji reaction per (post, user). Supersedes the plain
-- like in the UI (👍/🎉/❤️). Counts are derived per emoji.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_reactions (
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions (post_id);
-- One-time backfill: existing likes become 👍 reactions so nothing is lost.
INSERT INTO post_reactions (post_id, user_id, emoji)
  SELECT post_id, user_id, '👍' FROM post_likes
  ON CONFLICT (post_id, user_id) DO NOTHING;

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

-- Connection request note (personal message from requester to addressee).
ALTER TABLE connections ADD COLUMN IF NOT EXISTS note TEXT;

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

-- Optional file attachment on a chat message (e.g. sharing a resume in a
-- referral conversation). Mirrors job_applications' resume_* columns —
-- inline storage, same ~5MB cap enforced in the route.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_data BYTEA;

-- Set when the sender edits a message (route enforces a 5-minute window).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

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
-- Meeting link the mentor shares on acceptance + the mentee's post-session rating.
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS review TEXT;
-- Free allowance: a mentee's first 3 sessions are free; the 4th onward is paid
-- at the mentor's rate (display-only — payment arranged offline). price is a
-- ₹ snapshot of the mentor's rate at booking time.
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mentorship_sessions DROP CONSTRAINT IF EXISTS mentorship_sessions_rating_check;
ALTER TABLE mentorship_sessions
  ADD CONSTRAINT mentorship_sessions_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

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
  -- Who may see the idea: the whole network, or only Rooman admins (+ founder).
  visibility  TEXT NOT NULL DEFAULT 'network' CHECK (visibility IN ('network','admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade path for databases created before idea visibility existed.
ALTER TABLE startups ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'network';
ALTER TABLE startups DROP CONSTRAINT IF EXISTS startups_visibility_check;
ALTER TABLE startups
  ADD CONSTRAINT startups_visibility_check CHECK (visibility IN ('network','admin'));

-- ---------------------------------------------------------------------------
-- job applications: an alumnus applying to a Hiring post. One row per
-- (post, applicant) — applying twice is a no-op.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_applications (
  post_id      TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Answers to the post's application questions (JSON array of strings,
  -- index-aligned with posts.questions).
  answers      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Attached resume (when the post asks for one). Stored inline — files are
  -- capped at ~5MB in the route, fine at this network's scale.
  resume_name  TEXT,
  resume_type  TEXT,
  resume_data  BYTEA,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, applicant_id)
);

-- Upgrade path for databases created before application questions existed.
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_name TEXT;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_type TEXT;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS resume_data BYTEA;

CREATE INDEX IF NOT EXISTS idx_job_applications_post ON job_applications (post_id, created_at);

-- ---------------------------------------------------------------------------
-- events: alumni meetups, webinars and reunions, with RSVP.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  creator_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  location     TEXT NOT NULL DEFAULT '',
  meeting_link TEXT,
  starts_at    TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);

-- 24h-before reminder bookkeeping.
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminded BOOLEAN NOT NULL DEFAULT FALSE;

-- Acceptance flow: member-created events start 'pending' and are visible only to
-- their creator until an admin approves. Admin-created ones are 'approved'. The
-- default is 'approved' so events created before this column keep showing.
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events
  ADD CONSTRAINT events_status_check CHECK (status IN ('pending','approved','rejected'));

-- Paid events: is_paid flags a ticketed event; price is the amount in whole
-- rupees. Display only — payment is collected offline / at the venue.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Links a feed post to the event it's about (host/admin update, recap, etc).
-- `events` must exist before this ALTER runs, hence it lives down here.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_posts_event ON posts (event_id) WHERE event_id IS NOT NULL;

-- Capacity + waitlist: NULL capacity = unlimited. RSVPs beyond capacity are
-- flagged waitlisted and promoted in arrival order as confirmed spots free up.
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_capacity_check;
ALTER TABLE events ADD CONSTRAINT events_capacity_check CHECK (capacity IS NULL OR capacity > 0);
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS waitlisted BOOLEAN NOT NULL DEFAULT FALSE;

-- Speakers/agenda contributors shown in the event's quick-view drawer.
-- JSON array of {name, bio}, host-entered at creation time.
ALTER TABLE events ADD COLUMN IF NOT EXISTS speakers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- event_comments: a discussion/Q&A thread on the event itself (distinct from
-- the event's linked feed posts and their comments).
CREATE TABLE IF NOT EXISTS event_comments (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_comments_event ON event_comments (event_id, created_at);

-- event_feedback: one rating (+ optional comment) per confirmed attendee,
-- submitted once the event has started.
CREATE TABLE IF NOT EXISTS event_feedback (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- auth_tokens: single-use, hashed email tokens (password reset + verification).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('reset','verify')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens (user_id, purpose);

-- ---------------------------------------------------------------------------
-- work_email_otps: short-lived 6-digit codes for employer (work-email)
-- verification. One active code per user — a resend replaces the row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_email_otps (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,             -- sha256 of the 6-digit code
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- signup_otps: short-lived 6-digit codes that verify a new member's email
-- address during registration, before the account exists. Keyed by email — a
-- resend replaces the row; the row is consumed when the account is created.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signup_otps (
  email      TEXT PRIMARY KEY,          -- lower-cased
  code_hash  TEXT NOT NULL,             -- sha256 of the 6-digit code
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- reports: members flagging posts/users for the admin team to review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','user')),
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- companies: browsable employer directory for the Companies page. Alumni are
-- matched to a company by comparing users.company (free text) case/whitespace
-- -insensitively — no FK on users, so existing profile data is untouched.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  domain     TEXT,          -- e.g. 'google.com'; drives the logo, nullable
  industry   TEXT NOT NULL DEFAULT 'Other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name ON companies (LOWER(name));

-- Bookmarked companies ("Save Company"), mirrors post_saves.
CREATE TABLE IF NOT EXISTS company_saves (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);

-- Curated employers with a known domain (real logo via a domain-based logo
-- service on the frontend). Idempotent — re-running never duplicates rows.
INSERT INTO companies (name, domain, industry) VALUES
  ('Google', 'google.com', 'Technology'),
  ('Microsoft', 'microsoft.com', 'Technology'),
  ('Amazon', 'amazon.com', 'Technology'),
  ('Meta', 'meta.com', 'Technology'),
  ('Apple', 'apple.com', 'Technology'),
  ('Netflix', 'netflix.com', 'Technology'),
  ('Adobe', 'adobe.com', 'Technology'),
  ('Oracle', 'oracle.com', 'Technology'),
  ('Salesforce', 'salesforce.com', 'Technology'),
  ('IBM', 'ibm.com', 'Technology'),
  ('TCS', 'tcs.com', 'IT Services'),
  ('Infosys', 'infosys.com', 'IT Services'),
  ('Wipro', 'wipro.com', 'IT Services'),
  ('Accenture', 'accenture.com', 'IT Services'),
  ('Cognizant', 'cognizant.com', 'IT Services'),
  ('HCLTech', 'hcltech.com', 'IT Services'),
  ('Tech Mahindra', 'techmahindra.com', 'IT Services'),
  ('Capgemini', 'capgemini.com', 'IT Services'),
  ('Flipkart', 'flipkart.com', 'Product'),
  ('Swiggy', 'swiggy.com', 'Product'),
  ('Zomato', 'zomato.com', 'Product'),
  ('Paytm', 'paytm.com', 'Product'),
  ('PhonePe', 'phonepe.com', 'Product'),
  ('Razorpay', 'razorpay.com', 'Product'),
  ('Freshworks', 'freshworks.com', 'Product'),
  ('Zoho', 'zoho.com', 'Product'),
  ('Goldman Sachs', 'goldmansachs.com', 'Finance'),
  ('JPMorgan Chase', 'jpmorganchase.com', 'Finance'),
  ('Morgan Stanley', 'morganstanley.com', 'Finance'),
  ('Deloitte', 'deloitte.com', 'Consulting'),
  ('EY', 'ey.com', 'Consulting'),
  ('PwC', 'pwc.com', 'Consulting'),
  ('KPMG', 'kpmg.com', 'Consulting'),
  ('McKinsey & Company', 'mckinsey.com', 'Consulting'),
  ('BCG', 'bcg.com', 'Consulting'),
  ('Larsen & Toubro', 'larsentoubro.com', 'Manufacturing'),
  ('Tata Motors', 'tatamotors.com', 'Manufacturing')
ON CONFLICT (LOWER(name)) DO NOTHING;

-- Backfill: any employer alumni have actually typed on their profile that
-- isn't already in the curated list above still shows up on the Companies
-- page (no logo — the frontend falls back to an initials badge).
INSERT INTO companies (name, industry)
  SELECT DISTINCT TRIM(u.company), 'Other'
  FROM users u
  WHERE TRIM(u.company) <> ''
    AND NOT EXISTS (SELECT 1 FROM companies c WHERE LOWER(c.name) = LOWER(TRIM(u.company)))
ON CONFLICT (LOWER(name)) DO NOTHING;

-- ---------------------------------------------------------------------------
-- app_meta: tiny key/value store (e.g. when the weekly digest last went out).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- notifications: one row per recipient. Generated on like/comment/connect/
-- accept/booking/announcement.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  text       TEXT NOT NULL,
  actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- Notification types are re-checked here so upgrades pick up new ones.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('connection','like','comment','job','mentorship','community','announcement','event'));
