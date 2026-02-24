-- =============================================================================
-- QuedaFlow - Política DELETE en groups (solo el host puede eliminar el grupo)
-- =============================================================================
-- Al eliminar un grupo, CASCADE elimina: group_members, group_blocked_windows,
-- availability_blocks (definido en 001_schema.sql).
-- =============================================================================

CREATE POLICY "Only host can delete group"
  ON groups FOR DELETE
  USING (public.is_host_of_group(id, auth.uid()));
