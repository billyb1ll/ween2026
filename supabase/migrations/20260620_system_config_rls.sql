-- Drop the existing SELECT-only policy if we want to replace it, or just keep it and add a policy for write operations.
-- To be safe and clean, we will define a policy allowing ALL operations for system_config.
DROP POLICY IF EXISTS "Allow all select" ON public.system_config;
DROP POLICY IF EXISTS "Allow all for system_config" ON public.system_config;

-- Create policy allowing SELECT for everyone
CREATE POLICY "Allow all select" ON public.system_config FOR SELECT USING (true);

-- Create policy allowing INSERT, UPDATE, DELETE for everyone (matching event_config patterns)
CREATE POLICY "Allow all for system_config" ON public.system_config FOR ALL USING (true);
