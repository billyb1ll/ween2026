-- 1. Reset all PINs for the new salted hashing mechanism (except admin if they already have one, but we reset all to be safe, or just reset all)
UPDATE public.users SET pin_hash = NULL;

-- 2. Protect Admin user 6688216 from deletion
CREATE OR REPLACE FUNCTION protect_default_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.student_id = '6688216' THEN
    RAISE EXCEPTION 'Cannot delete the default admin (6688216).';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_default_admin ON public.users;

CREATE TRIGGER trg_protect_default_admin
BEFORE DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION protect_default_admin();

-- Also ensure the admin has the correct role
UPDATE public.users SET role = 'moderator' WHERE student_id = '6688216';
