import { useCallback, useEffect, useState } from 'react';
import { useNFTMint } from './useNFTMint';
import { useSIWEAuth, SIWESession } from './useSIWEAuth';

/**
 * Combined hook that integrates SIWE authentication with NFT minting.
 * This hook ensures users are authenticated via SIWE before minting.
 */
export function useAuthenticatedMint() {
  const nftMint = useNFTMint();
  const siweAuth = useSIWEAuth();
  
  const [lastAuthenticatedAddress, setLastAuthenticatedAddress] = useState<string | null>(null);

  // Sync SIWE authentication state with mint state
  useEffect(() => {
    if (siweAuth.isAuthenticated && siweAuth.session) {
      nftMint.setSIWEAuthenticated(true);
      setLastAuthenticatedAddress(siweAuth.session.address);
    } else {
      nftMint.setSIWEAuthenticated(false);
      setLastAuthenticatedAddress(null);
    }
  }, [siweAuth.isAuthenticated, siweAuth.session, nftMint.setSIWEAuthenticated]);

  // Authenticate before mint
  const authenticateAndMint = useCallback(async (
    walletAddress: string,
    mintFn: () => Promise<boolean>
  ): Promise<boolean> => {
    // Check if SIWE is required
    if (!nftMint.requireSIWE) {
      return mintFn();
    }

    // Check if already authenticated for this address
    if (siweAuth.isAuthenticatedFor(walletAddress)) {
      return mintFn();
    }

    // Need to authenticate first
    console.log('[AuthMint] SIWE authentication required for:', walletAddress);
    
    const session = await siweAuth.requireAuth(walletAddress);
    if (!session) {
      console.log('[AuthMint] SIWE authentication failed');
      return false;
    }

    console.log('[AuthMint] SIWE authentication successful, proceeding with mint');
    return mintFn();
  }, [nftMint.requireSIWE, siweAuth]);

  // Wrapped mint functions that require SIWE authentication
  const mintNFT = useCallback(async (
    tokenURI: string,
    walletAddress: string
  ): Promise<boolean> => {
    return authenticateAndMint(
      walletAddress,
      () => nftMint.mintNFT(tokenURI, walletAddress)
    );
  }, [authenticateAndMint, nftMint.mintNFT]);

  const batchMintNFT = useCallback(async (
    walletAddress: string,
    quantity: number
  ): Promise<boolean> => {
    return authenticateAndMint(
      walletAddress,
      () => nftMint.batchMintNFT(walletAddress, quantity)
    );
  }, [authenticateAndMint, nftMint.batchMintNFT]);

  const quickMint = useCallback(async (
    walletAddress: string
  ): Promise<boolean> => {
    return authenticateAndMint(
      walletAddress,
      () => nftMint.quickMint(walletAddress)
    );
  }, [authenticateAndMint, nftMint.quickMint]);

  const mintWithSignature = useCallback(async (
    tokenURI: string,
    walletAddress: string,
    expiration: bigint,
    signature: `0x${string}`
  ): Promise<boolean> => {
    return authenticateAndMint(
      walletAddress,
      () => nftMint.mintWithSignature(tokenURI, walletAddress, expiration, signature)
    );
  }, [authenticateAndMint, nftMint.mintWithSignature]);

  const claimBonus = useCallback(async (
    walletAddress: string,
    levelId: bigint,
    gameLevel: bigint,
    levelProof: `0x${string}`
  ): Promise<{ success: boolean; txHash: string | null; error: string | null }> => {
    // Check if SIWE is required for claims
    if (nftMint.requireSIWE && !siweAuth.isAuthenticatedFor(walletAddress)) {
      const session = await siweAuth.requireAuth(walletAddress);
      if (!session) {
        return { success: false, txHash: null, error: 'SIWE authentication required' };
      }
    }

    return nftMint.claimBonus(walletAddress, levelId, gameLevel, levelProof);
  }, [nftMint.requireSIWE, siweAuth, nftMint.claimBonus]);

  // Enable SIWE requirement
  const enableSIWE = useCallback(() => {
    nftMint.setRequireSIWE(true);
  }, [nftMint.setRequireSIWE]);

  // Disable SIWE requirement
  const disableSIWE = useCallback(() => {
    nftMint.setRequireSIWE(false);
  }, [nftMint.setRequireSIWE]);

  return {
    // All original mint state
    ...nftMint,
    
    // Override mint functions with authenticated versions
    mintNFT,
    batchMintNFT,
    quickMint,
    mintWithSignature,
    claimBonus,
    
    // SIWE auth state
    siweAuth: {
      isAuthenticated: siweAuth.isAuthenticated,
      isAuthenticating: siweAuth.isAuthenticating,
      session: siweAuth.session,
      error: siweAuth.error,
      signIn: siweAuth.signIn,
      signOut: siweAuth.signOut,
      isAuthenticatedFor: siweAuth.isAuthenticatedFor,
    },
    
    // SIWE control
    enableSIWE,
    disableSIWE,
    lastAuthenticatedAddress,
  };
}

export type { SIWESession };
