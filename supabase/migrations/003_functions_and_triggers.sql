-- =============================================================================
-- QuedaFlow - Funciones y triggers
-- =============================================================================

-- Perfil automático al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to generate unique group code
CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  
  -- Check if code already exists (very unlikely but safe)
  WHILE EXISTS (SELECT 1 FROM groups WHERE groups.code = code) LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically add host as member when group is created
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.host_user_id, 'host');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add host as member
CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group();

-- Function to validate max 3 PREFERRED blocks per user per group
CREATE OR REPLACE FUNCTION check_preferred_limit()
RETURNS TRIGGER AS $$
DECLARE
  preferred_count INTEGER;
BEGIN
  IF NEW.type = 'PREFERRED' THEN
    SELECT COUNT(*) INTO preferred_count
    FROM availability_blocks
    WHERE group_id = NEW.group_id
      AND user_id = NEW.user_id
      AND type = 'PREFERRED'
      AND (TG_OP = 'INSERT' OR id != NEW.id);
    
    IF preferred_count >= 3 THEN
      RAISE EXCEPTION 'Maximum 3 PREFERRED blocks allowed per user per group';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce PREFERRED limit
CREATE TRIGGER check_preferred_limit_trigger
  BEFORE INSERT OR UPDATE ON availability_blocks
  FOR EACH ROW
  EXECUTE FUNCTION check_preferred_limit();

