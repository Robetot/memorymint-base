import { lazy, Suspense } from 'react';
import { MemoryGame } from './MemoryGame';

// Keep MemoryBoard for backwards compatibility with NFT mode
const MemoryBoard = lazy(() => import('./MemoryBoard').then(m => ({ default: m.MemoryBoard })));

interface GameSelectorProps {
  onBack?: () => void;
  onPlayClassic?: () => void;
}

export function GameSelector({ onBack, onPlayClassic }: GameSelectorProps) {
  // The new MemoryGame component is standalone and handles everything
  return <MemoryGame onBack={onBack} />;
}
