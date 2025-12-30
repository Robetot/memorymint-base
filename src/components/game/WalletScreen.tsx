import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, Check, ExternalLink, RefreshCw, Image as ImageIcon, Smartphone, LogOut, Shield } from 'lucide-react';
import { useWallet, WalletType } from '@/hooks/useWallet';
import { useNFTCollection } from '@/hooks/useNFTCollection';
import { useContractReads } from '@/hooks/useContractReads';
import { useFarcaster } from '@/contexts/FarcasterContext';
import { useBaseApp } from '@/contexts/BaseAppContext';
import { FarcasterSignIn, FarcasterIcon } from './FarcasterSignIn';
import { AdminPanel } from './AdminPanel';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WalletScreenProps {
  onBack: () => void;
  onConnected: () => void;
}

// IPFS gateways for image fallback
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://nftstorage.link/ipfs/",
];

// NFT Image component with fallback handling
function NFTImage({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  
  const handleError = () => {
    // If it's an IPFS URL, try different gateways
    if (src.includes('/ipfs/') || src.startsWith('ipfs://')) {
      const cid = src.replace(/^ipfs:\/\//, '').replace(/^https?:\/\/[^/]+\/ipfs\//, '');
      if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
        setGatewayIndex(prev => prev + 1);
        setImgSrc(`${IPFS_GATEWAYS[gatewayIndex + 1]}${cid}`);
      } else {
        setHasError(true);
      }
    } else {
      setHasError(true);
    }
  };
  
  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
        <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
        <span className="text-xs text-amber-500">Image unavailable</span>
      </div>
    );
  }
  
  return (
    <img 
      src={imgSrc}
      alt={alt}
      className="w-full h-full object-cover"
      onError={handleError}
      loading="lazy"
    />
  );
}

// Base App icon component
function BaseAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="12" fill="#0052FF"/>
      <path 
        d="M12 4C7.58 4 4 7.58 4 12s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14.4c-3.53 0-6.4-2.87-6.4-6.4S8.47 5.6 12 5.6s6.4 2.87 6.4 6.4-2.87 6.4-6.4 6.4z" 
        fill="white"
      />
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  );
}

