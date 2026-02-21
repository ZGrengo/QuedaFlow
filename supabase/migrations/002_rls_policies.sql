-- =============================================================================
-- QuedaFlow - Row Level Security (RLS)
-- =============================================================================
-- Todas las tablas con RLS. Para group_members usamos funciones SECURITY DEFINER
-- (is_member_of_group, is_host_of_group) para evitar recursión infinita en
-- políticas que leen la misma tabla.
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_blocked_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Funciones auxiliares (evitan recursión en políticas de group_members)
-- -----------------------------------------------------------------------------

-- True si el usuario es miembro del grupo (lectura sin RLS)
CREATE OR REPLACE FUNCTION public.is_member_of_group(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- True si el usuario es host del grupo (según tabla groups)
CREATE OR REPLACE FUNCTION public.is_host_of_group(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id AND host_user_id = p_user_id
  );
$$;

-- =============================================================================
-- PROFILES
-- =============================================================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================================================
-- GROUPS
-- =============================================================================

CREATE POLICY "Users can view groups they belong to"
  ON groups FOR SELECT
  USING (public.is_member_of_group(id, auth.uid()));

CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Only host can update group settings"
  ON groups FOR UPDATE
  USING (
    auth.uid() = host_user_id
    AND public.is_member_of_group(id, auth.uid())
    AND public.is_host_of_group(id, auth.uid())
  );

-- =============================================================================
-- GROUP_MEMBERS (políticas sin auto-lectura para evitar recursión)
-- =============================================================================

CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (public.is_member_of_group(group_id, auth.uid()));

CREATE POLICY "Users can join groups or host can add members"
  ON group_members FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id AND role = 'member')
    OR
    (auth.uid() = user_id AND role = 'host' AND public.is_host_of_group(group_id, auth.uid()))
  );

CREATE POLICY "Only host can update member roles"
  ON group_members FOR UPDATE
  USING (public.is_host_of_group(group_id, auth.uid()));

CREATE POLICY "Users can leave or host can remove members"
  ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_host_of_group(group_id, auth.uid())
  );

-- =============================================================================
-- GROUP_BLOCKED_WINDOWS
-- =============================================================================

CREATE POLICY "Users can view blocked windows of their groups"
  ON group_blocked_windows FOR SELECT
  USING (public.is_member_of_group(group_id, auth.uid()));

CREATE POLICY "Only host can insert blocked windows"
  ON group_blocked_windows FOR INSERT
  WITH CHECK (public.is_host_of_group(group_id, auth.uid()));

CREATE POLICY "Only host can update blocked windows"
  ON group_blocked_windows FOR UPDATE
  USING (public.is_host_of_group(group_id, auth.uid()));

CREATE POLICY "Only host can delete blocked windows"
  ON group_blocked_windows FOR DELETE
  USING (public.is_host_of_group(group_id, auth.uid()));

-- =============================================================================
-- AVAILABILITY_BLOCKS
-- =============================================================================

CREATE POLICY "Users can view availability blocks of their groups"
  ON availability_blocks FOR SELECT
  USING (public.is_member_of_group(group_id, auth.uid()));

CREATE POLICY "Users can insert own availability blocks"
  ON availability_blocks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_member_of_group(group_id, auth.uid())
  );

CREATE POLICY "Users can update own availability blocks"
  ON availability_blocks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_member_of_group(group_id, auth.uid())
  );

CREATE POLICY "Users can delete own availability blocks"
  ON availability_blocks FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.is_member_of_group(group_id, auth.uid())
  );
