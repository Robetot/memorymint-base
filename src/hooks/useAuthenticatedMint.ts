import { useCallback } from 'react';
import { useNFTMint } from './useNFTMint';

/**
 * Simplified hook for unsigned NFT minting.
 * All signature verification, whitelist, and Merkle proof checks have been removed.
 * Users can mint directly without admin approval or off-chain signatures.
 */
export function useAuthenticatedMint() {
  const nftMint = useNFTMint();

  // Direct mint functions - no authentication required
  const mintNFT = useCallback(async (
    tokenURI: string,
    walletAddress: string
  ): Promise<boolean> => {
    return nftMint.mintNFT(tokenURI, walletAddress);
  }, [nftMint.mintNFT]);

  const batchMintNFT = useCallback(async (
    walletAddress: string,
    quantity: number
  ): Promise<boolean> => {
    return nftMint.batchMintNFT(walletAddress, quantity);
  }, [nftMint.batchMintNFT]);

  const quickMint = useCallback(async (
    walletAddress: string
  ): Promise<boolean> => {
    return nftMint.quickMint(walletAddress);
  }, [nftMint.quickMint]);

  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    return nftMint.claimBonus(walletAddress, levelId, gameLevel, levelProof);
  }, [nftMint.claimBonus]);

  return {
    // All original mint state
    ...nftMint,
    
    // Direct mint functions (no signature required)
    mintNFT,
    batchMintNFT,
    quickMint,
    claimBonus,
  };
}
