-- Fix: Remove user_metadata references from RLS policies (user_metadata is user-editable)
DROP POLICY IF EXISTS "Users can read own roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.admin_roles;

-- Users can read their own roles (match by auth.uid)
CREATE POLICY "Users can read own roles"
ON public.admin_roles
FOR SELECT
TO authenticated
USING (
  LOWER(wallet_address) = LOWER(auth.uid()::text)
);

-- Admins/owners can read all roles for management
CREATE POLICY "Admins can read all roles"
ON public.admin_roles
FOR SELECT
TO authenticated
USING (
  public.wallet_is_admin(auth.uid()::text)
);