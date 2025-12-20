import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Loader2, Check } from 'lucide-react';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { toast } from 'sonner';

interface ShareToFarcasterProps {
  score: number;
  level: number;
  rarity?: string;
  perfectGame?: boolean;
  nftImageUrl?: string;
}

export function ShareToFarcaster({ 
  score, 
  level, 
  rarity, 
  perfectGame,
  nftImageUrl 
}: ShareToFarcasterProps) {
  const { shareToFarcaster, isMiniApp } = useFarcaster();
  const [isSharing, setIsSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    if (isSharing || shared) return;
    
    setIsSharing(true);
    
    try {
      const gridSize = [2, 3, 4, 5, 6, 6][level - 1] || level + 1;
      
      let text = `🧠 Just scored ${score.toLocaleString()} points in MemoryMint!\n\n`;
      text += `📊 Level: ${gridSize}×${gridSize} grid\n`;
      
      if (rarity) {
        text += `✨ Rarity: ${rarity}\n`;
      }
      
      if (perfectGame) {
        text += `🎯 PERFECT GAME - No mistakes!\n`;
      }
      
      text += `\n🎮 Play free on Base: `;
      
      const gameUrl = window.location.origin;
      
      await shareToFarcaster(text, nftImageUrl || gameUrl);
      
      setShared(true);
      toast.success('Opening Farcaster to share...');
      
      // Reset after a delay
      setTimeout(() => setShared(false), 3000);
    } catch (err) {
      console.error('Failed to share:', err);
      toast.error('Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      onClick={handleShare}
      disabled={isSharing}
      variant="outline"
      className="w-full gap-2 border-[#8B5CF6]/50 text-[#8B5CF6] hover:bg-[#8B5CF6]/10 disabled:opacity-50"
    >
      {isSharing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : shared ? (
        <Check className="w-4 h-4" />
      ) : (
        <FarcasterShareIcon className="w-4 h-4" />
      )}
      {isSharing ? 'Sharing...' : shared ? 'Shared!' : 'Share on Farcaster'}
    </Button>
  );
}

function FarcasterShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.24 3H5.76C4.24 3 3 4.24 3 5.76v12.48C3 19.76 4.24 21 5.76 21h12.48c1.52 0 2.76-1.24 2.76-2.76V5.76C21 4.24 19.76 3 18.24 3z"/>
    </svg>
  );
}

// Quick share button for game over screen
export function QuickShareButton({ 
  score, 
  level,
  rarity,
  className 
}: { 
  score: number; 
  level: number;
  rarity?: string;
  className?: string;
}) {
  const { shareToFarcaster } = useFarcaster();
  const [isSharing, setIsSharing] = useState(false);

  const handleQuickShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    try {
      const gridSize = [2, 3, 4, 5, 6, 6][level - 1] || level + 1;
      const text = `🧠 ${score.toLocaleString()} pts on MemoryMint (${gridSize}×${gridSize})${rarity ? ` | ${rarity}` : ''} 🎮`;
      await shareToFarcaster(text);
      toast.success('Opening Farcaster...');
    } catch (err) {
      toast.error('Failed to share');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleQuickShare}
      disabled={isSharing}
      className={className}
      aria-label={`Share score of ${score.toLocaleString()} points to Farcaster`}
    >
      {isSharing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Share2 className="w-4 h-4" aria-hidden="true" />
      )}
    </Button>
  );
}
