// NFT Rarity Card Component - Visual designs for each rarity tier
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NFTRarityTier, NFT_RARITY_STYLES } from '@/data/levels';
import { PerformanceTraits } from '@/utils/rarityCalculator';

interface NFTRarityCardProps {
  rarity: NFTRarityTier;
  imageUrl?: string;
  name?: string;
  tokenId?: string;
  traits?: PerformanceTraits;
  size?: 'sm' | 'md' | 'lg';
  showTraits?: boolean;
  className?: string;
}

// Rarity-specific animations and styles
const RARITY_CONFIG: Record<NFTRarityTier, {
  frameGradient: string;
  glowColor: string;
  particleColors: string[];
  animationIntensity: number;
  borderWidth: string;
}> = {
  Common: {
    frameGradient: 'from-slate-400/40 via-slate-300/30 to-slate-400/40',
    glowColor: 'rgba(148, 163, 184, 0.3)',
    particleColors: ['#94a3b8'],
    animationIntensity: 0,
    borderWidth: 'border-2',
  },
  Uncommon: {
    frameGradient: 'from-emerald-500/50 via-emerald-400/40 to-emerald-500/50',
    glowColor: 'rgba(52, 211, 153, 0.4)',
    particleColors: ['#34d399', '#6ee7b7'],
    animationIntensity: 1,
    borderWidth: 'border-2',
  },
  Rare: {
    frameGradient: 'from-blue-500/60 via-cyan-400/50 to-blue-500/60',
    glowColor: 'rgba(59, 130, 246, 0.5)',
    particleColors: ['#3b82f6', '#22d3ee', '#60a5fa'],
    animationIntensity: 2,
    borderWidth: 'border-3',
  },
  Epic: {
    frameGradient: 'from-purple-600/70 via-violet-500/60 to-purple-600/70',
    glowColor: 'rgba(147, 51, 234, 0.6)',
    particleColors: ['#a855f7', '#c084fc', '#8b5cf6'],
    animationIntensity: 3,
    borderWidth: 'border-3',
  },
  Legendary: {
    frameGradient: 'from-amber-500/80 via-orange-400/70 to-amber-500/80',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    particleColors: ['#f59e0b', '#fbbf24', '#fb923c'],
    animationIntensity: 4,
    borderWidth: 'border-4',
  },
  Mythic: {
    frameGradient: 'from-rose-500/90 via-purple-500/80 via-cyan-400/70 to-rose-500/90',
    glowColor: 'rgba(244, 63, 94, 0.8)',
    particleColors: ['#f43f5e', '#a855f7', '#06b6d4', '#fbbf24'],
    animationIntensity: 5,
    borderWidth: 'border-4',
  },
};

