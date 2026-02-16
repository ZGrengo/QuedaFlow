-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  buffer_before_work_min INTEGER DEFAULT 20 NOT NULL,
  yellow_threshold NUMERIC(3,2) DEFAULT 0.75 NOT NULL CHECK (yellow_threshold >= 0 AND yellow_threshold <= 1),
  target_people INTEGER CHECK (target_people IS NULL OR target_people > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Group members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Group blocked windows table
CREATE TABLE group_blocked_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  dow INTEGER CHECK (dow IS NULL OR (dow >= 0 AND dow <= 6)), -- 0=Sunday, 6=Saturday, NULL=all days
  start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  end_min INTEGER NOT NULL CHECK (end_min > 0 AND end_min <= 1440),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Availability blocks table
CREATE TABLE availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('WORK', 'UNAVAILABLE', 'PREFERRED')),
  date DATE NOT NULL,
  start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  end_min INTEGER NOT NULL CHECK (end_min > 0 AND end_min <= 1440),
  source TEXT DEFAULT 'MANUAL' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_blocked_windows_group_id ON group_blocked_windows(group_id);
CREATE INDEX idx_availability_blocks_group_id ON availability_blocks(group_id);
CREATE INDEX idx_availability_blocks_user_id ON availability_blocks(user_id);
CREATE INDEX idx_availability_blocks_date ON availability_blocks(date);
CREATE INDEX idx_groups_code ON groups(code);

