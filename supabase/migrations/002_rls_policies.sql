-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_blocked_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- GROUPS POLICIES
-- ============================================

-- Users can view groups they are members of
CREATE POLICY "Users can view groups they belong to"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- Users can create groups (they become host)
CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

-- Only host can update group settings
CREATE POLICY "Only host can update group settings"
  ON groups FOR UPDATE
  USING (
    auth.uid() = host_user_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'host'
    )
  );

-- ============================================
-- GROUP_MEMBERS POLICIES
-- ============================================

-- Users can view members of groups they belong to
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

-- Users can insert themselves as members (with role 'member')
-- Host can insert any member
CREATE POLICY "Users can join groups or host can add members"
  ON group_members FOR INSERT
  WITH CHECK (
    -- User joining themselves
    (auth.uid() = user_id AND role = 'member')
    OR
    -- Host adding members
    EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'host'
    )
  );

-- Only host can update member roles
CREATE POLICY "Only host can update member roles"
  ON group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'host'
    )
  );

-- Users can delete themselves, host can delete any member
CREATE POLICY "Users can leave or host can remove members"
  ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'host'
    )
  );

-- ============================================
-- GROUP_BLOCKED_WINDOWS POLICIES
-- ============================================

-- Users can view blocked windows of groups they belong to
CREATE POLICY "Users can view blocked windows of their groups"
  ON group_blocked_windows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_blocked_windows.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Only host can insert blocked windows
CREATE POLICY "Only host can insert blocked windows"
  ON group_blocked_windows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = group_blocked_windows.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'host'
    )
  );

-- Only host can update blocked windows
CREATE POLICY "Only host can update blocked windows"
  ON group_blocked_windows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = group_blocked_windows.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'host'
    )
  );

-- Only host can delete blocked windows
CREATE POLICY "Only host can delete blocked windows"
  ON group_blocked_windows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = group_blocked_windows.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'host'
    )
  );

-- ============================================
-- AVAILABILITY_BLOCKS POLICIES
-- ============================================

-- Users can view availability blocks of groups they belong to
CREATE POLICY "Users can view availability blocks of their groups"
  ON availability_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = availability_blocks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Users can insert their own availability blocks
CREATE POLICY "Users can insert own availability blocks"
  ON availability_blocks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = availability_blocks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Users can update their own availability blocks
CREATE POLICY "Users can update own availability blocks"
  ON availability_blocks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = availability_blocks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Users can delete their own availability blocks
CREATE POLICY "Users can delete own availability blocks"
  ON availability_blocks FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = availability_blocks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

