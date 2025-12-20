import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useProfile } from '@farcaster/auth-kit';

// Lazy import SDK to avoid errors in non-Farcaster environments
let sdk: any = null;
let sdkLoaded = false;

async function loadFarcasterSDK() {
  if (sdkLoaded) return sdk;
  try {
    const module = await import('@farcaster/miniapp-sdk');
    sdk = module.sdk;
    sdkLoaded = true;
    return sdk;
  } catch {
    sdkLoaded = true;
    return null;
  }
}

// Types for Farcaster user data
export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export interface FarcasterContextType {
  // User state
  user: FarcasterUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Mini App state
  isMiniApp: boolean;
  isReady: boolean;
  context: any | null;
  
  // Actions
  signIn: () => Promise<boolean>;
  signOut: () => void;
  
  // Social actions
  shareToFarcaster: (text: string, embedUrl?: string) => Promise<void>;
  composeCast: (text: string, embeds?: string[]) => Promise<void>;
  viewProfile: (fid: number) => void;
}

const FarcasterContext = createContext<FarcasterContextType | null>(null);

interface FarcasterProviderProps {
  children: ReactNode;
}

export function FarcasterProvider({ children }: FarcasterProviderProps) {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<any | null>(null);
  
  // Get auth-kit profile for browser-based sign-in
  const { isAuthenticated: authKitAuthenticated, profile: authKitProfile } = useProfile();

  // Sync auth-kit profile to user state
  useEffect(() => {
    if (authKitAuthenticated && authKitProfile?.fid && !isMiniApp) {
      setUser({
        fid: authKitProfile.fid,
        username: authKitProfile.username,
        displayName: authKitProfile.displayName,
        pfpUrl: authKitProfile.pfpUrl,
      });
    }
  }, [authKitAuthenticated, authKitProfile, isMiniApp]);

  // Check if running inside a Farcaster client
  useEffect(() => {
    const initMiniApp = async () => {
      try {
        const farcasterSdk = await loadFarcasterSDK();
        
        // If SDK couldn't load or we're not in a Farcaster environment
        if (!farcasterSdk) {
          setIsReady(true);
          setIsLoading(false);
          return;
        }

        // Try to get context - this will throw if not in a Farcaster client
        let ctx: any = null;
        try {
          ctx = await farcasterSdk.context;
        } catch {
          // Not in a Farcaster client - this is normal in browsers
          setIsReady(true);
          setIsLoading(false);
          return;
        }
        
        if (ctx?.user) {
          setIsMiniApp(true);
          setContext(ctx);
          setUser({
            fid: ctx.user.fid,
            username: ctx.user.username,
            displayName: ctx.user.displayName,
            pfpUrl: ctx.user.pfpUrl,
          });
        }
        
        // Signal that the app is ready
        try {
          await farcasterSdk.actions.ready();
        } catch {
          // ready() might fail outside mini app context
        }
        setIsReady(true);
        setIsLoading(false);
      } catch (err) {
        console.log('Farcaster SDK init failed (normal in browsers):', err);
        setIsReady(true);
        setIsLoading(false);
      }
    };

    initMiniApp();
  }, []);

  // Sign in with Farcaster (for mini app context)
  const signIn = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // If we already have context user, we're signed in
      if (context?.user) {
        setUser({
          fid: context.user.fid,
          username: context.user.username,
          displayName: context.user.displayName,
          pfpUrl: context.user.pfpUrl,
        });
        setIsLoading(false);
        return true;
      }

      const farcasterSdk = await loadFarcasterSDK();
      
      // Check if SDK is available
      if (!farcasterSdk?.actions?.signIn) {
        setError('Farcaster sign-in is only available in Farcaster clients');
        setIsLoading(false);
        return false;
      }

      // Generate a nonce for signing
      const nonce = crypto.randomUUID();
      
      // Request sign in
      let result: any;
      try {
        result = await farcasterSdk.actions.signIn({ 
          nonce,
          acceptAuthAddress: true 
        });
      } catch {
        setError('Sign in requires a Farcaster client (Warpcast, etc.)');
        setIsLoading(false);
        return false;
      }
      
      // Safely check result properties
      if (result && typeof result === 'object' && 'message' in result && 'signature' in result) {
        try {
          const ctx = await farcasterSdk.context;
          if (ctx?.user) {
            setUser({
              fid: ctx.user.fid,
              username: ctx.user.username,
              displayName: ctx.user.displayName,
              pfpUrl: ctx.user.pfpUrl,
            });
            setContext(ctx);
            setIsLoading(false);
            return true;
          }
        } catch {
          // Context fetch failed
        }
      }
      
      setError('Sign in requires a Farcaster client (Warpcast, etc.)');
      setIsLoading(false);
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Farcaster';
      setError(message);
      setIsLoading(false);
      return false;
    }
  }, [context]);

  // Sign out
  const signOut = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  const openWarpcastCompose = useCallback((text: string, embeds?: string[]) => {
    const embedParams = embeds?.map((e) => `embeds[]=${encodeURIComponent(e)}`).join('&') || '';
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}${embedParams ? `&${embedParams}` : ''}`;

    // Try a new tab first; if blocked, navigate in the same tab (works on iOS Safari).
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.assign(url);
    }
  }, []);

  const promiseWithTimeout = useCallback(<T,>(promise: Promise<T>, ms: number) => {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        const t = setTimeout(() => {
          clearTimeout(t);
          reject(new Error('Farcaster compose timeout'));
        }, ms);
      }),
    ]);
  }, []);

  // Compose a cast
  const composeCast = useCallback(async (text: string, embeds?: string[]) => {
    try {
      const farcasterSdk = await loadFarcasterSDK();

      if (!farcasterSdk?.actions?.composeCast) {
        openWarpcastCompose(text, embeds);
        return;
      }

      // SDK expects max 2 embeds as a tuple
      const embedsTuple: [] | [string] | [string, string] =
        !embeds?.length ? [] : embeds.length === 1 ? [embeds[0]] : [embeds[0], embeds[1]];

      // Some environments can hang forever; enforce a timeout then fallback.
      await promiseWithTimeout(
        farcasterSdk.actions.composeCast({
          text,
          embeds: embedsTuple,
        }),
        6000
      );
    } catch (err) {
      console.error('Failed to compose cast:', err);
      openWarpcastCompose(text, embeds);
    }
  }, [openWarpcastCompose, promiseWithTimeout]);

  // Share to Farcaster (alias for composeCast)
  const shareToFarcaster = useCallback(async (text: string, embedUrl?: string) => {
    await composeCast(text, embedUrl ? [embedUrl] : undefined);
  }, [composeCast]);

  // View a Farcaster profile
  const viewProfile = useCallback(async (fid: number) => {
    try {
      const farcasterSdk = await loadFarcasterSDK();
      if (farcasterSdk?.actions?.viewProfile) {
        farcasterSdk.actions.viewProfile({ fid });
      } else {
        window.open(`https://warpcast.com/~/profiles/${fid}`, '_blank');
      }
    } catch {
      window.open(`https://warpcast.com/~/profiles/${fid}`, '_blank');
    }
  }, []);

  const value: FarcasterContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    isMiniApp,
    isReady,
    context,
    signIn,
    signOut,
    shareToFarcaster,
    composeCast,
    viewProfile,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}

// Default fallback values when outside provider (for SSR/testing/error recovery)
const defaultFarcasterContext: FarcasterContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isMiniApp: false,
  isReady: true,
  context: null,
  signIn: async () => false,
  signOut: () => {},
  shareToFarcaster: async () => {},
  composeCast: async () => {},
  viewProfile: () => {},
};

export function useFarcaster() {
  const context = useContext(FarcasterContext);
  // Return default context if provider not found (graceful fallback)
  return context ?? defaultFarcasterContext;
}
