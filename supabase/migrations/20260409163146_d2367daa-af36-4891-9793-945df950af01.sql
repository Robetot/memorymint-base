-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.admin_roles;

-- Allow users to read only their own roles
CREATE POLICY "Users can read own roles"
ON public.admin_roles
FOR SELECT
TO authenticated
USING (
  LOWER(wallet_address) = LOWER(
    COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'wallet_address'),
      auth.uid()::text
    )
  )
);

-- Allow admins/owners to read all roles (for management UI)
CREATE POLICY "Admins can read all roles"
ON public.admin_roles
FOR SELECT
TO authenticated
USING (
  public.wallet_is_admin(
    COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'wallet_address'),
      auth.uid()::text
    )
  )
);