import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Base chain ID
const BASE_CHAIN_ID = 8453;

// Session storage key
const SIWE_SESSION_KEY = 'memorymint_siwe_session';

export interface SIWESession {
  sessionToken: string;
  address: string;
  chainId: number;
  expiresAt: number;
}

export interface SIWEAuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  session: SIWESession | null;
  error: string | null;
}

// Load session from storage
function loadStoredSession(): SIWESession | null {
  try {
    const stored = localStorage.getItem(SIWE_SESSION_KEY);
    if (stored) {
      const session = JSON.parse(stored) as SIWESession;
      // Check if session is expired
      if (session.expiresAt > Date.now()) {
        return session;
      }
      // Clear expired session
      localStorage.removeItem(SIWE_SESSION_KEY);
    }
  } catch (e) {
    console.warn('[SIWE] Failed to load stored session:', e);
  }
  return null;
}

// Save session to storage
function saveSession(session: SIWESession | null) {
  try {
    if (session) {
      localStorage.setItem(SIWE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SIWE_SESSION_KEY);
    }
  } catch (e) {
    console.warn('[SIWE] Failed to save session:', e);
  }
}

// Create SIWE message
function createSIWEMessage(
  domain: string,
  address: string,
  uri: string,
  nonce: string,
  chainId: number,
  statement?: string
): string {
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement || 'Sign in to MemoryMint to mint NFTs and claim rewards.'}

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;
}

export function useSIWEAuth() {
  const [state, setState] = useState<SIWEAuthState>(() => {
    const storedSession = loadStoredSession();
    return {
      isAuthenticated: !!storedSession,
      isAuthenticating: false,
      session: storedSession,
      error: null,
    };
  });

  const pendingAuthRef = useRef(false);

  // Validate session with backend
  const validateSession = useCallback(async (session: SIWESession): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-siwe/validate-session', {
        body: {
          sessionToken: session.sessionToken,
          expectedAddress: session.address,
        },
      });

      if (error) {
        console.error('[SIWE] Session validation error:', error);
        return false;
      }

      return data?.valid === true;
    } catch (e) {
      console.error('[SIWE] Session validation failed:', e);
      return false;
    }
  }, []);

  // Get nonce from backend
  const getNonce = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-siwe/nonce', {
        method: 'GET',
      });

      if (error) {
        console.error('[SIWE] Failed to get nonce:', error);
        return null;
      }

      return data?.nonce || null;
    } catch (e) {
      console.error('[SIWE] Nonce fetch failed:', e);
      return null;
    }
  }, []);

  // Sign in with Ethereum
  const signIn = useCallback(async (walletAddress: string): Promise<boolean> => {
    if (!window.ethereum) {
      setState(prev => ({ ...prev, error: 'No wallet detected' }));
      return false;
    }

    if (pendingAuthRef.current) {
      return false;
    }

    // Validate address format
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setState(prev => ({ ...prev, error: 'Invalid wallet address' }));
      return false;
    }

    pendingAuthRef.current = true;
    setState(prev => ({ ...prev, isAuthenticating: true, error: null }));

    try {
      // Get nonce from backend
      const nonce = await getNonce();
      if (!nonce) {
        setState(prev => ({ ...prev, isAuthenticating: false, error: 'Failed to get authentication nonce' }));
        pendingAuthRef.current = false;
        return false;
      }

      // Create SIWE message
      const domain = window.location.host;
      const uri = window.location.origin;
      const message = createSIWEMessage(domain, walletAddress, uri, nonce, BASE_CHAIN_ID);

      console.log('[SIWE] Requesting signature for message...');

      // Request signature from wallet
      const signature = await (window.ethereum as any).request({
        method: 'personal_sign',
        params: [message, walletAddress],
      }) as string;

      console.log('[SIWE] Signature received, verifying with backend...');

      // Verify signature with backend
      const { data, error } = await supabase.functions.invoke('verify-siwe/verify-siwe', {
        body: {
          message,
          signature,
          expectedAddress: walletAddress,
          expectedChainId: BASE_CHAIN_ID,
        },
      });

      if (error || !data?.success) {
        console.error('[SIWE] Verification failed:', error || data?.error);
        setState(prev => ({ 
          ...prev, 
          isAuthenticating: false, 
          error: data?.error || 'Signature verification failed' 
        }));
        pendingAuthRef.current = false;
        return false;
      }

      console.log('[SIWE] Authentication successful');

      const session: SIWESession = {
        sessionToken: data.sessionToken,
        address: data.address.toLowerCase(),
        chainId: data.chainId,
        expiresAt: data.expiresAt,
      };

      saveSession(session);
      setState({
        isAuthenticated: true,
        isAuthenticating: false,
        session,
        error: null,
      });

      pendingAuthRef.current = false;
      return true;
    } catch (e: any) {
      console.error('[SIWE] Sign in failed:', e);
      
      let errorMessage = 'Authentication failed';
      if (e?.code === 4001) {
        errorMessage = 'Signature request rejected';
      } else if (e?.message) {
        errorMessage = e.message.slice(0, 100);
      }

      setState(prev => ({ 
        ...prev, 
        isAuthenticating: false, 
        error: errorMessage 
      }));
      pendingAuthRef.current = false;
      return false;
    }
  }, [getNonce]);

  // Sign out
  const signOut = useCallback(async () => {
    const session = state.session;
    
    // Invalidate session on backend
    if (session?.sessionToken) {
      try {
        await supabase.functions.invoke('verify-siwe/invalidate-session', {
          body: { sessionToken: session.sessionToken },
        });
      } catch (e) {
        console.warn('[SIWE] Failed to invalidate session on backend:', e);
      }
    }

    saveSession(null);
    setState({
      isAuthenticated: false,
      isAuthenticating: false,
      session: null,
      error: null,
    });
  }, [state.session]);

  // Check if authenticated for a specific address
  const isAuthenticatedFor = useCallback((address: string): boolean => {
    if (!state.isAuthenticated || !state.session) return false;
    return state.session.address.toLowerCase() === address.toLowerCase();
  }, [state.isAuthenticated, state.session]);

  // Require authentication - returns session if authenticated, null if not
  const requireAuth = useCallback(async (walletAddress: string): Promise<SIWESession | null> => {
    // Check if already authenticated for this address
    if (state.session && state.session.address.toLowerCase() === walletAddress.toLowerCase()) {
      // Validate session is still valid
      const isValid = await validateSession(state.session);
      if (isValid) {
        return state.session;
      }
      // Session invalid, clear it
      saveSession(null);
      setState(prev => ({ ...prev, isAuthenticated: false, session: null }));
    }

    // Need to authenticate
    const success = await signIn(walletAddress);
    if (success) {
      // Re-read state after sign in
      const newSession = loadStoredSession();
      return newSession;
    }

    return null;
  }, [state.session, signIn, validateSession]);

  // Validate stored session on mount
  useEffect(() => {
    if (state.session) {
      validateSession(state.session).then(isValid => {
        if (!isValid) {
          console.log('[SIWE] Stored session is invalid, clearing');
          saveSession(null);
          setState({
            isAuthenticated: false,
            isAuthenticating: false,
            session: null,
            error: null,
          });
        }
      });
    }
  }, []); // Only run once on mount

  return {
    ...state,
    signIn,
    signOut,
    isAuthenticatedFor,
    requireAuth,
    validateSession,
  };
}
