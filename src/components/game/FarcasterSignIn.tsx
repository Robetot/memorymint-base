import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface FarcasterSignInProps {
  onSignIn: () => Promise<boolean> | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

// Farcaster purple color
const FARCASTER_PURPLE = '#8B5CF6';

export function FarcasterSignIn({ onSignIn, isLoading, disabled }: FarcasterSignInProps) {
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

// Button variant for inline use
export function FarcasterButton({ 
  onSignIn, 
  isLoading, 
  children = 'Sign in with Farcaster' 
}: FarcasterSignInProps & { children?: React.ReactNode }) {
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

export { FarcasterIcon };
