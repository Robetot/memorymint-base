import { useEffect, useState } from "react";
import { WEEK_01 } from "./week01.data";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, ExternalLink } from "lucide-react";

interface WeeklyCompleteModalProps {
  weekId: number;
  onClose?: () => void;
  onMint?: () => Promise<void>;
}

export function WeeklyCompleteModal({ weekId, onClose, onMint }: WeeklyCompleteModalProps) {
  const [minted, setMinted] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mintNFT() {
    if (minting || minted) return;
    
    setMinting(true);
    setError(null);
    
    try {
      if (onMint) {
        await onMint();
      } else {
        // Simulate mint for demo
        console.log("Minting NFT for week", weekId);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      setMinted(true);
    } catch (err) {
      console.error("Mint failed:", err);
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  }

  useEffect(() => {
    // Auto-mint on completion
    mintNFT();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-card to-background p-8 rounded-2xl text-center text-foreground max-w-md w-full mx-4 border border-border shadow-2xl">
        <div className="flex justify-center mb-4">
          <Trophy className="w-12 h-12 text-primary animate-bounce" />
        </div>
        
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Week {weekId} Complete!
        </h2>
        
        <p className="mb-6 text-muted-foreground">
          You discovered all hidden objects and solved the memory puzzle.
        </p>

        <div className="mb-6 relative">
          <div className="w-48 h-48 mx-auto rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-border flex items-center justify-center">
            <Sparkles className="w-16 h-16 text-primary animate-pulse" />
          </div>
          <p className="mt-2 text-sm font-medium text-primary">
            {WEEK_01.nftMetadata.name}
          </p>
        </div>

        {minting && (
          <div className="flex items-center justify-center gap-2 text-primary animate-pulse mb-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Minting your NFT...</span>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={mintNFT}
            >
              Retry Mint
            </Button>
          </div>
        )}

        {minted && (
          <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-4">
            <p className="text-primary font-semibold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              NFT Minted Successfully!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {WEEK_01.nftMetadata.name}
            </p>
          </div>
        )}

        {!minted && !minting && !error && (
          <Button
            className="w-full"
            onClick={mintNFT}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Mint NFT
          </Button>
        )}

        {onClose && (
          <Button
            variant="ghost"
            onClick={onClose}
            className="mt-4 text-muted-foreground hover:text-foreground"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
