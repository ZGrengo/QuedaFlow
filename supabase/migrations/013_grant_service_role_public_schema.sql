-- =============================================================================
-- QuedaFlow - Permisos service_role sobre schema public
-- =============================================================================
-- Las Edge Functions usan SUPABASE_SERVICE_ROLE_KEY, que conecta como service_role.
-- Sin estos grants, las consultas fallan con "permission denied for schema public".
-- =============================================================================

GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
