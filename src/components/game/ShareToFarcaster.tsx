import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { useFarcaster } from '@/contexts/FarcasterContext';

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

  const handleShare = async () => {
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
  };

  return (
    <Button
      onClick={handleShare}
      variant="outline"
      className="gap-2 border-[#8B5CF6]/50 text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
    >
      <FarcasterShareIcon className="w-4 h-4" />
      Share on Farcaster
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

  const handleQuickShare = async () => {
    const gridSize = [2, 3, 4, 5, 6, 6][level - 1] || level + 1;
    const text = `🧠 ${score.toLocaleString()} pts on MemoryMint (${gridSize}×${gridSize})${rarity ? ` | ${rarity}` : ''} 🎮`;
    await shareToFarcaster(text);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleQuickShare}
      className={className}
    >
      <Share2 className="w-4 h-4" />
    </Button>
  );
}
