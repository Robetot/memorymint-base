-- ============================================================
-- Admin Roles System for MemoryMint
-- Provides database-backed multi-role access control
-- ============================================================

-- Create role enum
CREATE TYPE public.admin_role AS ENUM ('owner', 'admin', 'moderator', 'viewer');

-- Create admin_roles table
CREATE TABLE public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'viewer',
  granted_by TEXT, -- wallet address of who granted this role
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- optional expiration
  notes TEXT, -- admin notes about this role grant
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(wallet_address, role)
);

-- Create index for fast lookups
CREATE INDEX idx_admin_roles_wallet ON public.admin_roles(wallet_address);
CREATE INDEX idx_admin_roles_active ON public.admin_roles(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if a wallet has a specific role
CREATE OR REPLACE FUNCTION public.wallet_has_role(
  _wallet TEXT,
  _role admin_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE LOWER(wallet_address) = LOWER(_wallet)
      AND role = _role
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function to check if wallet has any admin role (admin or owner)
CREATE OR REPLACE FUNCTION public.wallet_is_admin(_wallet TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_roles
    WHERE LOWER(wallet_address) = LOWER(_wallet)
      AND role IN ('owner', 'admin')
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Function to get all roles for a wallet
CREATE OR REPLACE FUNCTION public.get_wallet_roles(_wallet TEXT)
RETURNS SETOF admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.admin_roles
  WHERE LOWER(wallet_address) = LOWER(_wallet)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
$$;

-- RLS Policies

-- Everyone can view roles (for UI display)
CREATE POLICY "Roles are viewable by everyone"
ON public.admin_roles
FOR SELECT
USING (true);

-- Only owners can insert new roles
-- Note: In production, you would verify wallet signature server-side
CREATE POLICY "Owners can insert roles"
ON public.admin_roles
FOR INSERT
WITH CHECK (
  public.wallet_has_role(current_setting('app.current_wallet', true), 'owner')
);

-- Only owners can update roles
CREATE POLICY "Owners can update roles"
ON public.admin_roles
FOR UPDATE
USING (
  public.wallet_has_role(current_setting('app.current_wallet', true), 'owner')
);

-- Only owners can delete roles
CREATE POLICY "Owners can delete roles"
ON public.admin_roles
FOR DELETE
USING (
  public.wallet_has_role(current_setting('app.current_wallet', true), 'owner')
);

-- Seed the initial owner role (contract owner from production)
INSERT INTO public.admin_roles (wallet_address, role, granted_by, notes)
VALUES (
  '0x830f4c15480aa516a0cc4826902443936f9596cf',
  'owner',
  'system',
  'Initial contract owner - seeded on migration'
);