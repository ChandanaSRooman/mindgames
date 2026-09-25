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

-- Every company query matches members on their free-text employer through
-- LOWER(TRIM(company)) -- see matchesCompany() in routes/companies.routes.ts,
-- the single place that rule lives. An expression index has to match that
-- expression exactly to be usable, so this mirrors it character for character.
-- Without it each company row on /companies/for-you drives its own sequential
-- scan of users, and that endpoint refires on every tab-visibility change.
CREATE INDEX IF NOT EXISTS idx_users_company_lower ON users (LOWER(TRIM(company)));

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

-- must_change_password: TRUE on accounts created by an admin invite, whose
-- password was generated for them and mailed in the clear (see
-- invites.routes.ts). Cleared the first time they set their own password.
-- Only prompts; it never blocks access, so a stuck flag can't lock anyone out.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- last_login_at: stamped on every successful sign-in. Without it the console
-- could only INFER whether an invited member ever arrived (by whether they'd
-- replaced their generated password), which cannot tell "never signed in"
-- apart from "signed in and skipped the password prompt". NULL = never.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- is_private: a private member's POSTS and rich profile detail are visible
-- only to their connections. Their card-level identity (name, photo, bio,
-- batch, course, role) stays public so they remain discoverable — otherwise
-- nobody could find them to send a request in the first place.
-- Defaults FALSE so every existing account stays exactly as it is today.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;
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

-- Per-recipient outcome of the last invite send, so the console can show who
-- actually received their credentials rather than just who was selected.
-- invite_status: 'sent' (SMTP accepted it), 'failed' (it did not — invite_error
-- says why), or 'simulated' (no SMTP configured; logged instead of delivered).
-- NULL = never attempted.
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS invite_status TEXT;
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS invite_error TEXT;
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS invite_count INTEGER NOT NULL DEFAULT 0;

-- A copy of the invite that actually went out, so the console can show what a
-- recipient received rather than re-deriving it from a template that may have
-- been edited since. The password is REDACTED in this copy — it is bcrypt'd at
-- account creation and must never exist in readable form anywhere.
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS invite_sent_subject TEXT;
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS invite_sent_body TEXT;

-- Which import an invitee arrived in. Admins load alumni in batches (one CSV
-- per centre/course/year), and need to work through them a batch at a time —
-- without this every upload dissolves into one undifferentiated list.
-- NULL = added before batches were tracked.
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS batch_label TEXT;
CREATE INDEX IF NOT EXISTS invitees_batch_label_idx ON invitees (batch_label);

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
  -- What the notification is ABOUT, so the UI can link to the thing itself
  -- rather than to a page of that kind. Both nullable: older rows, and
  -- notifications that are genuinely about nothing but you ("you passed the
  -- mentor assessment"), fall back to the per-type route.
  target_type TEXT,
  target_id   TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- Upgrade path for databases created before notifications carried a target.
-- No foreign key: target_id points at one of several tables depending on
-- target_type, so there is no single table to reference. A deleted target
-- therefore leaves a dead id, which the frontend treats as "no target" and
-- falls back to the type route — a stale link, never a crash.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_id   TEXT;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_target_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_target_type_check
  CHECK (target_type IS NULL OR target_type IN
    ('post','event','community','user','company','startup','session','conversation'));

-- Notification types are re-checked here so upgrades pick up new ones.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('connection','like','comment','job','mentorship','community','announcement','event','message'));

-- ---------------------------------------------------------------------------
-- Rich profile detail (additive). Every column is nullable or defaulted, so
-- existing accounts keep working and simply score lower on profile
-- completeness until the member fills them in — manually or by uploading a
-- resume from their profile.
--
-- The uploaded resume file is never stored; only this extracted JSON is, and
-- the member can edit it from the profile afterwards.
-- ---------------------------------------------------------------------------

-- Resume-parseable structures. JSONB (arrays of objects) mirrors how posts.meta
-- and events.speakers are already stored.
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience     JSONB  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS education      JSONB  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS projects       JSONB  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS certifications JSONB  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements   JSONB  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS other_links    JSONB  NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages_known TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS github         TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry       TEXT NOT NULL DEFAULT '';

-- Preferences.
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_mode      TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS open_to_relocate BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS open_to_speak_at_events BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rooman_center  TEXT NOT NULL DEFAULT '';

