-- Nombre visible (p. ej. de Google) para mostrar en planner y UI grupal.
-- Los miembros del mismo grupo pueden leer el display_name de sus compañeros.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.profiles.display_name IS 'Nombre para mostrar (OAuth, p. ej. Google full_name)';

-- Co-miembros de un mismo grupo pueden ver perfiles entre sí (solo lectura).
CREATE POLICY "Group co-members can view profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm_self
      JOIN public.group_members gm_other ON gm_self.group_id = gm_other.group_id
      WHERE gm_self.user_id = auth.uid()
        AND gm_other.user_id = profiles.id
    )
  );
