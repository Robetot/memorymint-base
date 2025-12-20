import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

import { useFarcaster } from '@/contexts/FarcasterContext';
import { useIPFSUpload } from '@/hooks/useIPFSUpload';
import { createShareCardDataUrl } from '@/utils/shareCard';

interface ShareToFarcasterProps {
  score: number;
  level: number;
  rarity?: string;
  perfectGame?: boolean;
  nftImageUrl?: string;
}

export function ShareToFarcaster({ score, level, rarity, perfectGame, nftImageUrl }: ShareToFarcasterProps) {
  const { shareToFarcaster } = useFarcaster();
  const { uploadToIPFS } = useIPFSUpload();

  const [isSharing, setIsSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = async () => {
    if (isSharing || shared) return;

    setIsSharing(true);

    try {
      const gridSize = [2, 3, 4, 5, 6, 6][level - 1] || level + 1;
      const gameUrl = window.location.origin;

      let text = `🧠 Just scored ${score.toLocaleString()} points in MemoryMint!\n\n`;
      text += `📊 Level: ${gridSize}×${gridSize} grid\n`;

      if (rarity) text += `✨ Rarity: ${rarity}\n`;
      if (perfectGame) text += `🎯 PERFECT GAME - No mistakes!\n`;

      text += `\n🎮 Play free: ${gameUrl}`;

      // Prefer an existing NFT image, otherwise generate a share-card image and upload it.
      let embedUrl: string | undefined = nftImageUrl;

      if (!embedUrl) {
        try {
          const shareCardDataUrl = await createShareCardDataUrl({
            score,
            rarity,
            level,
            subtitle: 'Score Breakdown',
          });

          const uploaded = await uploadToIPFS(shareCardDataUrl, {
            name: `MemoryMint Score Card`,
            description: `Score card for ${score.toLocaleString()} points${rarity ? ` (${rarity})` : ''}.`,
            attributes: [
              { trait_type: 'Score', value: score },
              { trait_type: 'Level', value: level },
              ...(rarity ? [{ trait_type: 'Rarity', value: rarity }] : []),
            ],
          });

          embedUrl = uploaded?.imageGatewayUrl ?? uploaded?.imageUrl;
        } catch {
          // If share-card generation/upload fails, still share text + game URL.
        }
      }

      await shareToFarcaster(text, embedUrl || gameUrl);

      setShared(true);
      toast.success('Opening Farcaster…');
      setTimeout(() => setShared(false), 2500);
    } catch (err) {
      console.error('Failed to share:', err);
      toast.error('Share failed. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      onClick={handleShare}
      disabled={isSharing}
      variant="outline"
      className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
    >
      {isSharing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : shared ? (
        <Check className="w-4 h-4" />
      ) : (
        <Share2 className="w-4 h-4" />
      )}
      {isSharing ? 'Sharing…' : shared ? 'Shared!' : 'Share on Farcaster'}
    </Button>
  );
}

// Quick share button for other UI placements
export function QuickShareButton({
  score,
  level,
  rarity,
  className,
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
      const gameUrl = window.location.origin;
      const text = `🧠 ${score.toLocaleString()} pts on MemoryMint (${gridSize}×${gridSize})${rarity ? ` | ${rarity}` : ''} — ${gameUrl}`;
      await shareToFarcaster(text, gameUrl);
      toast.success('Opening Farcaster…');
    } catch {
      toast.error('Share failed');
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
      {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
    </Button>
  );
}

