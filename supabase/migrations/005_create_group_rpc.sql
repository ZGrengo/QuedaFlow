-- =============================================================================
-- QuedaFlow - Crear grupo vía RPC para evitar RLS con DEFAULT auth.uid()
-- =============================================================================
-- El INSERT directo puede fallar porque el DEFAULT auth.uid() se evalúa en
-- un contexto donde el JWT no está disponible. Esta función hace el INSERT
-- con SECURITY DEFINER y asigna host_user_id = auth.uid() explícitamente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_group(p_name text)
RETURNS public.groups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_group public.groups;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  INSERT INTO public.groups (code, name, host_user_id)
  VALUES (public.generate_group_code(), p_name, auth.uid())
  RETURNING * INTO new_group;

  RETURN new_group;
END;
$$;
