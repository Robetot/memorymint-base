// Animal card data with images
// Extended collection to support 9×9 grids (40+ unique pairs needed)
// NO INSECTS - Only mammals, birds, reptiles, fish, amphibians

// Mammals
import lionImg from '@/assets/animals/lion.jpg';
import tigerImg from '@/assets/animals/tiger.jpg';
import bearImg from '@/assets/animals/bear.jpg';
import polarbearImg from '@/assets/animals/polarbear.jpg';
import pandaImg from '@/assets/animals/panda.jpg';
import koalaImg from '@/assets/animals/koala.jpg';
import elephantImg from '@/assets/animals/elephant.jpg';
import giraffeImg from '@/assets/animals/giraffe.jpg';
import zebraImg from '@/assets/animals/zebra.jpg';
import rhinoImg from '@/assets/animals/rhino.jpg';
import hippoImg from '@/assets/animals/hippo.jpg';
import kangarooImg from '@/assets/animals/kangaroo.jpg';
import monkeyImg from '@/assets/animals/monkey.jpg';
import gorillaImg from '@/assets/animals/gorilla.jpg';
import foxImg from '@/assets/animals/fox.jpg';
import wolfImg from '@/assets/animals/wolf.jpg';
import deerImg from '@/assets/animals/deer.jpg';
import horseImg from '@/assets/animals/horse.jpg';
import rabbitImg from '@/assets/animals/rabbit.jpg';
import squirrelImg from '@/assets/animals/squirrel.jpg';
import hedgehogImg from '@/assets/animals/hedgehog.jpg';
import hamsterImg from '@/assets/animals/hamster.jpg';
import catImg from '@/assets/animals/cat.jpg';
import puppyImg from '@/assets/animals/puppy.jpg';
import leopardImg from '@/assets/animals/leopard.jpg';
import sealImg from '@/assets/animals/seal.jpg';

// Birds
import owlImg from '@/assets/animals/owl.jpg';
import eagleImg from '@/assets/animals/eagle.jpg';
import parrotImg from '@/assets/animals/parrot.jpg';
import penguinImg from '@/assets/animals/penguin.jpg';
import flamingoImg from '@/assets/animals/flamingo.jpg';
import peacockImg from '@/assets/animals/peacock.jpg';
import swanImg from '@/assets/animals/swan.jpg';
import duckImg from '@/assets/animals/duck.jpg';

// Reptiles & Amphibians
import turtleImg from '@/assets/animals/turtle.jpg';
import frogImg from '@/assets/animals/frog.jpg';

// Marine Life (Fish & Sea Mammals)
import dolphinImg from '@/assets/animals/dolphin.jpg';
import whaleImg from '@/assets/animals/whale.jpg';
import sharkImg from '@/assets/animals/shark.jpg';
import fishImg from '@/assets/animals/fish.jpg';
import octopusImg from '@/assets/animals/octopus.jpg';
import crabImg from '@/assets/animals/crab.jpg';

export interface AnimalData {
  id: string;
  name: string;
  image: string;
}

// 46 unique animals - NO INSECTS (mammals, birds, reptiles, fish, amphibians only)
// Curated for visual distinction and mobile clarity
export const ANIMALS: AnimalData[] = [
  // Big Cats & Carnivores (distinct silhouettes)
  { id: 'lion', name: 'Lion', image: lionImg },
  { id: 'tiger', name: 'Tiger', image: tigerImg },
  { id: 'leopard', name: 'Leopard', image: leopardImg },
  { id: 'wolf', name: 'Wolf', image: wolfImg },
  { id: 'fox', name: 'Fox', image: foxImg },
  
  // Bears (clearly different species)
  { id: 'bear', name: 'Brown Bear', image: bearImg },
  { id: 'polarbear', name: 'Polar Bear', image: polarbearImg },
  { id: 'panda', name: 'Panda', image: pandaImg },
  
  // African Wildlife (iconic, distinct)
  { id: 'elephant', name: 'Elephant', image: elephantImg },
  { id: 'giraffe', name: 'Giraffe', image: giraffeImg },
  { id: 'zebra', name: 'Zebra', image: zebraImg },
  { id: 'rhino', name: 'Rhino', image: rhinoImg },
  { id: 'hippo', name: 'Hippo', image: hippoImg },
  
  // Primates (distinct body shapes)
  { id: 'monkey', name: 'Monkey', image: monkeyImg },
  { id: 'gorilla', name: 'Gorilla', image: gorillaImg },
  
  // Australian & Unique Mammals
  { id: 'kangaroo', name: 'Kangaroo', image: kangarooImg },
  { id: 'koala', name: 'Koala', image: koalaImg },
  
  // Forest Animals
  { id: 'deer', name: 'Deer', image: deerImg },
  { id: 'squirrel', name: 'Squirrel', image: squirrelImg },
  { id: 'hedgehog', name: 'Hedgehog', image: hedgehogImg },
  { id: 'rabbit', name: 'Rabbit', image: rabbitImg },
  
  // Farm & Domestic
  { id: 'horse', name: 'Horse', image: horseImg },
  { id: 'cat', name: 'Cat', image: catImg },
  { id: 'puppy', name: 'Puppy', image: puppyImg },
  { id: 'hamster', name: 'Hamster', image: hamsterImg },
  
  // Marine Mammals
  { id: 'seal', name: 'Seal', image: sealImg },
  { id: 'dolphin', name: 'Dolphin', image: dolphinImg },
  { id: 'whale', name: 'Whale', image: whaleImg },
  
  // Birds (distinct colors/shapes)
  { id: 'owl', name: 'Owl', image: owlImg },
  { id: 'eagle', name: 'Eagle', image: eagleImg },
  { id: 'parrot', name: 'Parrot', image: parrotImg },
  { id: 'penguin', name: 'Penguin', image: penguinImg },
  { id: 'flamingo', name: 'Flamingo', image: flamingoImg },
  { id: 'peacock', name: 'Peacock', image: peacockImg },
  { id: 'swan', name: 'Swan', image: swanImg },
  { id: 'duck', name: 'Duck', image: duckImg },
  
  // Reptiles & Amphibians
  { id: 'turtle', name: 'Turtle', image: turtleImg },
  { id: 'frog', name: 'Frog', image: frogImg },
  
  // Fish & Marine
  { id: 'shark', name: 'Shark', image: sharkImg },
  { id: 'fish', name: 'Tropical Fish', image: fishImg },
  { id: 'octopus', name: 'Octopus', image: octopusImg },
  { id: 'crab', name: 'Crab', image: crabImg },
];

// Helper to check if image is emoji type (legacy support - should always be false now)
export function isEmojiAnimal(image: string): boolean {
  return image.startsWith('emoji:');
}

// Get emoji from emoji animal image (legacy support)
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
