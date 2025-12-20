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
// New real animal images
import lionImg from '@/assets/animals/lion.jpg';
import elephantImg from '@/assets/animals/elephant.jpg';
import giraffeImg from '@/assets/animals/giraffe.jpg';
import zebraImg from '@/assets/animals/zebra.jpg';
import monkeyImg from '@/assets/animals/monkey.jpg';
import gorillaImg from '@/assets/animals/gorilla.jpg';
import hippoImg from '@/assets/animals/hippo.jpg';
import rhinoImg from '@/assets/animals/rhino.jpg';
import bearImg from '@/assets/animals/bear.jpg';
import wolfImg from '@/assets/animals/wolf.jpg';
import rabbitImg from '@/assets/animals/rabbit.jpg';
import hamsterImg from '@/assets/animals/hamster.jpg';
import frogImg from '@/assets/animals/frog.jpg';
import turtleImg from '@/assets/animals/turtle.jpg';
import whaleImg from '@/assets/animals/whale.jpg';
import butterflyImg from '@/assets/animals/butterfly.jpg';

export interface AnimalData {
  id: string;
  name: string;
  image: string;
}

// 37 animals with real image files (enough for 9x9 grid = 40 pairs needed)
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
  // New real images
  { id: 'lion', name: 'Lion', image: lionImg },
  { id: 'elephant', name: 'Elephant', image: elephantImg },
  { id: 'giraffe', name: 'Giraffe', image: giraffeImg },
  { id: 'zebra', name: 'Zebra', image: zebraImg },
  { id: 'monkey', name: 'Monkey', image: monkeyImg },
  { id: 'gorilla', name: 'Gorilla', image: gorillaImg },
  { id: 'hippo', name: 'Hippo', image: hippoImg },
  { id: 'rhino', name: 'Rhino', image: rhinoImg },
  { id: 'bear', name: 'Bear', image: bearImg },
  { id: 'wolf', name: 'Wolf', image: wolfImg },
  { id: 'rabbit', name: 'Rabbit', image: rabbitImg },
  { id: 'hamster', name: 'Hamster', image: hamsterImg },
  { id: 'frog', name: 'Frog', image: frogImg },
  { id: 'turtle', name: 'Turtle', image: turtleImg },
  { id: 'whale', name: 'Whale', image: whaleImg },
  { id: 'butterfly', name: 'Butterfly', image: butterflyImg },
];

// Additional animals using emoji placeholders (for extra large grids if needed)
const EMOJI_ANIMALS: AnimalData[] = [
  { id: 'octopus', name: 'Octopus', image: 'emoji:🐙' },
  { id: 'shark', name: 'Shark', image: 'emoji:🦈' },
  { id: 'fish', name: 'Fish', image: 'emoji:🐠' },
  { id: 'bee', name: 'Bee', image: 'emoji:🐝' },
  { id: 'ladybug', name: 'Ladybug', image: 'emoji:🐞' },
  { id: 'snail', name: 'Snail', image: 'emoji:🐌' },
  { id: 'crab', name: 'Crab', image: 'emoji:🦀' },
  { id: 'peacock', name: 'Peacock', image: 'emoji:🦚' },
  { id: 'flamingo', name: 'Flamingo', image: 'emoji:🦩' },
  { id: 'duck', name: 'Duck', image: 'emoji:🦆' },
  { id: 'bat', name: 'Bat', image: 'emoji:🦇' },
  { id: 'hedgehog', name: 'Hedgehog', image: 'emoji:🦔' },
  { id: 'kangaroo', name: 'Kangaroo', image: 'emoji:🦘' },
];

// Combined animals: 37 real images + 13 emoji fallbacks = 50 total
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
