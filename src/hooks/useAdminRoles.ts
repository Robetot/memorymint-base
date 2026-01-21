// ============================================================
// useAdminRoles - Database-backed multi-role access control
// Provides role checking and management for admin panel
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Role types matching the database enum
export type AdminRole = 'owner' | 'admin' | 'moderator' | 'viewer';

export interface AdminRoleRecord {
  id: string;
  wallet_address: string;
  role: AdminRole;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface UseAdminRolesReturn {
  // Current wallet's roles
  roles: AdminRole[];
  isOwner: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  hasAnyRole: boolean;
  
  // Loading state
  isLoading: boolean;
  error: string | null;
  
  // Role checks
  hasRole: (role: AdminRole) => boolean;
  canManageRoles: boolean;
  
  // Role management (owner-only)
  grantRole: (walletAddress: string, role: AdminRole, notes?: string) => Promise<boolean>;
  revokeRole: (walletAddress: string, role: AdminRole) => Promise<boolean>;
  
  // List all roles
  allRoles: AdminRoleRecord[];
  refreshRoles: () => Promise<void>;
}

export function useAdminRoles(walletAddress?: string): UseAdminRolesReturn {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [allRoles, setAllRoles] = useState<AdminRoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch roles for current wallet
  const fetchRoles = useCallback(async () => {
    if (!walletAddress) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch current wallet's roles
      const { data, error: fetchError } = await supabase
        .from('admin_roles')
        .select('*')
        .ilike('wallet_address', walletAddress)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      const walletRoles = (data || [])
        .filter((r: AdminRoleRecord) => {
          // Check expiration
          if (r.expires_at && new Date(r.expires_at) < new Date()) return false;
          return true;
        })
        .map((r: AdminRoleRecord) => r.role as AdminRole);

      setRoles(walletRoles);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch roles';
      setError(msg);
      console.error('[useAdminRoles] Error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  // Fetch all roles (for admin management UI)
  const fetchAllRoles = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('admin_roles')
        .select('*')
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAllRoles((data || []) as AdminRoleRecord[]);
    } catch (e) {
      console.error('[useAdminRoles] Failed to fetch all roles:', e);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchRoles();
    fetchAllRoles();
  }, [fetchRoles, fetchAllRoles]);

  // Role checks
  const hasRole = useCallback((role: AdminRole): boolean => {
    return roles.includes(role);
  }, [roles]);

  const isOwner = roles.includes('owner');
  const isAdmin = roles.includes('admin') || isOwner;
  const isModerator = roles.includes('moderator') || isAdmin;
  const hasAnyRole = roles.length > 0;
  const canManageRoles = isOwner;

  // Grant role (owner-only)
  const grantRole = useCallback(async (
    targetWallet: string,
    role: AdminRole,
    notes?: string
  ): Promise<boolean> => {
    if (!walletAddress || !isOwner) {
      setError('Only owners can grant roles');
      return false;
    }

    try {
      const { error: insertError } = await supabase
        .from('admin_roles')
        .upsert({
          wallet_address: targetWallet.toLowerCase(),
          role,
          granted_by: walletAddress.toLowerCase(),
          notes: notes || null,
          is_active: true,
        }, {
          onConflict: 'wallet_address,role',
        });

      if (insertError) throw insertError;

      await fetchAllRoles();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to grant role';
      setError(msg);
      console.error('[useAdminRoles] Grant role error:', e);
      return false;
    }
  }, [walletAddress, isOwner, fetchAllRoles]);

  // Revoke role (owner-only)
  const revokeRole = useCallback(async (
    targetWallet: string,
    role: AdminRole
  ): Promise<boolean> => {
    if (!walletAddress || !isOwner) {
      setError('Only owners can revoke roles');
      return false;
    }

    // Prevent owner from revoking their own owner role
    if (targetWallet.toLowerCase() === walletAddress.toLowerCase() && role === 'owner') {
      setError('Cannot revoke your own owner role');
      return false;
    }

    try {
      const { error: updateError } = await supabase
        .from('admin_roles')
        .update({ is_active: false })
        .ilike('wallet_address', targetWallet)
        .eq('role', role);

      if (updateError) throw updateError;

      await fetchAllRoles();
      if (targetWallet.toLowerCase() === walletAddress.toLowerCase()) {
        await fetchRoles();
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke role';
      setError(msg);
      console.error('[useAdminRoles] Revoke role error:', e);
      return false;
    }
  }, [walletAddress, isOwner, fetchRoles, fetchAllRoles]);

  const refreshRoles = useCallback(async () => {
    await Promise.all([fetchRoles(), fetchAllRoles()]);
  }, [fetchRoles, fetchAllRoles]);

  return {
    roles,
    isOwner,
    isAdmin,
    isModerator,
    hasAnyRole,
    isLoading,
    error,
    hasRole,
    canManageRoles,
    grantRole,
    revokeRole,
    allRoles,
    refreshRoles,
  };
}
