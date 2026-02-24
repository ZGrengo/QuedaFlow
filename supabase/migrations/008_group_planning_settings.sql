-- =============================================================================
-- QuedaFlow - Ventana de planificación y settings del host
-- =============================================================================
-- planning_start_date / planning_end_date: rango activo del grupo
-- min_meeting_duration_min: duración mínima para reuniones (para rankeo futuro)
-- =============================================================================

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS planning_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS planning_end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  ADD COLUMN IF NOT EXISTS min_meeting_duration_min INTEGER NOT NULL DEFAULT 60;

-- Constraint: planning_start_date <= planning_end_date
ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS chk_planning_date_range;
ALTER TABLE groups
  ADD CONSTRAINT chk_planning_date_range
  CHECK (planning_start_date <= planning_end_date);

-- Constraint: min_meeting_duration_min positivo
ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS chk_min_meeting_duration;
ALTER TABLE groups
  ADD CONSTRAINT chk_min_meeting_duration
  CHECK (min_meeting_duration_min > 0 AND min_meeting_duration_min <= 1440);

-- Los DEFAULT se aplican automáticamente a filas existentes