// Floating particles for higher rarities
function RarityParticles({ rarity, intensity }: { rarity: NFTRarityTier; intensity: number }) {
  if (intensity < 2) return null;
  
  const config = RARITY_CONFIG[rarity];
  const particleCount = Math.min(intensity * 3, 12);
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
      {Array.from({ length: particleCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: config.particleColors[i % config.particleColors.length],
            left: `${10 + (i * 80 / particleCount)}%`,
            bottom: '-10%',
          }}
          animate={{
            y: [0, -150 - Math.random() * 100],
            x: [0, (Math.random() - 0.5) * 40],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.3],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// Aura glow effect for Legendary/Mythic
function AuraGlow({ rarity }: { rarity: NFTRarityTier }) {
  const config = RARITY_CONFIG[rarity];
  
  if (config.animationIntensity < 4) return null;
  
  return (
    <motion.div
      className="absolute -inset-4 rounded-2xl opacity-50 blur-xl pointer-events-none"
      style={{
        background: rarity === 'Mythic' 
          ? 'linear-gradient(45deg, #f43f5e, #a855f7, #06b6d4, #fbbf24)'
          : 'linear-gradient(45deg, #f59e0b, #fbbf24, #fb923c)',
      }}
      animate={{
        rotate: [0, 360],
        scale: [1, 1.1, 1],
      }}
      transition={{
        rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
        scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      }}
    />
  );
}

// Shimmer effect for Rare+
function ShimmerEffect({ intensity }: { intensity: number }) {
  if (intensity < 2) return null;
  
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12"
        animate={{
          x: ['-200%', '200%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 2,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
}

export function NFTRarityCard({
  rarity,
  imageUrl,
  name,
  tokenId,
  traits,
  size = 'md',
  showTraits = false,
  className,
}: NFTRarityCardProps) {
  const styles = NFT_RARITY_STYLES[rarity];
  const config = RARITY_CONFIG[rarity];
  
  const sizeClasses = {
    sm: 'w-32 h-40',
    md: 'w-48 h-60',
    lg: 'w-64 h-80',
  };
  
  const imageSizeClasses = {
    sm: 'h-24',
    md: 'h-40',
    lg: 'h-56',
  };

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Aura glow for Legendary/Mythic */}
      <AuraGlow rarity={rarity} />
      
      {/* Main card */}
      <motion.div
        className={cn(
          'relative rounded-xl overflow-hidden',
          sizeClasses[size],
          config.borderWidth,
          'border-transparent',
          'bg-gradient-to-br',
          styles.bgGradient,
          styles.glow,
          config.animationIntensity >= 3 && 'shadow-xl',
          config.animationIntensity >= 4 && 'shadow-2xl',
        )}
        style={{
          boxShadow: `0 0 ${20 + config.animationIntensity * 10}px ${config.glowColor}`,
        }}
        whileHover={{ 
          scale: 1.05,
          boxShadow: `0 0 ${30 + config.animationIntensity * 15}px ${config.glowColor}`,
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Frame border gradient */}
        <div className={cn(
          'absolute inset-0 rounded-xl bg-gradient-to-br p-[2px]',
          config.frameGradient,
        )}>
          <div className="absolute inset-[2px] rounded-lg bg-card" />
        </div>
        
        {/* Particles */}
        <RarityParticles rarity={rarity} intensity={config.animationIntensity} />
        
        {/* Shimmer */}
        <ShimmerEffect intensity={config.animationIntensity} />
        
        {/* Content */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Image area */}
          <div className={cn(
            'relative overflow-hidden bg-gradient-to-br from-muted/50 to-muted',
            imageSizeClasses[size],
          )}>
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={name || 'NFT'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl">{styles.icon}</span>
              </div>
            )}
            
            {/* Rarity badge */}
            <div className={cn(
              'absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold',
              rarity === 'Mythic' && 'bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500 text-white animate-pulse',
              rarity === 'Legendary' && 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
              rarity === 'Epic' && 'bg-purple-500/90 text-white',
              rarity === 'Rare' && 'bg-blue-500/90 text-white',
              rarity === 'Uncommon' && 'bg-emerald-500/90 text-white',
              rarity === 'Common' && 'bg-slate-500/90 text-white',
            )}>
              {rarity}
            </div>
          </div>
          
          {/* Info area */}
          <div className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <p className={cn(
                'font-display font-bold text-sm truncate',
                styles.color,
              )}>
                {name || `Memory Mint`}
              </p>
              {tokenId && (
                <p className="text-xs text-muted-foreground">
                  #{tokenId}
                </p>
              )}
            </div>
            
            {/* Traits preview */}
            {showTraits && traits && (
              <div className="flex gap-1 mt-2">
                <TraitBadge label="⚡" value={traits.speedScore} />
                <TraitBadge label="🎯" value={traits.precisionScore} />
                <TraitBadge label="🔥" value={traits.focusScore} />
              </div>
            )}
          </div>
        </div>
        
        {/* Legendary glow indicator */}
        {traits?.legendaryGlow && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-amber-400/50 pointer-events-none"
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

// Small trait indicator
function TraitBadge({ label, value }: { label: string; value: number }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-amber-500/20 text-amber-400';
    if (score >= 60) return 'bg-purple-500/20 text-purple-400';
    if (score >= 40) return 'bg-blue-500/20 text-blue-400';
    return 'bg-slate-500/20 text-slate-400';
  };
  
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-medium',
      getColor(value),
    )}>
      {label} {value}
    </span>
  );
}

// Grid display for collection
export function NFTRarityGrid({ nfts }: { nfts: Array<{
  rarity: NFTRarityTier;
  imageUrl?: string;
  name?: string;
  tokenId?: string;
  traits?: PerformanceTraits;
}> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {nfts.map((nft, i) => (
        <NFTRarityCard 
          key={nft.tokenId || i} 
          {...nft} 
          size="md"
          showTraits
        />
      ))}
    </div>
  );
}

// Preview all rarities (for showcase)
export function RarityShowcase() {
  const rarities: NFTRarityTier[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  
  return (
    <div className="flex flex-wrap gap-4 justify-center p-8">
      {rarities.map((rarity) => (
        <NFTRarityCard
          key={rarity}
          rarity={rarity}
          name={`${rarity} NFT`}
          tokenId={`${rarities.indexOf(rarity) + 1}`}
          size="md"
          traits={{
            speed: 'Swift',
            speedScore: 60 + rarities.indexOf(rarity) * 8,
            precision: 'Precise',
            precisionScore: 60 + rarities.indexOf(rarity) * 8,
            focus: 'Focused',
            focusScore: 60 + rarities.indexOf(rarity) * 8,
            legendaryGlow: rarity === 'Legendary' || rarity === 'Mythic',
            perfectRun: rarity === 'Mythic',
          }}
          showTraits
        />
      ))}
    </div>
  );
}
