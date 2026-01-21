import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Sparkles, Wand2, RefreshCw, Download, X, ExternalLink, Loader2, CheckCircle, AlertCircle, Wallet, Upload, Image, Layers, DollarSign, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/hooks/useWallet';
import { useNFTMint } from '@/hooks/useNFTMint';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import { useIPFSUpload } from '@/hooks/useIPFSUpload';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { calculateRarity } from '@/utils/rarityCalculator';
import { getLevel } from '@/data/levels';
import { toast } from 'sonner';
import { ANIMALS } from '@/data/animals';
import { BatchImageGenerator } from './BatchImageGenerator';
import { ConfigWarningBanner } from './ConfigWarningBanner';
import { MintStatusIndicator } from './MintStatusIndicator';
import { IPFSDiagnosticPanel } from './IPFSDiagnosticPanel';

interface AIImageGeneratorProps {
  score: number;
  onBack: () => void;
  onComplete: () => void;
  moves?: number;
  time?: number;
  maxCombo?: number;
  level?: number;
}

const STYLE_OPTIONS = [
  { id: 'classic', name: 'Classic Oil', prompt: 'oil painting style, classical art, rich colors, brushwork texture' },
  { id: 'pixel', name: 'Pixel Retro', prompt: 'pixel art style, 8-bit retro, vibrant colors, nostalgic' },
  { id: 'anime', name: 'Anime', prompt: 'anime style, Japanese animation, vibrant, detailed' },
  { id: '3d', name: '3D Sculpt', prompt: '3D rendered, clay sculpture, soft lighting, depth' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', prompt: 'cyberpunk style, neon lights, futuristic, dark atmosphere' },
  { id: 'gothic', name: 'Dark Gothic', prompt: 'dark gothic style, mysterious, dramatic shadows, ornate details' },
  { id: 'fantasy', name: 'Mythic Fantasy', prompt: 'fantasy art style, magical, ethereal, epic composition' },
];

// Get random preset animals for fallback
const getRandomPresetAnimals = (count: number = 12) => {
  const shuffled = [...ANIMALS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

export function AIImageGenerator({ 
  score, 
  onBack, 
  onComplete,
  moves = 0,
  time = 0,
  maxCombo = 0,
  level = 1
}: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [rollsRemaining, setRollsRemaining] = useState(3);
  const [mintStep, setMintStep] = useState<'idle' | 'uploading' | 'confirming' | 'waiting' | 'success'>('idle');
  const [showPresetFallback, setShowPresetFallback] = useState(false);
  const [presetAnimals] = useState(() => getRandomPresetAnimals(12));
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [balanceCheck, setBalanceCheck] = useState<{ hasEnough: boolean; balance: string; required: string; shortfall: string | null } | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [pendingMetadataUpdate, setPendingMetadataUpdate] = useState(false);
  
  const { isConnected, address, formatAddress, connectWallet, isConnecting, chainId } = useWallet();
  const { isMinting, txHash, success, error: mintError, mintNFT, resetMintState, contractAddress, getMintPriceEstimate, checkBalance, antiBotConfig, adminConfig } = useNFTMint();
  
  // Estimated gas fee for display
  const estimatedGasEth = '0.0002';
  const { isGenerating, generateImage, error: generateError } = useAIGenerate();
  const { isUploading, uploadToIPFS, error: uploadError, attempt: uploadAttempt, maxAttempts: maxUploadAttempts, clearError: clearUploadError, usedFallback } = useIPFSUpload();
  
  // Background upload queue for failed uploads
  const uploadQueue = useUploadQueue(async (imageData, metadata) => {
    const result = await uploadToIPFS(imageData, metadata);
    return result;
  });

  // Removed preflight checks - direct mint flow

  // Check balance when wallet connects or address changes
  useEffect(() => {
    if (isConnected && address) {
      checkBalance(address, 1).then(result => {
        if (result) setBalanceCheck(result);
      });
    } else {
      setBalanceCheck(null);
    }
  }, [isConnected, address, checkBalance]);
  
  // Real-time cooldown countdown
  useEffect(() => {
    if (antiBotConfig && antiBotConfig.cooldownRemaining > 0n) {
      setCooldownRemaining(Number(antiBotConfig.cooldownRemaining));
    } else {
      setCooldownRemaining(0);
    }
  }, [antiBotConfig]);
  
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [cooldownRemaining]);
  
  // Determine if cooldown is the actual error (only show if no higher priority errors)
  const isCooldownError = mintError?.includes('wait') && mintError?.includes('seconds');
  const shouldShowCooldown = cooldownRemaining > 0 && isConnected && !isMinting;

  // Calculate rarity based on game performance using level
  const levelConfig = getLevel(level);
  const totalPairs = Math.floor((levelConfig.gridColumns * levelConfig.gridRows) / 2);
  const rarity = calculateRarity(
    level,
    time,
    levelConfig.time,
    moves,
    totalPairs,
    maxCombo,
    moves === totalPairs
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedStyle) return;
    
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    if (!style) return;

    const image = await generateImage(prompt, style.prompt);
    
    if (image) {
      setGeneratedImage(image);
      setRollsRemaining(prev => prev - 1);
      setShowPresetFallback(false);
      toast.success('Image generated successfully!');
    } else {
      // Show fallback option when AI fails - don't block minting
      setShowPresetFallback(true);
      const errorMessage = generateError || 'AI generation unavailable';
      console.warn('[AIImageGenerator] Generation failed, showing preset fallback:', errorMessage);
      // Toast already shown by useAIGenerate hook
    }
  };

  const handleSelectPreset = async (animalImage: string) => {
    setSelectedPreset(animalImage);
    setShowPresetFallback(false);
    // Default to classic style for preset images
    if (!selectedStyle) setSelectedStyle('classic');
    
    // Convert local asset path to base64 for IPFS upload
    try {
      const response = await fetch(animalImage);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setGeneratedImage(base64data);
        toast.success('Preset image ready for minting!');
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load preset image:', err);
      // Fallback: use the original URL directly
      setGeneratedImage(animalImage);
      toast.success('Preset image selected!');
    }
  };

  const handleReroll = async () => {
    if (rollsRemaining <= 0) return;
    await handleGenerate();
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    
    try {
      // Handle base64 data URLs properly for all browsers
      if (generatedImage.startsWith('data:')) {
        // Convert base64 to blob for reliable download across browsers
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `memorymint-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL after download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        toast.success('Image downloaded!');
      } else {
        // For regular URLs, use standard download
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `memorymint-${Date.now()}.png`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Image downloaded!');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed. Try right-clicking the image and selecting "Save image as..."');
    }
  };

  /**
   * Build NFT metadata from game stats
   */
  const buildMetadata = () => {
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const isPresetImage = !!selectedPreset;
    const imageSource = isPresetImage ? 'Preset Animal' : 'AI Generated';
    
    return {
      name: `MemoryMint Level ${level} - ${rarity.tier}`,
      description: isPresetImage 
        ? `A skill-based NFT from MemoryMint. Level ${level} ${rarity.tier} achievement using preset artwork.`
        : `A skill-based NFT from MemoryMint. Created with prompt: "${prompt}"`,
      attributes: [
        { trait_type: 'Level', value: level },
        { trait_type: 'Score', value: score },
        { trait_type: 'Rarity', value: rarity.tier },
        { trait_type: 'Rarity Score', value: rarity.score },
        { trait_type: 'Moves', value: moves },
        { trait_type: 'Time Taken', value: `${time}s` },
        { trait_type: 'Max Combo', value: maxCombo },
        { trait_type: 'Perfect Game', value: moves === totalPairs ? 'Yes' : 'No' },
        { trait_type: 'Art Style', value: style?.name || 'Classic' },
        { trait_type: 'Image Source', value: imageSource },
        { trait_type: 'Created', value: new Date().toISOString() },
      ],
    };
  };

  /**
   * Retry upload only (when upload failed but user wants to try again)
   */
  const handleRetryUpload = async () => {
    if (!generatedImage || !selectedStyle) return;
    
    setUploadFailed(false);
    clearUploadError();
    setMintStep('uploading');
    
    const metadata = buildMetadata();
    const result = await uploadToIPFS(generatedImage, metadata);
    
    if (!result) {
      setMintStep('idle');
      setUploadFailed(true);
      // User-friendly error already set by hook
      return;
    }
    
    // Upload succeeded - proceed to mint
    setMintStep('confirming');
    toast.success('Upload complete! Please confirm in your wallet...');
    
    const mintResult = await mintNFT(result.tokenURI, address!);
    
    if (mintResult) {
      setMintStep('success');
      setUploadFailed(false);
      toast.success('NFT minted successfully!');
    } else {
      setMintStep('idle');
    }
  };

  const handleMint = async () => {
    if (!generatedImage || !selectedStyle) return;
    
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    if (!style) return;

    // Reset any previous upload failure state
    setUploadFailed(false);
    setPendingMetadataUpdate(false);
    clearUploadError();
    
    // Step 1: Upload to IPFS (with auto-retry 3x)
    setMintStep('uploading');
    toast.info('Uploading to IPFS...');
    
    const metadata = buildMetadata();
    
    // Try normal upload first
    let result = await uploadToIPFS(generatedImage, metadata);
    
    if (!result) {
      // All attempts failed - show retry UI
      // DO NOT mint with placeholder unless user explicitly chooses
      setMintStep('idle');
      setUploadFailed(true);
      console.warn('[Mint] IPFS upload failed after all retries - showing retry UI');
      return;
    }

    // Check if we used a placeholder (fail-open mode)
    if (result.usedFallback) {
      // Queue background retry for real upload
      uploadQueue.addToQueue(generatedImage, metadata);
      setPendingMetadataUpdate(true);
      toast.warning('Minting with temporary metadata. Will update automatically.');
    }

    // Step 2: Confirm transaction in wallet (single transaction)
    setMintStep('confirming');
    toast.success('Please confirm in your wallet...');

    // Mint with the token URI (real or placeholder)
    // Contract will enforce all rules (free mint, kill switch, anti-bot, etc.)
    const mintResult = await mintNFT(result.tokenURI, address!);
    
    if (mintResult) {
      setMintStep('success');
      setUploadFailed(false);
      if (result.usedFallback) {
        toast.success('NFT minted! Metadata will be updated shortly.');
      } else {
        toast.success('NFT minted successfully!');
      }
    } else {
      setMintStep('idle');
      // Show error but don't block - contract enforced the rule
    }
  };

  const handleConnectWallet = async (type: 'metamask' | 'coinbase') => {
    const success = await connectWallet(type);
    if (success) {
      toast.success('Wallet connected!');
    }
  };

  const getMintStepText = () => {
    switch (mintStep) {
      case 'uploading': return { title: 'Uploading to IPFS...', subtitle: 'Storing your artwork permanently' };
      case 'confirming': return { title: 'Confirm in Wallet', subtitle: 'Approve the transaction to mint (Step 1/1)' };
      case 'waiting': return { title: 'Processing...', subtitle: 'Waiting for blockchain confirmation' };
      case 'success': return { title: 'Success!', subtitle: 'Your NFT has been minted' };
    default: return { title: '', subtitle: '' };
    }
  };

  const handleBatchImageSelect = (image: string) => {
    setGeneratedImage(image);
    setShowBatchMode(false);
    if (!selectedStyle) setSelectedStyle('classic');
    toast.success('Image selected from batch!');
  };

  // Show batch mode
  if (showBatchMode) {
    return (
      <BatchImageGenerator
        onBack={() => setShowBatchMode(false)}
        onSelectImage={handleBatchImageSelect}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Create Your NFT Art
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">Score: {score.toLocaleString()}</p>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                rarity.tier === 'Mythic' && 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
                rarity.tier === 'Legendary' && 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white',
                rarity.tier === 'Epic' && 'bg-purple-500/20 text-purple-400',
                rarity.tier === 'Rare' && 'bg-blue-500/20 text-blue-400',
                rarity.tier === 'Common' && 'bg-muted text-muted-foreground'
              )}>
                {rarity.tier}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Wallet Connection Status */}
        {isConnected && address ? (
          <div className="mb-4 p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-sm text-foreground font-mono">{formatAddress(address)}</span>
            <span className="text-xs text-muted-foreground ml-auto">Base Network</span>
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground mb-3 text-center">Connect wallet to mint your NFT</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => handleConnectWallet('metamask')}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                MetaMask
              </Button>
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => handleConnectWallet('coinbase')}
                disabled={isConnecting}
              >
                {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wallet className="w-4 h-4 mr-2" />}
                Coinbase
              </Button>
            </div>
          </div>
        )}

        {!generatedImage ? (
          <>
            {/* Prompt Input */}
            <div className="mb-6">
              <label className="block text-sm font-display font-medium text-foreground mb-2">
                Describe Your Art
              </label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A majestic dragon flying over mountains..."
                className="text-lg py-6"
              />
            </div>

            {/* Style Selection */}
            <div className="mb-8">
              <label className="block text-sm font-display font-medium text-foreground mb-3">
                Choose Art Style
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-center transition-all',
                      selectedStyle === style.id
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-border hover:border-primary/50 bg-card'
                    )}
                  >
                    <p className="font-display font-medium text-foreground text-sm">
                      {style.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim() || !selectedStyle || isGenerating}
                size="lg"
                className="flex-1 text-lg font-display bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowBatchMode(true)}
                variant="outline"
                size="lg"
                className="font-display"
                disabled={isGenerating}
              >
                <Layers className="w-5 h-5" />
              </Button>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              <button 
                onClick={() => setShowBatchMode(true)} 
                className="text-primary hover:underline"
              >
                Batch mode
              </button>
              {' '}— generate multiple variants at once
            </p>

            {generateError && (
              <p className="mt-3 text-sm text-destructive text-center">{generateError}</p>
            )}

            {/* Preset Fallback when AI fails */}
            {showPresetFallback && (
              <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Image className="w-5 h-5 text-primary" />
                  <p className="font-display font-medium text-foreground">Use Preset Artwork Instead</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  AI credits exhausted. Choose from our curated animal collection to mint your NFT.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {presetAnimals.map((animal) => (
                    <button
                      key={animal.id}
                      onClick={() => handleSelectPreset(animal.image)}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all hover:scale-105"
                    >
                      <img
                        src={animal.image}
                        alt={animal.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Generated Image */}
            <div className="mb-6">
              <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-primary shadow-2xl">
                <img
                  src={generatedImage}
                  alt="Generated AI Art"
                  className="w-full h-full object-cover"
                />
                {isGenerating && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>

            {/* Mint Status - Enhanced Progress with upload attempt indicator */}
            {mintStep !== 'idle' && mintStep !== 'success' && (
              <div className="mb-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{getMintStepText().title}</p>
                    <p className="text-sm text-muted-foreground">
                      {getMintStepText().subtitle}
                      {mintStep === 'uploading' && uploadAttempt > 1 && (
                        <span className="ml-2 text-xs text-muted-foreground/70">
                          (Retry {uploadAttempt}/{maxUploadAttempts})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                    style={{ 
                      width: mintStep === 'uploading' ? '33%' : 
                             mintStep === 'confirming' ? '66%' : 
                             mintStep === 'waiting' ? '90%' : '100%' 
                    }}
                  />
                </div>
              </div>
            )}

            {success && txHash && (
              <div className="mb-4 p-4 rounded-xl bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <p className="font-medium text-foreground">NFT Minted Successfully!</p>
                </div>
                <a 
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View on BaseScan <ExternalLink className="w-3 h-3" />
                </a>
                {pendingMetadataUpdate && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    <span>Metadata update pending - will sync automatically</span>
                  </div>
                )}
              </div>
            )}

            {/* Background Queue Status */}
            {uploadQueue.hasPending && (
              <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {uploadQueue.pendingUploads.length} upload(s) syncing in background...
                </span>
              </div>
            )}

            {/* Config Warning Banner - shows when RPC reads failed but minting still allowed */}
            <ConfigWarningBanner show={adminConfig?.configFetchFailed === true} />

            {/* Mint Status Indicator - live contract status */}
            <MintStatusIndicator className="mb-4" compact={false} />


            {/* Cooldown Countdown - Real-time display */}
            {shouldShowCooldown && (
              <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Mint available in <span className="font-mono font-bold">{cooldownRemaining}s</span>
                </p>
              </div>
            )}

            {/* Upload Failed - Friendly Retry UI (Gold Standard: don't block, allow retry) */}
            {uploadFailed && uploadError && !success && (
              <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  <p className="font-medium text-foreground">Upload Delayed</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {uploadError}
                </p>
                <Button 
                  onClick={handleRetryUpload} 
                  size="sm" 
                  variant="outline"
                  className="w-full border-amber-500/30 hover:bg-amber-500/10"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry Upload
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Contract Errors - Only show real contract reverts (not infra errors) */}
            {mintError && !isCooldownError && !uploadFailed && (
              <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-sm text-destructive">{mintError}</p>
                <Button variant="ghost" size="sm" onClick={resetMintState} className="ml-auto">
                  Retry
                </Button>
              </div>
            )}
            
            {/* Cooldown error display (when no live countdown) */}
            {!shouldShowCooldown && isCooldownError && (
              <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <p className="text-sm text-destructive">{mintError}</p>
                <Button variant="ghost" size="sm" onClick={resetMintState} className="ml-auto">
                  Retry
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button
                  onClick={handleReroll}
                  disabled={rollsRemaining <= 0 || isGenerating || isMinting || isUploading}
                  variant="outline"
                  size="lg"
                  className="flex-1 font-display"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Re-roll ({rollsRemaining} left)
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="lg"
                  className="flex-1 font-display"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download
                </Button>
              </div>

              {/* Fee Breakdown - Show before minting */}
              {!success && isConnected && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Mint Cost</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas fee (estimated)</span>
                      <span className="text-foreground">~{estimatedGasEth} ETH</span>
                    </div>
                    <div className="border-t border-border pt-1 mt-1 flex justify-between font-medium">
                      <span className="text-foreground">Total (gas only)</span>
                      <span className="text-primary">
                        ~{estimatedGasEth} ETH
                      </span>
                    </div>
                    {balanceCheck && (
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-muted-foreground">Your balance</span>
                        <span className={balanceCheck.hasEnough ? 'text-success' : 'text-destructive'}>
                          {balanceCheck.balance} ETH
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Low Balance Warning */}
              {!success && isConnected && balanceCheck && !balanceCheck.hasEnough && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive text-sm">Insufficient Balance</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You need at least <span className="font-mono text-foreground">{balanceCheck.required} ETH</span> to mint.
                      You're short by <span className="font-mono text-destructive">{balanceCheck.shortfall} ETH</span>.
                    </p>
                    <a 
                      href="https://bridge.base.org" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                    >
                      Bridge ETH to Base →
                    </a>
                  </div>
                </div>
              )}

              {!success ? (
                <Button
                  onClick={handleMint}
                  size="lg"
                  className="w-full text-lg font-display bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                  disabled={!isConnected || isMinting || isUploading || (balanceCheck && !balanceCheck.hasEnough) || shouldShowCooldown}
                >
                  {isMinting || isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {isUploading ? 'Uploading...' : 'Minting...'}
                    </>
                  ) : shouldShowCooldown ? (
                    <>
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Wait {cooldownRemaining}s
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      {isConnected ? 'Mint NFT' : 'Connect Wallet to Mint'}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={onComplete}
                  size="lg"
                  className="w-full text-lg font-display bg-gradient-to-r from-success to-primary"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Complete
                </Button>
              )}

              <div className="text-center text-xs text-muted-foreground">
                <p>Contract: <a href={`https://basescan.org/address/${contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{contractAddress.slice(0, 10)}...</a></p>
              </div>

              <Button
                onClick={onBack}
                variant="ghost"
                className="w-full font-body text-muted-foreground"
                disabled={isMinting || isUploading}
              >
                Back to Menu
              </Button>
            </div>
          </>
        )}
      </div>
      
      {/* Developer Diagnostic Panel */}
      <IPFSDiagnosticPanel />
    </div>
  );
}
