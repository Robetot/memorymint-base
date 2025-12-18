import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';
import { SignInButton, useProfile } from '@farcaster/auth-kit';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { useEffect } from 'react';

// Farcaster purple color
const FARCASTER_PURPLE = '#8B5CF6';

// Farcaster logo icon component
function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
    >
      <path 
        d="M18.24 3H5.76C4.24 3 3 4.24 3 5.76v12.48C3 19.76 4.24 21 5.76 21h12.48c1.52 0 2.76-1.24 2.76-2.76V5.76C21 4.24 19.76 3 18.24 3z" 
        fill="#8B5CF6"
      />
      <path 
        d="M16.5 7.5H7.5v1.5h9V7.5zM16.5 10.5H7.5V12h9v-1.5zM16.5 13.5H7.5V15h4.5v1.5H7.5V18h9v-6h-4.5v4.5H15v-3h1.5v-3z" 
        fill="white"
      />
    </svg>
  );
}

interface FarcasterSignInProps {
  onSignIn: () => Promise<boolean> | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  onSuccess?: (profile: { fid: number; username?: string }) => void;
}

export function FarcasterSignIn({ onSignIn, isLoading, disabled, onSuccess }: FarcasterSignInProps) {
  const { isMiniApp, user, isAuthenticated } = useFarcaster();
  const { isAuthenticated: authKitAuthenticated, profile } = useProfile();
  
  // Handle auth-kit success callback
  useEffect(() => {
    if (authKitAuthenticated && profile?.fid && onSuccess) {
      onSuccess({ fid: profile.fid, username: profile.username });
    }
  }, [authKitAuthenticated, profile, onSuccess]);

  // Show connected state if already authenticated
  if (isAuthenticated && user) {
    return (
      <Card className="border-[#8B5CF6] bg-[#8B5CF6]/10">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#8B5CF6]/20 flex items-center justify-center">
            {user.pfpUrl ? (
              <img 
                src={user.pfpUrl} 
                alt={user.displayName || user.username} 
                className="w-full h-full object-cover"
              />
            ) : (
              <FarcasterIcon className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-body text-sm text-muted-foreground">Farcaster Connected</p>
            <p className="font-medium text-foreground">
              {user.displayName || `@${user.username}`}
            </p>
          </div>
          <Check className="w-5 h-5 text-[#8B5CF6]" />
        </CardContent>
      </Card>
    );
  }

  // In Mini App context, use SDK sign-in
  if (isMiniApp) {
    return (
      <Card 
        className="cursor-pointer hover:border-[#8B5CF6]/50 transition-all hover:scale-[1.02] group"
        onClick={() => !isLoading && !disabled && onSignIn()}
      >
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${FARCASTER_PURPLE}20` }}
          >
            <FarcasterIcon className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg group-hover:text-[#8B5CF6] transition-colors">
              Sign in with Farcaster
            </CardTitle>
            <CardDescription className="font-body">
              Connect your Farcaster account
            </CardDescription>
          </div>
          {isLoading && (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          )}
        </CardHeader>
      </Card>
    );
  }

  // In browser, use auth-kit SignInButton
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${FARCASTER_PURPLE}20` }}
        >
          <FarcasterIcon className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Sign in with Farcaster</CardTitle>
          <CardDescription className="font-body">
            Connect your Farcaster account
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="farcaster-signin-wrapper">
          <SignInButton 
            onSuccess={({ fid, username }) => {
              onSuccess?.({ fid, username });
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Button variant for inline use
export function FarcasterButton({ 
  onSignIn, 
  isLoading, 
  children = 'Sign in with Farcaster' 
}: FarcasterSignInProps & { children?: React.ReactNode }) {
  const { isMiniApp } = useFarcaster();
  
  // In Mini App, use direct button
  if (isMiniApp) {
    return (
      <Button
        onClick={onSignIn}
        disabled={isLoading}
        className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white gap-2"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FarcasterIcon className="w-5 h-5" />
        )}
        {children}
      </Button>
    );
  }
  
  // In browser, use auth-kit
  return (
    <div className="farcaster-button-wrapper">
      <SignInButton />
    </div>
  );
}

export { FarcasterIcon };