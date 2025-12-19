// Animal card data with images
// Extended collection to support 9×9 grids (40+ unique pairs needed)
import calfImg from '@/assets/animals/calf.jpg';
import puppyImg from '@/assets/animals/puppy.jpg';
import ducklingImg from '@/assets/animals/duckling.jpg';
import chickImg from '@/assets/animals/chick.jpg';
import catImg from '@/assets/animals/cat.jpg';
import lambImg from '@/assets/animals/lamb.jpg';
import piggyImg from '@/assets/animals/piggy.jpg';
import parrotImg from '@/assets/animals/parrot.jpg';
import swanImg from '@/assets/animals/swan.jpg';
import owlImg from '@/assets/animals/owl.jpg';
import polarbearImg from '@/assets/animals/polarbear.jpg';
import sealImg from '@/assets/animals/seal.jpg';
import squirrelImg from '@/assets/animals/squirrel.jpg';
import tigerImg from '@/assets/animals/tiger.jpg';
import leopardImg from '@/assets/animals/leopard.jpg';
import deerImg from '@/assets/animals/deer.jpg';
import foxImg from '@/assets/animals/fox.jpg';
import pandaImg from '@/assets/animals/panda.jpg';
import dolphinImg from '@/assets/animals/dolphin.jpg';
import koalaImg from '@/assets/animals/koala.jpg';
import penguinImg from '@/assets/animals/penguin.jpg';

export interface AnimalData {
  id: string;
  name: string;
  image: string;
}

// 21 animals from actual image files
const ANIMALS_FROM_FILES: AnimalData[] = [
  { id: 'cat', name: 'Cat', image: catImg },
  { id: 'calf', name: 'Calf', image: calfImg },
  { id: 'lamb', name: 'Lamb', image: lambImg },
  { id: 'polarbear', name: 'Polar Bear', image: polarbearImg },
  { id: 'seal', name: 'Seal', image: sealImg },
  { id: 'duckling', name: 'Duckling', image: ducklingImg },
  { id: 'chick', name: 'Chick', image: chickImg },
  { id: 'swan', name: 'Swan', image: swanImg },
  { id: 'puppy', name: 'Puppy', image: puppyImg },
  { id: 'owl', name: 'Owl', image: owlImg },
  { id: 'parrot', name: 'Parrot', image: parrotImg },
  { id: 'penguin', name: 'Penguin', image: penguinImg },
  { id: 'piggy', name: 'Piggy', image: piggyImg },
  { id: 'squirrel', name: 'Squirrel', image: squirrelImg },
  { id: 'tiger', name: 'Tiger', image: tigerImg },
  { id: 'leopard', name: 'Leopard', image: leopardImg },
  { id: 'deer', name: 'Deer', image: deerImg },
  { id: 'fox', name: 'Fox', image: foxImg },
  { id: 'panda', name: 'Panda', image: pandaImg },
  { id: 'dolphin', name: 'Dolphin', image: dolphinImg },
  { id: 'koala', name: 'Koala', image: koalaImg },
];

