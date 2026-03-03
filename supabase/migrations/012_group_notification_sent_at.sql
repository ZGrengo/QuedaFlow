-- =============================================================================
-- QuedaFlow - Notificación planner por email
-- =============================================================================
-- Campo para marcar cuándo se ha enviado la notificación de
-- "suficientes participantes" para un grupo.
-- =============================================================================

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ NULL;

