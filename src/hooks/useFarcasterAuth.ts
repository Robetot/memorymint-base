import { useState, useCallback, useEffect } from 'react';
import { sdk, type Context } from '@farcaster/miniapp-sdk';

export interface FarcasterProfile {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export interface FarcasterAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isMiniApp: boolean;
  profile: FarcasterProfile | null;
  error: string | null;
  context: Context.MiniAppContext | null;
}

export function useFarcasterAuth() {
  const [state, setState] = useState<FarcasterAuthState>({
    isAuthenticated: false,
    isLoading: true,
    isMiniApp: false,
    profile: null,
    error: null,
    context: null,
  });

  // Initialize and check Mini App context
  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await sdk.context;
        
        if (ctx?.user) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            isMiniApp: true,
            profile: {
              fid: ctx.user.fid,
              username: ctx.user.username || `fid:${ctx.user.fid}`,
              displayName: ctx.user.displayName,
              pfpUrl: ctx.user.pfpUrl,
            },
            error: null,
            context: ctx,
          });
          
          // Mark app as ready
          await sdk.actions.ready();
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
          // Still signal ready even if no user context
          try {
            await sdk.actions.ready();
          } catch {
            // Not in mini app context
          }
        }
      } catch {
        // Not in Mini App context
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    init();
  }, []);

  // Sign in with Farcaster (triggers SIWE flow)
  const signIn = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // First try to get context (user may already be signed in)
      const ctx = await sdk.context;
      
      if (ctx?.user) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          isMiniApp: true,
          profile: {
            fid: ctx.user.fid,
            username: ctx.user.username || `fid:${ctx.user.fid}`,
            displayName: ctx.user.displayName,
            pfpUrl: ctx.user.pfpUrl,
          },
          error: null,
          context: ctx,
        });
        return true;
      }

      // Trigger sign in flow
      const nonce = crypto.randomUUID();
      await sdk.actions.signIn({ 
        nonce,
        acceptAuthAddress: true 
      });

      // After sign in, try to get context again
      const newCtx = await sdk.context;
      if (newCtx?.user) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          isMiniApp: true,
          profile: {
            fid: newCtx.user.fid,
            username: newCtx.user.username || `fid:${newCtx.user.fid}`,
            displayName: newCtx.user.displayName,
            pfpUrl: newCtx.user.pfpUrl,
          },
          error: null,
          context: newCtx,
        });
        return true;
      }

      throw new Error('Could not get user info after sign in');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return false;
    }
  }, []);

  // Sign out
  const signOut = useCallback(() => {
    setState(prev => ({
      isAuthenticated: false,
      isLoading: false,
      isMiniApp: prev.isMiniApp,
      profile: null,
      error: null,
      context: null,
    }));
  }, []);

  return {
    ...state,
    signIn,
    signOut,
  };
}
