-- =============================================================================
-- QuedaFlow - Corregir ambigüedad "code" en generate_group_code
-- =============================================================================
-- La variable "code" y la columna groups.code provocan "column reference
-- \"code\" is ambiguous" en el WHERE. Renombramos la variable a gen_code.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  gen_code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    gen_code := gen_code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;

  WHILE EXISTS (SELECT 1 FROM public.groups WHERE code = gen_code) LOOP
    gen_code := '';
    FOR i IN 1..6 LOOP
      gen_code := gen_code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
  END LOOP;

  RETURN gen_code;
END;
$$ LANGUAGE plpgsql;