export function WalletScreen({ onBack, onConnected }: WalletScreenProps) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnectType, setDisconnectType] = useState<'wallet' | 'farcaster' | 'baseapp'>('wallet');
  const [isOwner, setIsOwner] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { 
    isConnected, 
    isConnecting, 
    address, 
    error, 
    isCorrectChain,
    isSmartWallet,
    isBaseApp: isBaseAppWallet,
    connectWallet, 
    formatAddress,
    switchToBase,
    disconnectWallet
  } = useWallet();

  const { 
    user: farcasterUser, 
    isAuthenticated: isFarcasterAuth,
    isExplicitlyConnected: isFarcasterExplicit,
    isLoading: isFarcasterLoading,
    isMiniApp,
    signIn: farcasterSignIn,
    signOut: farcasterSignOut,
    error: farcasterError 
  } = useFarcaster();

  const {
    isBaseApp,
    isConnected: isBaseAppConnected,
    walletAddress: baseAppAddress,
    connect: baseAppConnect,
    disconnect: baseAppDisconnect,
    isLoading: isBaseAppLoading,
  } = useBaseApp();

  const { nfts, isLoading: isLoadingNFTs, error: nftError, chainError, balance, debug, refetch, contractAddress } = useNFTCollection(address || baseAppAddress);
  
  const { isOwner: checkIsOwner } = useContractReads();
  
  // Wallet address for admin checks
  const walletAddress = address || baseAppAddress;
  
  // Check if current wallet is contract owner
  useEffect(() => {
    const checkOwnership = async () => {
      if (walletAddress) {
        const ownerStatus = await checkIsOwner(walletAddress);
        setIsOwner(ownerStatus);
      } else {
        setIsOwner(false);
      }
    };
    checkOwnership();
  }, [walletAddress, checkIsOwner]);

  const handleDisconnectClick = (type: 'wallet' | 'farcaster' | 'baseapp') => {
    setDisconnectType(type);
    setShowDisconnectDialog(true);
  };

  const handleConfirmDisconnect = () => {
    if (disconnectType === 'wallet') {
      disconnectWallet();
    } else if (disconnectType === 'farcaster' && farcasterSignOut) {
      farcasterSignOut();
    } else if (disconnectType === 'baseapp' && baseAppDisconnect) {
      baseAppDisconnect();
    }
    setShowDisconnectDialog(false);
  };

  const handleConnect = async (type: WalletType) => {
    const success = await connectWallet(type);
    if (success) {
      onConnected();
    }
  };

  const handleBaseAppConnect = async () => {
    if (isBaseApp) {
      const success = await baseAppConnect();
      if (success) {
        onConnected();
      }
    } else {
      // Open Base App with deep link
      const appUrl = encodeURIComponent(window.location.origin);
      window.open(`https://base.org/wallet?url=${appUrl}`, '_blank');
    }
  };

  const handleFarcasterSignIn = async () => {
    // If we're in a mini app, try SDK sign in
    if (isMiniApp) {
      const success = await farcasterSignIn();
      if (success) {
        onConnected();
      }
    } else {
      // In browser, open Warpcast to play as a mini app
      const gameUrl = encodeURIComponent(window.location.origin);
      window.open(`https://warpcast.com/~/frames?url=${gameUrl}`, '_blank');
    }
  };

  const handleSwitchNetwork = async () => {
    const success = await switchToBase();
    if (success && isConnected) {
      onConnected();
    }
  };

  // Consider connected if either wallet or Base App is connected
  // Farcaster counts only if explicitly connected (not auto-detected from mini-app context)
  const isFullyConnected = isConnected || isBaseAppConnected || isFarcasterExplicit;
  const displayAddress = address || baseAppAddress || (isFarcasterExplicit && farcasterUser ? `fid:${farcasterUser.fid}` : null);
  // Don't show "requires Farcaster client" as an error - it's expected in browsers
  const displayError = error || (farcasterError && !farcasterError.includes('Farcaster client') ? farcasterError : null);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-gradient-to-br from-background via-muted to-background overflow-y-auto">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="absolute top-6 left-6 rounded-full"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="text-center mb-8 mt-12">
        <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4">
          {isFullyConnected ? 'Your Wallet' : 'Connect Wallet'}
        </h1>
        <p className="text-muted-foreground font-body max-w-md mx-auto">
          {isFullyConnected 
            ? 'View your MemoryMint NFT collection'
            : 'Connect your wallet to play MemoryMint on Base and mint your skill-based NFTs'
          }
        </p>
        {(isBaseApp || isBaseAppWallet) && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-[#0052FF]/10 rounded-full">
            <BaseAppIcon className="w-4 h-4" />
            <span className="text-xs text-[#0052FF] font-medium">Base App Detected</span>
          </div>
        )}
      </div>

      {/* Connected State - Wallet */}
      {isConnected && address && (
        <Card className="w-full max-w-md mb-4 border-success bg-success/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Check className="w-5 h-5 text-success" />
            <div className="flex-1">
              <p className="font-body text-sm text-muted-foreground">
                {isSmartWallet ? 'Smart Wallet Connected' : 'Wallet Connected'}
              </p>
              <p className="font-medium text-foreground font-mono text-sm">
                {formatAddress(address)}
              </p>
              {isSmartWallet && (
                <span className="text-xs text-[#0052FF] font-medium">Base Smart Wallet</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isCorrectChain && (
                <Button size="sm" onClick={handleSwitchNetwork} variant="outline">
                  Switch to Base
                </Button>
              )}
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleDisconnectClick('wallet')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected State - Base App */}
      {isBaseAppConnected && baseAppAddress && !isConnected && (
        <Card className="w-full max-w-md mb-4 border-[#0052FF] bg-[#0052FF]/10">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#0052FF]/20 flex items-center justify-center">
              <BaseAppIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-body text-sm text-muted-foreground">Base App Connected</p>
              <p className="font-medium text-foreground font-mono text-sm">
                {formatAddress(baseAppAddress)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#0052FF]" />
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleDisconnectClick('baseapp')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected State - Farcaster (only show if explicitly connected) */}
      {isFarcasterExplicit && farcasterUser && (
        <Card className="w-full max-w-md mb-4 border-[#8B5CF6] bg-[#8B5CF6]/10">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#8B5CF6]/20 flex items-center justify-center">
              {farcasterUser.pfpUrl ? (
                <img 
                  src={farcasterUser.pfpUrl} 
                  alt={farcasterUser.displayName || farcasterUser.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <FarcasterIcon className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-body text-sm text-muted-foreground">Farcaster Connected</p>
              <p className="font-medium text-foreground">
                {farcasterUser.displayName || `@${farcasterUser.username}`}
              </p>
              <p className="text-xs text-muted-foreground">FID: {farcasterUser.fid}</p>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[#8B5CF6]" />
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => handleDisconnectClick('farcaster')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnectType === 'wallet' ? 'Wallet' : disconnectType === 'farcaster' ? 'Farcaster' : 'Base App'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect? You'll need to reconnect to access your NFT collection and game progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error State */}
      {displayError && (
        <Card className="w-full max-w-md mb-6 border-destructive bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{displayError}</p>
          </CardContent>
        </Card>
      )}

      {/* NFT Collection */}
      {(isConnected || isBaseAppConnected) && (address || baseAppAddress) && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-bold text-foreground">Your NFT Collection</h2>
            <Button variant="ghost" size="sm" onClick={refetch} disabled={isLoadingNFTs}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoadingNFTs && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {isLoadingNFTs ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Scanning blockchain for your NFTs...</p>
            </div>
          ) : chainError ? (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="py-6 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-amber-700 dark:text-amber-400">{chainError}</p>
                <Button variant="outline" className="mt-3" onClick={handleSwitchNetwork}>
                  Switch to Base Network
                </Button>
              </CardContent>
            </Card>
          ) : nftError ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-6 text-center">
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{nftError}</p>
                <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : nfts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <ImageIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground font-body">No NFTs found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Play a game and mint your first NFT!
                </p>
                {import.meta.env.DEV && debug && (
                  <div className="mt-4 text-left">
                    <div className="text-xs font-mono text-muted-foreground/70 space-y-1">
                      <div>address: {debug.address}</div>
                      <div>chainId: {debug.chainId ?? 'unknown'}</div>
                      <div>contract: {debug.contract}</div>
                      <div>balanceOf: {String(debug.balance ?? 'unknown')}</div>
                      <div>tokenIds: {debug.discoveredTokenIds.join(', ') || '[]'}</div>
                    </div>
                  </div>
                )}
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Collection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {nfts.map((nft) => {
                const isLoadingNFT = nft.tokenId.startsWith('loading-') || nft.tokenId.startsWith('syncing-') || nft.isLoading;
                const hasError = nft.tokenId.startsWith('error-') || nft.hasError;
                const isPending = nft.tokenId.startsWith('pending-');
                const showPlaceholder = isLoadingNFT || hasError || isPending;
                const displayTokenId = nft.tokenId.replace(/^(loading-|syncing-|error-|pending-)/, '');
                
                return (
                  <Card key={nft.tokenId} className={cn(
                    "overflow-hidden transition-all group",
                    isLoadingNFT && "animate-pulse",
                    hasError && "border-amber-500/30",
                    !showPlaceholder && "hover:border-primary/50"
                  )}>
                    <div className="aspect-square relative bg-muted">
                      {isLoadingNFT ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                      ) : nft.metadata?.image ? (
                        <NFTImage 
                          src={nft.metadata.image}
                          alt={nft.metadata.name || `NFT #${displayTokenId}`}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                          {hasError && <span className="text-xs text-amber-500">Tap Refresh</span>}
                          {isPending && <span className="text-xs text-muted-foreground">Pending</span>}
                        </div>
                      )}
                      {!showPlaceholder && (
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="font-display font-medium text-sm text-foreground truncate">
                        {nft.metadata?.name || `MemoryMint #${displayTokenId}`}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        {showPlaceholder ? (
                          <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                            {isLoadingNFT && <Loader2 className="w-3 h-3 animate-spin" />}
                            {isLoadingNFT ? 'Loading...' : hasError ? 'Refresh needed' : 'Pending...'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">#{displayTokenId}</span>
                        )}
                        {!showPlaceholder && nft.metadata?.attributes?.find(a => a.trait_type === 'Rarity') && (
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded font-medium',
                            nft.metadata.attributes.find(a => a.trait_type === 'Rarity')?.value === 'Mythic' && 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
                            nft.metadata.attributes.find(a => a.trait_type === 'Rarity')?.value === 'Legendary' && 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white',
                            nft.metadata.attributes.find(a => a.trait_type === 'Rarity')?.value === 'Epic' && 'bg-purple-500/20 text-purple-400',
                            nft.metadata.attributes.find(a => a.trait_type === 'Rarity')?.value === 'Rare' && 'bg-blue-500/20 text-blue-400',
                            nft.metadata.attributes.find(a => a.trait_type === 'Rarity')?.value === 'Common' && 'bg-muted text-muted-foreground'
                          )}>
                            {nft.metadata.attributes.find(a => a.trait_type === 'Rarity')?.value}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-center">
            <a 
              href={`https://basescan.org/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
            >
              View contract on BaseScan <ExternalLink className="w-3 h-3" />
            </a>

            {import.meta.env.DEV && debug && (
              <details className="mt-3 text-left rounded-lg border border-border bg-card/40 p-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  NFT Debug
                </summary>
                <div className="mt-2 text-xs font-mono text-muted-foreground/80 space-y-1">
                  <div>address: {debug.address}</div>
                  <div>chainId: {debug.chainId ?? 'unknown'}</div>
                  <div>contract: {debug.contract}</div>
                  <div>balanceOf: {String(debug.balance ?? 'unknown')}</div>
                  <div>tokenIds: {debug.discoveredTokenIds.join(', ') || '[]'}</div>
                  <div>tokenURIs:</div>
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(debug.tokenURIs, null, 2)}</pre>
                  {debug.errors.length > 0 && (
                    <>
                      <div>errors:</div>
                      <pre className="whitespace-pre-wrap break-words">{JSON.stringify(debug.errors, null, 2)}</pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Admin Panel - Owner Only */}
      {isOwner && walletAddress && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-display font-bold text-foreground">Admin Panel</h2>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAdminPanel(!showAdminPanel)}
            >
              {showAdminPanel ? 'Hide' : 'Show'} Admin Controls
            </Button>
          </div>
          
          {showAdminPanel && (
            <AdminPanel walletAddress={walletAddress} />
          )}
        </div>
      )}


      {!isFullyConnected && (
        <div className="grid gap-4 w-full max-w-md">
          {/* Base App - Featured for Base App users */}
          {(isBaseApp || isBaseAppWallet) && (
            <>
              <Card 
                className="cursor-pointer border-[#0052FF]/50 bg-[#0052FF]/5 hover:border-[#0052FF] transition-all hover:scale-[1.02] group"
                onClick={() => !isBaseAppLoading && handleBaseAppConnect()}
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="w-12 h-12 rounded-xl bg-[#0052FF]/20 flex items-center justify-center">
                    <BaseAppIcon className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg group-hover:text-[#0052FF] transition-colors flex items-center gap-2">
                      Base App
                      <span className="text-xs bg-[#0052FF] text-white px-2 py-0.5 rounded-full">Recommended</span>
                    </CardTitle>
                    <CardDescription className="font-body">Connect with Base smart wallet</CardDescription>
                  </div>
                  {isBaseAppLoading && (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  )}
                </CardHeader>
              </Card>
              
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or other wallets</span>
                </div>
              </div>
            </>
          )}

          {/* Farcaster Sign In - Always visible */}
          <FarcasterSignIn 
            onSignIn={handleFarcasterSignIn}
            isLoading={isFarcasterLoading}
            onSuccess={() => onConnected()}
          />
          
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or connect wallet</span>
            </div>
          </div>

          {/* Base App option for non-Base App users */}
          {!isBaseApp && !isBaseAppWallet && (
            <Card 
              className="cursor-pointer hover:border-[#0052FF]/50 transition-all hover:scale-[1.02] group"
              onClick={() => handleBaseAppConnect()}
            >
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                  <BaseAppIcon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg group-hover:text-[#0052FF] transition-colors">Base App</CardTitle>
                  <CardDescription className="font-body">Connect with Base smart wallet</CardDescription>
                </div>
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
            </Card>
          )}

          {/* Coinbase Wallet */}
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02] group"
            onClick={() => !isConnecting && handleConnect('coinbase')}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-8 h-8">
                  <circle cx="20" cy="20" r="20" fill="#0052FF"/>
                  <path fill="white" d="M20 6a14 14 0 100 28 14 14 0 000-28zm-4.5 18.5a1 1 0 01-1-1v-7a1 1 0 011-1h9a1 1 0 011 1v7a1 1 0 01-1 1h-9z"/>
                </svg>
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg group-hover:text-primary transition-colors">Coinbase Wallet</CardTitle>
                <CardDescription className="font-body">Connect with Coinbase Wallet</CardDescription>
              </div>
              {isConnecting && (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              )}
            </CardHeader>
          </Card>

          {/* MetaMask */}
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02] group"
            onClick={() => !isConnecting && handleConnect('metamask')}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="w-12 h-12 rounded-xl bg-[#F6851B]/10 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-8 h-8">
                  <path fill="#E4761B" d="M38.17 3.44l-15 11.16 2.78-6.56z"/>
                  <path fill="#E4761B" d="M1.83 3.44l14.87 11.27-2.65-6.67zM32.68 27.78l-4 6.11 8.54 2.35 2.45-8.32zM.33 27.92l2.44 8.32 8.54-2.35-4-6.11z"/>
                  <path fill="#E4761B" d="M10.91 17.33l-2.38 3.6 8.48.38-.3-9.12zM29.09 17.33l-5.91-5.25-.2 9.23 8.48-.38zM11.31 33.89l5.1-2.49-4.4-3.44zM23.59 31.4l5.1 2.49-.7-5.93z"/>
                  <path fill="#D7C1B3" d="M28.69 33.89l-5.1-2.49.41 3.32-.04 1.4zM11.31 33.89l4.73 2.23-.04-1.4.41-3.32z"/>
                  <path fill="#233447" d="M16.16 25.51l-4.24-1.25 3-1.37zM23.84 25.51l1.24-2.62 3.01 1.37z"/>
                  <path fill="#CD6116" d="M11.31 33.89l.73-6.11-4.73.14zM27.96 27.78l.73 6.11 4-5.97zM31.47 20.93l-8.48.38.79 4.2 1.24-2.62 3.01 1.37zM11.92 24.26l3.01-1.37 1.24 2.62.79-4.2-8.48-.38z"/>
                  <path fill="#E4751F" d="M8.48 20.93l3.53 6.89-.12-3.56zM28.09 24.26l-.13 3.56 3.51-6.89zM16.96 21.31l-.79 4.2 1 5.12.22-6.75zM23.01 21.31l-.42 2.56.22 6.76 1-5.12z"/>
                  <path fill="#F6851B" d="M23.84 25.51l-1 5.12-.71.5 4.4 3.44.73-5.93zM11.92 24.26l.7 5.93 4.4-3.44-.71-.5-1-5.12z"/>
                  <path fill="#C0AD9E" d="M23.89 36.12l.04-1.4-.38-.33h-5.7l-.38.33.04 1.4-4.73-2.23 1.65 1.35 3.36 2.33h5.8l3.36-2.33 1.65-1.35z"/>
                  <path fill="#161616" d="M23.59 31.4l.71-.5-1-5.12-.79 4.2-3.1 1.87h3.47l.71-.45zM16.41 31.4l-.71-.5 1-5.12.79 4.2 3.1 1.87h-3.47l-.71-.45z"/>
                  <path fill="#763D16" d="M38.57 14.6l1.27-6.12L37.56 3l-13.97 10.37 5.38 4.55 7.59 2.21 1.67-1.96-.73-.53 1.16-1.05-.89-.69 1.16-.88zM.16 8.48L1.43 14.6l-.73.55 1.16.88-.89.69 1.16 1.05-.73.53 1.67 1.96 7.59-2.21 5.38-4.55L2.44 3z"/>
                  <path fill="#F6851B" d="M36.56 20.13l-7.59-2.21 2.3 3.46-3.42 6.66 4.53-.06h6.75zM10.91 17.33l-7.59 2.21-2.53 8.38h6.75l4.53.06-3.42-6.66zM23.01 21.31l.49-8.48 2.21-5.98h-9.8l2.21 5.98.49 8.48.18 2.67.01 6.65h3.83l.01-6.65z"/>
                </svg>
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg group-hover:text-primary transition-colors">MetaMask</CardTitle>
                <CardDescription className="font-body">Connect with MetaMask wallet</CardDescription>
              </div>
              {isConnecting && (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              )}
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Network Info */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full border border-border">
          <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <span className="text-sm text-muted-foreground font-body">Base Network</span>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full border border-border">
          <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center">
            <FarcasterIcon className="w-4 h-4" />
          </div>
          <span className="text-sm text-muted-foreground font-body">Farcaster</span>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full border border-border">
          <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center">
            <BaseAppIcon className="w-4 h-4" />
          </div>
          <span className="text-sm text-muted-foreground font-body">Base App</span>
        </div>
      </div>
    </div>
  );
}