-- Mentorship: only collected once willing_to_mentor is on.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_topics       TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_availability TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentorship_mode     TEXT NOT NULL DEFAULT '';

-- Referrals & hiring.
ALTER TABLE users ADD COLUMN IF NOT EXISTS open_to_referrals BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_note     TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS hiring_for        TEXT[] NOT NULL DEFAULT '{}';

-- StartupVarsity: only collected once interested_in_startup is on.
ALTER TABLE users ADD COLUMN IF NOT EXISTS startup_intent       TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS startup_looking_for  TEXT[] NOT NULL DEFAULT '{}';

-- Private: stored, but only ever returned/rendered for the owner themselves
-- (see mapUser's `viewerIsOwner` argument). phone is treated the same way.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notice_period        TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locations  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS seeking_mentorship_in TEXT[] NOT NULL DEFAULT '{}';

-- Multi-select profile tags. The older single `profile_tag` column stays for
-- backwards compatibility; this is what the profile's tag editor writes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_tags TEXT[] NOT NULL DEFAULT '{}';

-- Mentor assessment result. Recorded by an admin (POST /api/mentorship/
-- assessment) so a member cannot self-certify; one of three ways to qualify as
-- a mentor, alongside a postgraduate degree and 2+ years of experience.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_assessment_score    INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_assessment_provider TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_assessment_at       TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Mentor application proof documents.
--
-- Mentoring can't be self-declared: the member picks which requirement they
-- meet (2+ years' experience / a postgraduate degree / a passed assessment),
-- attaches evidence, and an admin verifies it. `users.mentor_verified_at` is
-- what actually unlocks mentoring — set by the approve route, cleared on
-- decline — so typing "M.Tech" into your own Education list is no longer
-- enough on its own.
-- ---------------------------------------------------------------------------
ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS claim       TEXT NOT NULL DEFAULT '';
ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS note        TEXT NOT NULL DEFAULT '';
ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE mentor_applications ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE mentor_applications DROP CONSTRAINT IF EXISTS mentor_applications_claim_check;
ALTER TABLE mentor_applications
  ADD CONSTRAINT mentor_applications_claim_check
  CHECK (claim IN ('', 'experience', 'postgrad', 'assessment'));

-- Set once an admin has verified the evidence. NULL = not a verified mentor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_verified_at TIMESTAMPTZ;

-- One row per uploaded document. Stored inline as BYTEA with the same ~5MB cap
-- the route enforces, mirroring job_applications.resume_* and messages
-- .attachment_*.
CREATE TABLE IF NOT EXISTS mentor_application_docs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES mentor_applications(user_id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_docs_user ON mentor_application_docs (user_id);

-- The grandfather backfill that used to live here (auto-verifying any
-- pre-existing mentor) has been removed and reversed: every mentor now goes
-- through the same evidence-and-approval flow, no exceptions. See
-- mentorship.routes.ts for that flow.

-- Contact visibility. Phone and email are PRIVATE by default: they are the two
-- fields members are most often uncomfortable broadcasting, and an alumni
-- directory has no need to publish them. Each can be opted into public
-- individually. mapUser withholds whichever is off; mapOwnUser always returns
-- both to the owner.
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_phone BOOLEAN NOT NULL DEFAULT FALSE;

-- Sensitive personal details. Collected because they are useful for matching
-- (a recruiter filtering on location, a jobs feed on expected salary), but
-- PRIVATE BY DEFAULT and individually lockable: each has its own show_* flag,
-- and mapUser withholds any field whose flag is off. Nothing here is ever
-- published without the member switching it on.
--
-- Date of birth is stored, not age: age computed from a date stays correct,
-- whereas a stored number silently rots. mapUser derives the age.
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_address     TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth    DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_current   INTEGER;   -- ₹ per year
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_expected  INTEGER;   -- ₹ per year
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_address     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_age         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_salary      BOOLEAN NOT NULL DEFAULT FALSE;

-- Profile banner theme — the "cover photo" colour on a member's own profile
-- hero. A curated palette (see BANNER_THEMES in frontend/src/types.ts), not a
-- free colour value, so a bad pick can't clash with the surrounding UI.
-- Enforced again here, not just in the frontend: the CHECK constraint is what
-- actually stops an out-of-range value reaching the database.
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_theme TEXT NOT NULL DEFAULT 'sunrise';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_banner_theme_check;
ALTER TABLE users
  ADD CONSTRAINT users_banner_theme_check
  CHECK (banner_theme IN ('sunrise', 'midnight', 'forest', 'plum', 'slate'));

-- A custom cover photo overrides banner_theme entirely when present; NULL
-- means "use the theme gradient". Stored the same way as `photo` (an inline
-- data URL), just with a larger cap since a 1200x400 cover photo is bigger
-- than a 384x384 avatar.
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_image TEXT;

-- ---------------------------------------------------------------------------
-- email_templates: admin-editable copy for the emails this app sends, keyed
-- by purpose ('invite'). A missing row means "use the built-in default" (see
-- email.ts), so this table only ever holds deliberate overrides — that's what
-- makes "reset to default" a DELETE rather than a copy of the default text.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_templates (
  key        TEXT PRIMARY KEY,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Company roadmaps: how alumni actually got into a company.
--
-- The timeline itself is NOT stored here. A member's path is already in
-- users.experience (a JSONB array of {role, company, period, summary}) plus
-- their course, batch_year and certifications — so a roadmap is derived from
-- the profile they already maintain, and stays correct when they update it.
-- Duplicating it would create a second copy that silently rots.
--
-- What IS stored is the part that exists nowhere else: the advice an alumnus
-- writes on top of their own timeline when asked to help others in.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_roadmap_contributions (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The role this path leads to, e.g. 'Senior Data Engineer'. Defaults to the
  -- contributor's designation when they don't override it.
  role       TEXT NOT NULL DEFAULT '',
  -- One-line summary of the route in, shown under their name in the list.
  headline   TEXT NOT NULL DEFAULT '',
  -- Ordered extra steps the profile timeline cannot express: what to learn,
  -- what the interview was like. Array of {title, detail}. The timeline
  -- supplies the WHERE and WHEN; these supply the HOW.
  stages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Free-text advice shown as the closing note on their roadmap.
  advice     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One contribution per person per company: re-submitting edits their own
  -- entry rather than stacking duplicates onto the company page.
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_roadmap_contrib_company
  ON company_roadmap_contributions (company_id, updated_at DESC);

-- Records that someone asked the alumni at a company to share their path.
-- Exists purely so the ask can be rate-limited: without it, a company page
-- with 20 alumni is a one-click way to notification-bomb 20 members.
CREATE TABLE IF NOT EXISTS company_roadmap_requests (
  company_id   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- How many alumni the ask actually reached, for the confirmation message.
  notified     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, requester_id)
);

-- ---------------------------------------------------------------------------
-- Company aliases: other spellings of the same employer.
--
-- users.company is free text that members type themselves, so one employer
-- arrives as "Rooman", "Rooman Technologies" and "Rooman Technologies,
-- Bengaluru" — three directory entries splitting one company's alumni between
-- them, and three separate roadmap pages.
--
-- An alias list rather than a data merge: nothing is deleted and no member's
-- profile is rewritten, so this is reversible by emptying the array, and a new
-- spelling is fixed by adding one string instead of editing people's records.
-- A company whose own name appears in another company's aliases is treated as
-- folded into that one and is hidden from the directory.
-- ---------------------------------------------------------------------------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

-- Idempotent: re-running replaces the same list rather than appending to it.
UPDATE companies
   SET aliases = ARRAY['Rooman', 'Rooman Technologies, Bengaluru']
 WHERE LOWER(name) = 'rooman technologies';

-- ---------------------------------------------------------------------------
-- Career Guidance
--
-- career_assessments: one row per submission. A retake or an "Edit Assessment"
-- INSERTs a new row rather than overwriting the last one, so a member's
-- answer history is never lost. `status` distinguishes an in-progress draft
-- (autosaved step-by-step so leaving the wizard halfway doesn't lose answers)
-- from a completed submission that triggered roadmap generation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS career_assessments (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  current_situation  TEXT NOT NULL DEFAULT '',
  goal_type          TEXT NOT NULL DEFAULT '',
  target_role        TEXT NOT NULL DEFAULT '',
  target_role_unsure BOOLEAN NOT NULL DEFAULT FALSE,
  hours_per_week     INTEGER,
  timeline_months    INTEGER,
  extra_skills_note  TEXT NOT NULL DEFAULT '',
  learning_prefs     TEXT[] NOT NULL DEFAULT '{}',
  support_preference TEXT NOT NULL DEFAULT '',
  help_types         TEXT[] NOT NULL DEFAULT '{}',
  free_text          TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One draft per member at a time: re-saving a step UPSERTs the same draft row
-- instead of piling up abandoned drafts. Submitted rows are never touched by
-- this constraint, since it's scoped to status = 'draft'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_career_assessments_one_draft
  ON career_assessments (user_id) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_career_assessments_user
  ON career_assessments (user_id, created_at DESC);

-- career_roadmaps: the AI-generated plan for one assessment. A new submission
-- always generates a new version and archives the previous one — nothing is
-- ever deleted, so a member can look back at how their plan has changed.
CREATE TABLE IF NOT EXISTS career_roadmaps (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES career_assessments(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  -- The structured plan: { goal, timelineMonths, hoursPerWeek, stages: [...] }.
  -- See backend/src/careerRoadmap.ts for the exact shape and how it is built.
  data          JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active roadmap per member — generating a new one flips the old
-- row to 'archived' in the same transaction that inserts the new one.
CREATE UNIQUE INDEX IF NOT EXISTS idx_career_roadmaps_one_active
  ON career_roadmaps (user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_career_roadmaps_user
  ON career_roadmaps (user_id, version DESC);

-- career_roadmap_step_state: per-step progress, kept separate from the
-- roadmap's own JSON so marking a step complete/paused never requires
-- rewriting (and re-versioning) the whole generated plan.
CREATE TABLE IF NOT EXISTS career_roadmap_step_state (
  roadmap_id   TEXT NOT NULL REFERENCES career_roadmaps(id) ON DELETE CASCADE,
  step_key     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'paused')),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (roadmap_id, step_key)
);

-- career_paths: auto-derived from users.experience — each row is one observed
-- role transition ("Backend Developer" -> "Cloud Engineer") an alumnus made.
-- This is what powers "alumni who followed a similar path"; see
-- backend/src/careerPaths.ts for how rows are derived and kept idempotent.
-- `source` reserves room for an optional alumni-added-advice layer later
-- ('alumni_enriched') without changing anything about this table's shape.
CREATE TABLE IF NOT EXISTS career_paths (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_role  TEXT NOT NULL,
  to_role    TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'alumni_enriched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, from_role, to_role)
);

CREATE INDEX IF NOT EXISTS idx_career_paths_from ON career_paths (from_role);
CREATE INDEX IF NOT EXISTS idx_career_paths_to ON career_paths (to_role);

-- alumni_services: things an approved mentor offers to other members. Gated
-- on is_mentor (enforced in career.routes.ts) — this reuses the existing
-- mentor-verification trust bar instead of creating a second, unvetted tier
-- of service providers. Multiple rows per (user_id, service_type) are
-- allowed on purpose: one mentor can list two differently-scoped offerings
-- of the same type (e.g. two flavours of "Technical mentoring").
CREATE TABLE IF NOT EXISTS alumni_services (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type  TEXT NOT NULL CHECK (service_type IN (
    'career_guidance', 'resume_review', 'interview_preparation', 'technical_mentoring',
    'project_guidance', 'industry_guidance', 'career_transition', 'freelance_consulting',
    'portfolio_review', 'linkedin_review', 'mock_interview', 'code_project_review',
    'startup_business_guidance', 'domain_specific_advice'
  )),
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  -- Matching keywords, same array pattern as users.expertise. Combines what
  -- would otherwise be separate "skills" and "domains" fields — both are just
  -- tags ORed together in the matching query (see career.routes.ts).
  tags          TEXT[] NOT NULL DEFAULT '{}',
  pricing_mode  TEXT NOT NULL DEFAULT 'free' CHECK (pricing_mode IN ('free', 'paid', 'custom')),
  -- Set only when pricing_mode = 'paid'. Same display-only-integer pattern as
  -- mentorship_sessions.price — no payment gateway (deliberately deferred).
  amount        INTEGER,
  pricing_unit  TEXT CHECK (pricing_unit IN ('hour', 'session')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alumni_services_user ON alumni_services (user_id);
CREATE INDEX IF NOT EXISTS idx_alumni_services_active ON alumni_services (service_type) WHERE active;

-- Booking bridge: a service booking is just a normal mentorship_sessions row
-- with this column pointing back at which service it came from. No parallel
-- booking system — accept/decline/rate/complete all stay exactly as they are.
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS service_id TEXT REFERENCES alumni_services(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Mentor subscriptions
--
-- A mentor needs an active subscription to ACCEPT a session. This is the
-- supply side only: a mentee's first few sessions stay free (see
-- FREE_MENTORSHIP_SESSIONS), which is a separate, unrelated allowance.
--
-- Deliberately provider-agnostic. `provider` and `provider_ref` are the only
-- columns a payment gateway needs, so wiring one up later sets those two
-- rather than reshaping the table. Until then a subscription is granted by an
-- admin or by the grandfathering rule below — the same "arranged offline"
-- posture the rest of this app's pricing already takes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mentor_subscriptions (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'mentor', 'pro', 'institute')),
  status       TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'pending', 'active', 'expired', 'cancelled')),
  -- How this subscription came to be, so support can tell a comped account
  -- from a paid one without reading payment history.
  source       TEXT NOT NULL DEFAULT 'none' CHECK (source IN ('none', 'grandfathered', 'admin', 'gateway')),
  provider     TEXT,
  provider_ref TEXT,
  started_at   TIMESTAMPTZ,
  -- NULL means "no end date" (an admin grant). A grandfathered or paid period
  -- sets this, and the gate treats a past date as expired.
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_subs_status ON mentor_subscriptions (status, expires_at);

-- Every payment-ish event, whoever produced it. Exists so a gateway webhook
-- has somewhere idempotent to land: a provider re-sending the same event id
-- must not grant a second month. Also the audit trail for admin grants.
CREATE TABLE IF NOT EXISTS subscription_events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('requested', 'activated', 'renewed', 'cancelled', 'expired', 'payment_failed')),
  plan         TEXT NOT NULL DEFAULT 'free',
  amount       INTEGER,
  provider     TEXT,
  -- The provider's own event id. Unique so a replayed webhook is a no-op.
  provider_ref TEXT,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_events_provider_ref
  ON subscription_events (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events (user_id, created_at DESC);

-- Grandfathering: mentors approved before subscriptions existed keep working.
-- 90 days of 'pro' so nobody is cut off the day the gate ships. Inserted once
-- per mentor — ON CONFLICT DO NOTHING means re-running the migration never
-- extends the window, and never overwrites a real subscription bought later.
--
-- Scoped to mentors verified before the cutoff below, not to "any mentor
-- without a subscriptions row yet": schema.sql reruns on every deploy, and an
-- unscoped WHERE is_mentor would silently re-grant this free 90 days to every
-- mentor approved AFTER the gate shipped too, bypassing the paywall forever.
-- NULL mentor_verified_at (seeded demo mentors, or any mentor that predates
-- that column) is treated as "before the cutoff" since there is no later
-- timestamp to compare against.
INSERT INTO mentor_subscriptions (user_id, plan, status, source, started_at, expires_at)
SELECT id, 'pro', 'active', 'grandfathered', now(), now() + INTERVAL '90 days'
  FROM users
 WHERE is_mentor
   AND (mentor_verified_at IS NULL OR mentor_verified_at < TIMESTAMPTZ '2026-09-23 00:00:00+00')
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Session tracking
--
-- date_label/time_label are free text a human typed ("Mon, 30 Jun", "6:00 PM
-- IST"). They stay exactly as they are and keep driving the existing UI — but
-- you cannot compute hours, streaks or "sessions this month" from them, so
-- these columns record the same facts in a form that can be queried.
--
-- mentee_confirmed/mentor_confirmed are the load-bearing pair: a session only
-- counts toward anybody's profile once BOTH sides say it happened. That makes
-- the numbers on a profile evidence rather than a self-reported claim, and it
-- is what makes an empty duration on a "completed" session visible.
-- ---------------------------------------------------------------------------
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
-- When the mentor accepted the request, not when the mentee sent it
-- (created_at). The monthly session cap counts against this: a request that
-- sat unaccepted for weeks must not eat a cap month it was never actioned in,
-- and a request accepted this month must count against this month even if it
-- was sent last month.
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT '';
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS mentee_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS mentor_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
-- Who asked for this session — the mentee booking a mentor (the only way
-- this worked until now), or the mentor proactively offering a connection a
-- slot. Decides which side is the one who has to accept/decline: a mentee
-- request waits on the mentor, a mentor offer waits on the mentee.
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS requested_by TEXT NOT NULL DEFAULT 'mentee' CHECK (requested_by IN ('mentor', 'mentee'));

CREATE INDEX IF NOT EXISTS idx_sessions_mentor_confirmed
  ON mentorship_sessions (mentor_id, confirmed_at DESC) WHERE confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_mentee_confirmed
  ON mentorship_sessions (mentee_id, confirmed_at DESC) WHERE confirmed_at IS NOT NULL;

-- Badges earned from confirmed activity. Stored rather than derived on every
-- read so "when did you earn this" is answerable, and so awarding one can
-- raise a notification exactly once.
CREATE TABLE IF NOT EXISTS profile_badges (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge      TEXT NOT NULL,
  -- 'mentor' badges describe help given, 'learner' badges help received.
  side       TEXT NOT NULL DEFAULT 'learner' CHECK (side IN ('mentor', 'learner')),
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge)
);

CREATE INDEX IF NOT EXISTS idx_profile_badges_user ON profile_badges (user_id, earned_at DESC);

-- ---------------------------------------------------------------------------
-- Group sessions
--
-- A separate table rather than reusing mentorship_sessions: that table's
-- whole shape is one mentor + one mentee (composite lookups, FREE_SESSIONS
-- counting, the mentor_id/mentee_id pair everywhere) and a session with a
-- capacity and a roster of attendees doesn't fit it without turning every
-- 1:1 query into "and also handle the group case". Attendees get their own
-- table for the same reason events already separate event_rsvps out.
--
-- Gated on the same subscription as 1:1 sessions, but requires the plan's
-- groupSessions flag (Pro/Institute) — see subscription.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_sessions (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mentor_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  domain            TEXT NOT NULL DEFAULT '',
  -- Real timestamp, not a free-text label — a group session needs a genuine
  -- capacity/roster query, which date_label on mentorship_sessions can't do.
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER NOT NULL DEFAULT 60,
  capacity          INTEGER NOT NULL DEFAULT 10 CHECK (capacity > 0),
  meeting_link      TEXT,
  pricing_mode      TEXT NOT NULL DEFAULT 'free' CHECK (pricing_mode IN ('free', 'paid')),
  -- Per seat, not per session — what one attendee sees and pays.
  price_per_seat    INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_sessions_mentor ON group_sessions (mentor_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_sessions_upcoming ON group_sessions (scheduled_at) WHERE status = 'scheduled';

-- 'public' (default): anyone can browse and join, today's only behaviour.
-- 'invite_only': hidden from the public browse list; only the mentor and the
-- rows in group_session_invites below can see or join it. A mentor who wants
-- to run something for specific connections rather than broadcast it does
-- not need a whole separate feature — just a narrower audience on the same
-- session type.
ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'invite_only'));

-- Who was invited to an invite_only session. No status column: an invite is
-- either acted on (a group_session_attendees row exists) or it isn't —
-- there is nothing else to track. Deliberately not scoped to being an
-- accepted connection at read time (leaving a connection after being invited
-- must not retroactively lock someone out of a session they were already
-- asked to).
CREATE TABLE IF NOT EXISTS group_session_invites (
  session_id TEXT NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_session_invites_user ON group_session_invites (user_id);

-- One row per attendee. mentor_confirmed lives on group_sessions (the mentor
-- confirms the whole session ran once); mentee_confirmed is per attendee,
-- because who actually showed up is a per-person fact a shared session
-- status cannot express. Mirrors mentorship_sessions' mutual-confirmation
-- rule: a seat counts toward either profile only once both sides agree it
-- happened — see sessionStats.ts.
CREATE TABLE IF NOT EXISTS group_session_attendees (
  session_id       TEXT NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  mentee_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  mentee_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at     TIMESTAMPTZ,
  PRIMARY KEY (session_id, mentee_id)
);

CREATE INDEX IF NOT EXISTS idx_group_attendees_mentee ON group_session_attendees (mentee_id);

ALTER TABLE group_sessions ADD COLUMN IF NOT EXISTS mentor_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Backfill: mentorship that happened before mutual confirmation existed.
--
-- confirmed_at, mentor_confirmed and mentee_confirmed are added above by this
-- same file, so every session completed before they existed reads as
-- unconfirmed — and therefore counts toward nobody's stats or badges.
--
-- That is not a "until everyone re-confirms" problem, it is permanent:
-- mentor_confirmed is only ever set by POST /sessions/:id/complete, which
-- refuses anything that is not still 'upcoming'. A session already sitting at
-- 'past' has no route that can ever set it, so without this backfill every
-- pre-existing completed session is excluded from the record forever and
-- mentors silently lose badges they had already earned.
--
-- Only sessions that were already 'past' with BOTH flags still false are
-- touched. A session completed through the new flow has mentor_confirmed
-- TRUE and is legitimately waiting on its mentee, so it is left alone rather
-- than having the mentee's half forged for them.
--
-- confirmed_at is stamped with when the session actually happened, not now():
-- stamping now() would drop the entire history into the deploy week and hand
-- everybody a fake one-week streak while erasing the real timeline.
--
-- duration_minutes is deliberately left NULL. It was never captured back
-- then, so these sessions count toward "sessions mentored" but contribute no
-- hours — an honest gap, rather than inventing a duration nobody recorded.
--
-- Deliberately NOT scoped to a cutoff date. The only statement that MOVES a
-- session to status = 'past' is POST /sessions/:id/complete, and it sets
-- mentor_confirmed = TRUE in the very same UPDATE. So for anything that went
-- through the app, "past with neither side confirmed" already means
-- "completed before this feature existed" — the flags identify legacy rows
-- exactly, with no date to guess at.
--
-- One other source inserts 'past' rows directly rather than completing them:
-- db/seed-data.ts (e.g. session 's3'). Those are demo fixtures representing
-- sessions that already happened, so having this mark them confirmed is the
-- intended outcome — it is what makes the seeded profiles show the stats and
-- badges the demo is meant to show. Worth knowing before adding any future
-- code path that writes 'past' directly: it would be treated as legacy and
-- confirmed on the next deploy, so such a path should set the flags itself.
--
-- A hardcoded cutoff would have to be the production DEPLOY date, not the
-- merge date, and picking it wrong silently strands real sessions: every
-- session completed between the guessed date and the actual deploy would stay
-- uncounted forever, which is the exact bug this backfill exists to fix.
--
-- Idempotent: after this runs, confirmed_at IS NOT NULL excludes the same
-- rows on every later deploy, so it can never double-apply.
UPDATE mentorship_sessions
   SET mentor_confirmed = TRUE,
       mentee_confirmed = TRUE,
       confirmed_at     = COALESCE(scheduled_at, created_at)
 WHERE status = 'past'
   AND confirmed_at IS NULL
   AND NOT mentor_confirmed
   AND NOT mentee_confirmed;

-- ---------------------------------------------------------------------------
-- Session reminders
--
-- `reminded` is the claim flag for the 6-hour reminder. The scheduler sets it
-- with UPDATE … RETURNING, so a row is handed to exactly one caller even if
-- two backend instances tick at the same moment — the same pattern
-- events.reminded already uses. Without it a restart mid-tick re-emails
-- everyone the reminder was already sent to.
--
-- Reminders can only fire for a session with a real scheduled_at. Sessions
-- booked before the edit screen existed have only the free-text date_label /
-- time_label, so they simply never become due — deliberately, since guessing
-- a timestamp out of text a human typed would send reminders at the wrong
-- hour or on the wrong day.
ALTER TABLE mentorship_sessions ADD COLUMN IF NOT EXISTS reminded BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index: the scheduler's query only ever looks at upcoming sessions
-- that have a timestamp and have not been reminded yet, which stays a tiny
-- slice of the table however large it grows.
CREATE INDEX IF NOT EXISTS idx_sessions_reminder_due
  ON mentorship_sessions (scheduled_at)
  WHERE NOT reminded AND scheduled_at IS NOT NULL AND status = 'upcoming';
