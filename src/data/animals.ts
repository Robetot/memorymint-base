// Animal card data - using sprite sheet from official source
// Mammals, birds, reptiles, fish, amphibians only - NO INSECTS

import animalSprite from '@/assets/animals/animal-sprite.jpg';

export interface AnimalData {
  id: string;
  name: string;
  image: string;
  spritePosition: { row: number; col: number };
}


// Sprite sheet configuration
// The image has 10 columns × 13 rows of animals
export const SPRITE_COLS = 10;
export const SPRITE_ROWS = 13;
export const SPRITE_IMAGE = animalSprite;

// 90 unique animals from the sprite sheet (10×11 grid, minus some empty spaces)
// NO INSECTS - mammals, birds, reptiles, fish, amphibians only
export const ANIMALS: AnimalData[] = [
  // Row 0
  { id: 'lion', name: 'Lion', image: animalSprite, spritePosition: { row: 0, col: 0 } },
  { id: 'giraffe', name: 'Giraffe', image: animalSprite, spritePosition: { row: 0, col: 1 } },
  { id: 'bear', name: 'Brown Bear', image: animalSprite, spritePosition: { row: 0, col: 2 } },
  { id: 'zebra', name: 'Zebra', image: animalSprite, spritePosition: { row: 0, col: 3 } },
  { id: 'tiger1', name: 'Tiger', image: animalSprite, spritePosition: { row: 0, col: 4 } },
  { id: 'tiger2', name: 'Siberian Tiger', image: animalSprite, spritePosition: { row: 0, col: 5 } },
  { id: 'wolf1', name: 'Wolf', image: animalSprite, spritePosition: { row: 0, col: 6 } },
  { id: 'bear2', name: 'Black Bear', image: animalSprite, spritePosition: { row: 0, col: 7 } },
  
  // Row 1
  { id: 'giraffe2', name: 'Giraffe Calf', image: animalSprite, spritePosition: { row: 1, col: 0 } },
  { id: 'elephant', name: 'Elephant', image: animalSprite, spritePosition: { row: 1, col: 1 } },
  { id: 'zebra2', name: 'Mountain Zebra', image: animalSprite, spritePosition: { row: 1, col: 2 } },
  { id: 'fox', name: 'Fox', image: animalSprite, spritePosition: { row: 1, col: 3 } },
  { id: 'kangaroo', name: 'Kangaroo', image: animalSprite, spritePosition: { row: 1, col: 4 } },
  { id: 'koala', name: 'Koala', image: animalSprite, spritePosition: { row: 1, col: 5 } },
  { id: 'deer', name: 'Deer', image: animalSprite, spritePosition: { row: 1, col: 6 } },
  { id: 'cougar', name: 'Cougar', image: animalSprite, spritePosition: { row: 1, col: 7 } },
  
  // Row 2
  { id: 'wolf2', name: 'Gray Wolf', image: animalSprite, spritePosition: { row: 2, col: 0 } },
  { id: 'coyote', name: 'Coyote', image: animalSprite, spritePosition: { row: 2, col: 1 } },
  { id: 'dingo', name: 'Dingo', image: animalSprite, spritePosition: { row: 2, col: 2 } },
  { id: 'fox2', name: 'Red Fox', image: animalSprite, spritePosition: { row: 2, col: 3 } },
  { id: 'dog1', name: 'Dog', image: animalSprite, spritePosition: { row: 2, col: 4 } },
  { id: 'wolf3', name: 'Arctic Wolf', image: animalSprite, spritePosition: { row: 2, col: 5 } },
  
  // Row 3
  { id: 'flamingo', name: 'Flamingo', image: animalSprite, spritePosition: { row: 3, col: 0 } },
  { id: 'coyote2', name: 'Prairie Coyote', image: animalSprite, spritePosition: { row: 3, col: 1 } },
  { id: 'dog2', name: 'Shepherd', image: animalSprite, spritePosition: { row: 3, col: 2 } },
  { id: 'bear3', name: 'Grizzly Bear', image: animalSprite, spritePosition: { row: 3, col: 3 } },
  { id: 'bear4', name: 'Kodiak Bear', image: animalSprite, spritePosition: { row: 3, col: 4 } },
  { id: 'collie', name: 'Collie', image: animalSprite, spritePosition: { row: 3, col: 5 } },
  { id: 'shepherd', name: 'German Shepherd', image: animalSprite, spritePosition: { row: 3, col: 6 } },
  { id: 'crow', name: 'Crow', image: animalSprite, spritePosition: { row: 3, col: 7 } },
  
  // Row 4
  { id: 'leopard', name: 'Leopard', image: animalSprite, spritePosition: { row: 4, col: 0 } },
  { id: 'lizard1', name: 'Blue Lizard', image: animalSprite, spritePosition: { row: 4, col: 1 } },
  { id: 'snake1', name: 'Snake', image: animalSprite, spritePosition: { row: 4, col: 2 } },
  { id: 'fox3', name: 'Kit Fox', image: animalSprite, spritePosition: { row: 4, col: 3 } },
  { id: 'fox4', name: 'Fennec Fox', image: animalSprite, spritePosition: { row: 4, col: 4 } },
  { id: 'puppy', name: 'Puppy', image: animalSprite, spritePosition: { row: 4, col: 5 } },
  { id: 'platypus', name: 'Platypus', image: animalSprite, spritePosition: { row: 4, col: 6 } },
  { id: 'crocodile', name: 'Crocodile', image: animalSprite, spritePosition: { row: 4, col: 7 } },
  
  // Row 5
  { id: 'alligator', name: 'Alligator', image: animalSprite, spritePosition: { row: 5, col: 0 } },
  { id: 'panda', name: 'Panda', image: animalSprite, spritePosition: { row: 5, col: 1 } },
  { id: 'python', name: 'Python', image: animalSprite, spritePosition: { row: 5, col: 2 } },
  { id: 'meerkat', name: 'Meerkat', image: animalSprite, spritePosition: { row: 5, col: 3 } },
  { id: 'lizard2', name: 'Gecko', image: animalSprite, spritePosition: { row: 5, col: 4 } },
  { id: 'iguana', name: 'Iguana', image: animalSprite, spritePosition: { row: 5, col: 5 } },
  { id: 'koala2', name: 'Baby Koala', image: animalSprite, spritePosition: { row: 5, col: 6 } },
  
  // Row 6
  { id: 'squirrel1', name: 'Red Squirrel', image: animalSprite, spritePosition: { row: 6, col: 0 } },
  { id: 'squirrel2', name: 'Gray Squirrel', image: animalSprite, spritePosition: { row: 6, col: 1 } },
  { id: 'cat', name: 'Cat', image: animalSprite, spritePosition: { row: 6, col: 2 } },
  { id: 'snake2', name: 'Viper', image: animalSprite, spritePosition: { row: 6, col: 3 } },
  { id: 'croc2', name: 'Gharial', image: animalSprite, spritePosition: { row: 6, col: 4 } },
  { id: 'kangaroo2', name: 'Wallaby', image: animalSprite, spritePosition: { row: 6, col: 5 } },
  { id: 'seal', name: 'Seal', image: animalSprite, spritePosition: { row: 6, col: 6 } },
  { id: 'panda2', name: 'Giant Panda', image: animalSprite, spritePosition: { row: 6, col: 7 } },
  
  // Row 7
  { id: 'chameleon', name: 'Chameleon', image: animalSprite, spritePosition: { row: 7, col: 0 } },
  { id: 'penguin', name: 'King Penguin', image: animalSprite, spritePosition: { row: 7, col: 1 } },
  { id: 'turtle1', name: 'Sea Turtle', image: animalSprite, spritePosition: { row: 7, col: 2 } },
  { id: 'turtle2', name: 'Tortoise', image: animalSprite, spritePosition: { row: 7, col: 3 } },
  { id: 'eagle', name: 'Eagle', image: animalSprite, spritePosition: { row: 7, col: 4 } },
  { id: 'hawk', name: 'Hawk', image: animalSprite, spritePosition: { row: 7, col: 5 } },
  { id: 'armadillo', name: 'Armadillo', image: animalSprite, spritePosition: { row: 7, col: 6 } },
  { id: 'flamingo2', name: 'Pink Flamingo', image: animalSprite, spritePosition: { row: 7, col: 7 } },
  
  // Row 8
  { id: 'wolf4', name: 'Timber Wolf', image: animalSprite, spritePosition: { row: 8, col: 0 } },
  { id: 'dingo2', name: 'Australian Dingo', image: animalSprite, spritePosition: { row: 8, col: 1 } },
  { id: 'shark', name: 'Shark', image: animalSprite, spritePosition: { row: 8, col: 2 } },
  { id: 'dolphin', name: 'Dolphin', image: animalSprite, spritePosition: { row: 8, col: 3 } },
  { id: 'eel', name: 'Eel', image: animalSprite, spritePosition: { row: 8, col: 4 } },
  { id: 'fish1', name: 'Blue Fish', image: animalSprite, spritePosition: { row: 8, col: 5 } },
  { id: 'penguin2', name: 'Emperor Penguin', image: animalSprite, spritePosition: { row: 8, col: 6 } },
  { id: 'dog3', name: 'Husky', image: animalSprite, spritePosition: { row: 8, col: 7 } },
  
  // Row 9
  { id: 'bear5', name: 'Sun Bear', image: animalSprite, spritePosition: { row: 9, col: 0 } },
  { id: 'fish2', name: 'Koi Fish', image: animalSprite, spritePosition: { row: 9, col: 1 } },
  { id: 'squirrel3', name: 'Flying Squirrel', image: animalSprite, spritePosition: { row: 9, col: 2 } },
  { id: 'fish3', name: 'Tropical Fish', image: animalSprite, spritePosition: { row: 9, col: 3 } },
  { id: 'dolphin2', name: 'Bottlenose Dolphin', image: animalSprite, spritePosition: { row: 9, col: 4 } },
  { id: 'turtle3', name: 'Box Turtle', image: animalSprite, spritePosition: { row: 9, col: 5 } },
  { id: 'kangaroo3', name: 'Red Kangaroo', image: animalSprite, spritePosition: { row: 9, col: 6 } },
  { id: 'wolf5', name: 'Red Wolf', image: animalSprite, spritePosition: { row: 9, col: 7 } },
  
  // Row 10
  { id: 'shark2', name: 'Great White Shark', image: animalSprite, spritePosition: { row: 10, col: 0 } },
  { id: 'turtle4', name: 'Painted Turtle', image: animalSprite, spritePosition: { row: 10, col: 1 } },
  { id: 'frog', name: 'Tree Frog', image: animalSprite, spritePosition: { row: 10, col: 2 } },
  { id: 'fish4', name: 'Bass', image: animalSprite, spritePosition: { row: 10, col: 3 } },
  { id: 'turtle5', name: 'Snapping Turtle', image: animalSprite, spritePosition: { row: 10, col: 4 } },
  { id: 'toucan', name: 'Toucan', image: animalSprite, spritePosition: { row: 10, col: 5 } },
  { id: 'peacock', name: 'Peacock', image: animalSprite, spritePosition: { row: 10, col: 6 } },
  
  // Row 11
  { id: 'frog2', name: 'Poison Frog', image: animalSprite, spritePosition: { row: 11, col: 0 } },
  { id: 'fox5', name: 'Arctic Fox', image: animalSprite, spritePosition: { row: 11, col: 1 } },
  { id: 'otter', name: 'Sea Otter', image: animalSprite, spritePosition: { row: 11, col: 2 } },
  { id: 'dolphin3', name: 'River Dolphin', image: animalSprite, spritePosition: { row: 11, col: 3 } },
  { id: 'falcon', name: 'Falcon', image: animalSprite, spritePosition: { row: 11, col: 4 } },
  { id: 'peacock2', name: 'Indian Peacock', image: animalSprite, spritePosition: { row: 11, col: 5 } },
  
  // Row 12
  { id: 'owl', name: 'Owl', image: animalSprite, spritePosition: { row: 12, col: 0 } },
  { id: 'fish5', name: 'Perch', image: animalSprite, spritePosition: { row: 12, col: 1 } },
  { id: 'lion2', name: 'Lioness', image: animalSprite, spritePosition: { row: 12, col: 2 } },
  { id: 'penguin3', name: 'Adelie Penguin', image: animalSprite, spritePosition: { row: 12, col: 3 } },
  { id: 'parrot', name: 'Parrot', image: animalSprite, spritePosition: { row: 12, col: 4 } },
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

// Calculate sprite position as percentage for CSS background-position
export function getSpritePosition(animal: AnimalData): { x: string; y: string } {
  const xPercent = (animal.spritePosition.col / (SPRITE_COLS - 1)) * 100;
  const yPercent = (animal.spritePosition.row / (SPRITE_ROWS - 1)) * 100;
  return {
    x: `${xPercent}%`,
    y: `${yPercent}%`,
  };
}

export type Difficulty = '2x2' | '4x4' | '6x6';

export const DIFFICULTY_CONFIG: Record<Difficulty, { gridSize: number; time: number; label: string; description: string }> = {
  '2x2': { gridSize: 2, time: 30, label: 'Easy', description: '2 pairs • 30 seconds' },
  '4x4': { gridSize: 4, time: 120, label: 'Normal', description: '8 pairs • 2 minutes' },
  '6x6': { gridSize: 6, time: 180, label: 'Hard', description: '18 pairs • 3 minutes' },
};
