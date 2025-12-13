import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { sdk, type Context } from '@farcaster/miniapp-sdk';

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
  context: Context.MiniAppContext | null;
  
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
  const [context, setContext] = useState<Context.MiniAppContext | null>(null);

  // Check if running inside a Farcaster client
  useEffect(() => {
    const initMiniApp = async () => {
      try {
        // Check if we're in a Farcaster context
        const ctx = await sdk.context;
        
        if (ctx?.user) {
          setIsMiniApp(true);
          setContext(ctx);
          // Auto-populate user from context
          setUser({
            fid: ctx.user.fid,
            username: ctx.user.username,
            displayName: ctx.user.displayName,
            pfpUrl: ctx.user.pfpUrl,
          });
        }
        
        // Signal that the app is ready
        await sdk.actions.ready();
        setIsReady(true);
        setIsLoading(false);
      } catch (err) {
        // Not in a mini app context, that's fine
        console.log('Not running as Mini App:', err);
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

      // Generate a nonce for signing
      const nonce = crypto.randomUUID();
      
      // Request sign in - this returns a SIWE message signature
      const result = await sdk.actions.signIn({ 
        nonce,
        acceptAuthAddress: true 
      });
      
      // The signIn action proves the user owns the wallet
      // In a production app, you'd verify this server-side to get the FID
      // For now, we'll use the context if available or show as signed in
      if (result.message && result.signature) {
        // User successfully signed - in production verify server-side
        // For demo, try to get context again
        const ctx = await sdk.context;
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
      }
      
      throw new Error('Sign in completed but could not get user info');
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

  // Compose a cast
  const composeCast = useCallback(async (text: string, embeds?: string[]) => {
    try {
      // SDK expects max 2 embeds as a tuple
      const embedsTuple: [] | [string] | [string, string] = 
        !embeds?.length ? [] :
        embeds.length === 1 ? [embeds[0]] :
        [embeds[0], embeds[1]];
      
      await sdk.actions.composeCast({
        text,
        embeds: embedsTuple,
      });
    } catch (err) {
      console.error('Failed to compose cast:', err);
      // Fallback to Warpcast URL
      const embedParams = embeds?.map(e => `embeds[]=${encodeURIComponent(e)}`).join('&') || '';
      window.open(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}${embedParams ? `&${embedParams}` : ''}`,
        '_blank'
      );
    }
  }, []);

  // Share to Farcaster (alias for composeCast)
  const shareToFarcaster = useCallback(async (text: string, embedUrl?: string) => {
    await composeCast(text, embedUrl ? [embedUrl] : undefined);
  }, [composeCast]);

  // View a Farcaster profile
  const viewProfile = useCallback((fid: number) => {
    try {
      sdk.actions.viewProfile({ fid });
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

export function useFarcaster() {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
}
