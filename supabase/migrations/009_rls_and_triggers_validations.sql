-- =============================================================================
-- QuedaFlow - RLS, triggers y validaciones (planning range, past blocks, PREFERRED)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Función: bloque en rango planning y no en pasado
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_date_valid_for_group(p_group_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = p_group_id
      AND p_date >= CURRENT_DATE
      AND p_date BETWEEN g.planning_start_date AND g.planning_end_date
  );
$$;

-- -----------------------------------------------------------------------------
-- Función: contar PREFERRED activos en rango planning (para trigger)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_preferred_in_planning_range(
  p_group_id uuid, p_user_id uuid, p_exclude_block_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.availability_blocks ab
  JOIN public.groups g ON g.id = ab.group_id
  WHERE ab.group_id = p_group_id
    AND ab.user_id = p_user_id
    AND ab.type = 'PREFERRED'
    AND ab.date BETWEEN g.planning_start_date AND g.planning_end_date
    AND (p_exclude_block_id IS NULL OR ab.id != p_exclude_block_id);
$$;

-- -----------------------------------------------------------------------------
-- Reemplazar políticas availability_blocks INSERT
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own availability blocks" ON availability_blocks;
CREATE POLICY "Users can insert own availability blocks"
  ON availability_blocks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_member_of_group(group_id, auth.uid())
    AND public.block_date_valid_for_group(group_id, date)
  );

-- -----------------------------------------------------------------------------
-- Reemplazar políticas availability_blocks UPDATE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own availability blocks" ON availability_blocks;
CREATE POLICY "Users can update own availability blocks"
  ON availability_blocks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_member_of_group(group_id, auth.uid())
  )
  WITH CHECK (
    public.block_date_valid_for_group(group_id, date)
  );

-- -----------------------------------------------------------------------------
-- Trigger: validar PREFERRED limit (máx 3 en rango planning)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_preferred_limit()
RETURNS TRIGGER AS $$
DECLARE
  preferred_count INTEGER;
BEGIN
  IF NEW.type = 'PREFERRED' THEN
    preferred_count := public.count_preferred_in_planning_range(
      NEW.group_id, NEW.user_id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END
    );
    IF preferred_count >= 3 THEN
      RAISE EXCEPTION 'Máximo 3 bloques PREFERRED permitidos dentro del rango de planificación'
        USING errcode = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ya existe, solo actualizamos la función
-- check_preferred_limit_trigger ya está creado en 003

-- -----------------------------------------------------------------------------
-- Trigger: validar date en rango planning y no pasado (defense-in-depth)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_availability_block_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.block_date_valid_for_group(NEW.group_id, NEW.date) THEN
    RAISE EXCEPTION 'La fecha debe estar dentro del rango de planificación del grupo y no puede ser pasada'
      USING errcode = 'P0002';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_availability_block_date_trigger ON availability_blocks;
CREATE TRIGGER validate_availability_block_date_trigger
  BEFORE INSERT OR UPDATE ON availability_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_availability_block_date();

-- -----------------------------------------------------------------------------
-- Constraint groups: planning_start_date <= planning_end_date (por si no en 008)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_planning_date_range'
  ) THEN
    ALTER TABLE groups ADD CONSTRAINT chk_planning_date_range
      CHECK (planning_start_date <= planning_end_date);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Trigger: validar blocked window start < end (o manejar medianoche)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_blocked_window_range()
RETURNS TRIGGER AS $$
BEGIN
  -- Permitir start >= end para ventanas que cruzan medianoche (ej 22:00-06:00)
  -- Para ventanas normales: start < end
  -- Validar rangos 0..1439
  IF NEW.start_min < 0 OR NEW.start_min >= 1440 THEN
    RAISE EXCEPTION 'start_min debe estar entre 0 y 1439';
  END IF;
  IF NEW.end_min <= 0 OR NEW.end_min > 1440 THEN
    RAISE EXCEPTION 'end_min debe estar entre 1 y 1440';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_blocked_window_range_trigger ON group_blocked_windows;
CREATE TRIGGER validate_blocked_window_range_trigger
  BEFORE INSERT OR UPDATE ON group_blocked_windows
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_blocked_window_range();
