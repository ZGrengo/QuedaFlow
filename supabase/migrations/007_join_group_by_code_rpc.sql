-- =============================================================================
-- QuedaFlow - Unirse a grupo por código vía RPC
-- =============================================================================
-- El SELECT directo a groups falla por RLS: el usuario no es miembro aún y
-- la política solo permite ver grupos donde is_member_of_group = true.
-- Esta función usa SECURITY DEFINER para buscar el grupo e insertar el miembro.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_group public.groups;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Buscar grupo por código (sin RLS en este contexto)
  SELECT * INTO target_group
  FROM public.groups
  WHERE code = upper(trim(p_code));

  IF target_group IS NULL THEN
    RAISE EXCEPTION 'Group not found' USING errcode = 'P0002';
  END IF;

  -- Insertar como miembro (ignorar si ya existe)
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (target_group.id, current_user_id, 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN target_group;
END;
$$;
