
-- Drop all existing vulnerable policies on admin_roles
DROP POLICY IF EXISTS "Owners can delete roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Owners can insert roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Owners can update roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.admin_roles;

-- New SELECT policy: only authenticated users can read roles
CREATE POLICY "Authenticated users can read roles"
ON public.admin_roles
FOR SELECT
TO authenticated
USING (true);

-- No INSERT/UPDATE/DELETE policies for anon or authenticated roles.
-- All writes to admin_roles must go through edge functions using the service role key.
-- This prevents any client-side privilege escalation via session variable spoofing.