// Additional animals using emoji placeholders (for larger grids)
// These use generated colored patterns with emoji overlay
const EMOJI_ANIMALS: AnimalData[] = [
  { id: 'lion', name: 'Lion', image: 'emoji:🦁' },
  { id: 'elephant', name: 'Elephant', image: 'emoji:🐘' },
  { id: 'giraffe', name: 'Giraffe', image: 'emoji:🦒' },
  { id: 'zebra', name: 'Zebra', image: 'emoji:🦓' },
  { id: 'monkey', name: 'Monkey', image: 'emoji:🐒' },
  { id: 'gorilla', name: 'Gorilla', image: 'emoji:🦍' },
  { id: 'hippo', name: 'Hippo', image: 'emoji:🦛' },
  { id: 'rhino', name: 'Rhino', image: 'emoji:🦏' },
  { id: 'bear', name: 'Bear', image: 'emoji:🐻' },
  { id: 'wolf', name: 'Wolf', image: 'emoji:🐺' },
  { id: 'rabbit', name: 'Rabbit', image: 'emoji:🐰' },
  { id: 'hamster', name: 'Hamster', image: 'emoji:🐹' },
  { id: 'mouse', name: 'Mouse', image: 'emoji:🐭' },
  { id: 'cow', name: 'Cow', image: 'emoji:🐮' },
  { id: 'pig', name: 'Pig', image: 'emoji:🐷' },
  { id: 'frog', name: 'Frog', image: 'emoji:🐸' },
  { id: 'turtle', name: 'Turtle', image: 'emoji:🐢' },
  { id: 'snake', name: 'Snake', image: 'emoji:🐍' },
  { id: 'dragon', name: 'Dragon', image: 'emoji:🐉' },
  { id: 'unicorn', name: 'Unicorn', image: 'emoji:🦄' },
  { id: 'horse', name: 'Horse', image: 'emoji:🐴' },
  { id: 'octopus', name: 'Octopus', image: 'emoji:🐙' },
  { id: 'whale', name: 'Whale', image: 'emoji:🐋' },
  { id: 'shark', name: 'Shark', image: 'emoji:🦈' },
  { id: 'fish', name: 'Fish', image: 'emoji:🐠' },
  { id: 'butterfly', name: 'Butterfly', image: 'emoji:🦋' },
  { id: 'bee', name: 'Bee', image: 'emoji:🐝' },
  { id: 'ladybug', name: 'Ladybug', image: 'emoji:🐞' },
  { id: 'snail', name: 'Snail', image: 'emoji:🐌' },
  { id: 'crab', name: 'Crab', image: 'emoji:🦀' },
  { id: 'lobster', name: 'Lobster', image: 'emoji:🦞' },
  { id: 'shrimp', name: 'Shrimp', image: 'emoji:🦐' },
  { id: 'peacock', name: 'Peacock', image: 'emoji:🦚' },
  { id: 'flamingo', name: 'Flamingo', image: 'emoji:🦩' },
  { id: 'eagle', name: 'Eagle', image: 'emoji:🦅' },
  { id: 'dove', name: 'Dove', image: 'emoji:🕊️' },
  { id: 'duck', name: 'Duck', image: 'emoji:🦆' },
  { id: 'bat', name: 'Bat', image: 'emoji:🦇' },
  { id: 'hedgehog', name: 'Hedgehog', image: 'emoji:🦔' },
  { id: 'sloth', name: 'Sloth', image: 'emoji:🦥' },
  { id: 'otter', name: 'Otter', image: 'emoji:🦦' },
  { id: 'badger', name: 'Badger', image: 'emoji:🦡' },
  { id: 'kangaroo', name: 'Kangaroo', image: 'emoji:🦘' },
  { id: 'llama', name: 'Llama', image: 'emoji:🦙' },
  { id: 'camel', name: 'Camel', image: 'emoji:🐫' },
];

// Combined animals: prioritize real images, supplement with emojis
// Total: 21 + 44 = 65 animals (supports up to 9×9 = 81 cards = 40 pairs)
export const ANIMALS: AnimalData[] = [...ANIMALS_FROM_FILES, ...EMOJI_ANIMALS];

// Helper to check if image is emoji type
export function isEmojiAnimal(image: string): boolean {
  return image.startsWith('emoji:');
}

// Get emoji from emoji animal image
export function getEmoji(image: string): string {
  return image.replace('emoji:', '');
}

// Get the number of available unique animals
export function getAvailableAnimalCount(): number {
  return ANIMALS.length;
}

// Check if we have enough animals for a given grid size
export function hasEnoughAnimals(gridSize: number, rows?: number): boolean {
  const cols = gridSize;
  const actualRows = rows || gridSize;
  const pairsNeeded = (cols * actualRows) / 2;
  return ANIMALS.length >= pairsNeeded;
}

export type Difficulty = '2x2' | '4x4' | '6x6';

export const DIFFICULTY_CONFIG: Record<Difficulty, { gridSize: number; time: number; label: string; description: string }> = {
  '2x2': { gridSize: 2, time: 30, label: 'Easy', description: '2 pairs • 30 seconds' },
  '4x4': { gridSize: 4, time: 120, label: 'Normal', description: '8 pairs • 2 minutes' },
  '6x6': { gridSize: 6, time: 180, label: 'Hard', description: '18 pairs • 3 minutes' },
};
