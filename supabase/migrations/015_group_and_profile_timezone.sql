-- Timezone baseline support:
-- - groups.timezone: official timezone for schedule interpretation
-- - profiles.timezone: detected user timezone (best effort)

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Madrid';

COMMENT ON COLUMN public.groups.timezone IS 'IANA timezone for the group schedule (e.g. Europe/Madrid)';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN public.profiles.timezone IS 'Detected user IANA timezone from browser (best effort)';
