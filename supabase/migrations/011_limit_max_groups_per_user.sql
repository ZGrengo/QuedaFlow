-- =============================================================================
-- QuedaFlow - Límite máximo de 5 grupos creados por usuario
-- =============================================================================
-- Reemplaza create_group para comprobar el número de grupos donde el usuario
-- es host antes de crear uno nuevo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_group(p_name text)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_group public.groups;
  host_group_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  SELECT COUNT(*)::integer INTO host_group_count
  FROM public.groups
  WHERE host_user_id = auth.uid();

  IF host_group_count >= 5 THEN
    RAISE EXCEPTION 'Máximo 5 grupos creados por usuario. Elimina un grupo que hayas creado para crear uno nuevo.'
      USING errcode = 'P0001';
  END IF;

  INSERT INTO public.groups (code, name, host_user_id)
  VALUES (public.generate_group_code(), p_name, auth.uid())
  RETURNING * INTO new_group;

  RETURN new_group;
END;
$$;
