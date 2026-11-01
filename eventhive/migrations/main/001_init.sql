-- Migration: 001_init.sql for eventhive_main

CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'organizer', 'admin')),
  department TEXT NOT NULL,
  year SMALLINT NOT NULL CHECK (year >= 1 AND year <= 5),
  roll_no TEXT,
  bio TEXT CHECK (length(bio) <= 280),
  interests TEXT[] DEFAULT '{}',
  open_to_team BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users (department);
CREATE INDEX IF NOT EXISTS idx_users_open_to_team ON users (open_to_team);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
  id SMALLINT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  skill_group TEXT NOT NULL CHECK (skill_group IN ('tech', 'creative', 'business', 'sports'))
);

-- User skills table
CREATE TABLE IF NOT EXISTS user_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id SMALLINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL CHECK (level >= 1 AND level <= 3),
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id ON user_skills (skill_id);

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  building TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  step_free BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) >= 3 AND length(title) <= 120),
  description TEXT NOT NULL CHECK (length(description) >= 10 AND length(description) <= 5000),
  category TEXT NOT NULL CHECK (category IN ('technical', 'cultural', 'sports', 'workshop', 'seminar', 'hackathon', 'social')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  venue_id UUID NOT NULL REFERENCES venues(id),
  capacity INTEGER NOT NULL CHECK (capacity >= 1),
  registration_deadline TIMESTAMPTZ NOT NULL,
  banner_url TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  price_inr INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'published', 'cancelled', 'completed')),
  target_departments TEXT[] DEFAULT '{}',
  target_years SMALLINT[] DEFAULT '{}',
  is_team_event BOOLEAN NOT NULL DEFAULT false,
  team_min SMALLINT CHECK (team_min >= 1 AND team_min <= 10),
  team_max SMALLINT CHECK (team_max >= 1 AND team_max <= 10),
  accessibility TEXT[] DEFAULT '{}',
  dietary TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  require_feedback_for_certificate BOOLEAN NOT NULL DEFAULT true,
  feedback_window_days INTEGER NOT NULL DEFAULT 7,
  embedding REAL[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_event_ends_after_starts CHECK (ends_at > starts_at),
  CONSTRAINT venue_no_double_booking EXCLUDE USING gist (
    venue_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('pending', 'published'))
);

CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_category ON events (category);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_ends_at ON events (ends_at);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON events (venue_id);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING gin (title gin_trgm_ops);

-- Registrations table
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  qr_secret BYTEA NOT NULL,
  CONSTRAINT unique_registration_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations (event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_registered_at ON registrations (registered_at);

-- Academic Calendar table
CREATE TABLE IF NOT EXISTS academic_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('exam', 'holiday', 'break', 'fest')),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  CONSTRAINT check_cal_ends_after_starts CHECK (ends_on >= starts_on)
);

-- Squads table
CREATE TABLE IF NOT EXISTS squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) >= 3 AND length(name) <= 40),
  tagline TEXT CHECK (length(tagline) <= 140),
  leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_size SMALLINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('forming', 'locked', 'disbanded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squads_event_id ON squads (event_id);
CREATE INDEX IF NOT EXISTS idx_squads_leader_id ON squads (leader_id);

-- Squad Members table
CREATE TABLE IF NOT EXISTS squad_members (
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, user_id),
  CONSTRAINT unique_squad_member_per_event UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_members_user_id ON squad_members (user_id);

-- Squad Open Roles table
CREATE TABLE IF NOT EXISTS squad_open_roles (
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  skill_id SMALLINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  count SMALLINT NOT NULL CHECK (count >= 1 AND count <= 5),
  PRIMARY KEY (squad_id, skill_id)
);

-- Squad Invites table
CREATE TABLE IF NOT EXISTS squad_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('invite', 'request')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_squad_invite ON squad_invites (squad_id, user_id, kind) WHERE (status = 'pending');
CREATE INDEX IF NOT EXISTS idx_squad_invites_user_status ON squad_invites (user_id, status);

-- Squad Invite Links table
CREATE TABLE IF NOT EXISTS squad_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 10,
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read_at);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  code CHAR(12) PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_cert_per_event_user UNIQUE (event_id, user_id)
);

-- User Badges table
CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_slug)
);

-- Feedback Actions table
CREATE TABLE IF NOT EXISTS feedback_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'done')),
  is_public BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_feedback_actions_event ON feedback_actions (event_id);

-- Hidden Comments table
CREATE TABLE IF NOT EXISTS hidden_comments (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, comment_id)
);

-- Outbox table
CREATE TABLE IF NOT EXISTS outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL CHECK (target IN ('issuer', 'collector')),
  path TEXT NOT NULL,
  body JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  done_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (done_at, next_attempt_at) WHERE (done_at IS NULL);
