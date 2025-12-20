// Animal card data - using sprite sheet from official source
// Mammals, birds, reptiles, fish, amphibians only - NO INSECTS

import animalSprite from '@/assets/animals/animal-sprite.jpg';

export interface AnimalData {
  id: string;
  name: string;
  image: string;
  spritePosition: { row: number; col: number };
}

// Sprite sheet configuration - 10 columns × 13 rows = 130 cells
export const SPRITE_COLS = 10;
export const SPRITE_ROWS = 13;
export const SPRITE_IMAGE = animalSprite;

// All 130 unique animals from the sprite sheet (10×13 grid)
// NO INSECTS - mammals, birds, reptiles, fish, amphibians only
export const ANIMALS: AnimalData[] = [
  // Row 0
  { id: 'lion', name: 'Lion', image: animalSprite, spritePosition: { row: 0, col: 0 } },
  { id: 'giraffe', name: 'Giraffe', image: animalSprite, spritePosition: { row: 0, col: 1 } },
  { id: 'brown_bear', name: 'Brown Bear', image: animalSprite, spritePosition: { row: 0, col: 2 } },
  { id: 'zebra', name: 'Zebra', image: animalSprite, spritePosition: { row: 0, col: 3 } },
  { id: 'tiger', name: 'Tiger', image: animalSprite, spritePosition: { row: 0, col: 4 } },
  { id: 'bengal_tiger', name: 'Bengal Tiger', image: animalSprite, spritePosition: { row: 0, col: 5 } },
  { id: 'cougar', name: 'Cougar', image: animalSprite, spritePosition: { row: 0, col: 6 } },
  { id: 'wolverine', name: 'Wolverine', image: animalSprite, spritePosition: { row: 0, col: 7 } },
  { id: 'honey_badger', name: 'Honey Badger', image: animalSprite, spritePosition: { row: 0, col: 8 } },
  { id: 'black_bear', name: 'Black Bear', image: animalSprite, spritePosition: { row: 0, col: 9 } },

  // Row 1
  { id: 'giraffe_calf', name: 'Giraffe Calf', image: animalSprite, spritePosition: { row: 1, col: 0 } },
  { id: 'elephant', name: 'Elephant', image: animalSprite, spritePosition: { row: 1, col: 1 } },
  { id: 'mountain_zebra', name: 'Mountain Zebra', image: animalSprite, spritePosition: { row: 1, col: 2 } },
  { id: 'red_fox', name: 'Red Fox', image: animalSprite, spritePosition: { row: 1, col: 3 } },
  { id: 'kangaroo', name: 'Kangaroo', image: animalSprite, spritePosition: { row: 1, col: 4 } },
  { id: 'koala', name: 'Koala', image: animalSprite, spritePosition: { row: 1, col: 5 } },
  { id: 'deer', name: 'Deer', image: animalSprite, spritePosition: { row: 1, col: 6 } },
  { id: 'mountain_lion', name: 'Mountain Lion', image: animalSprite, spritePosition: { row: 1, col: 7 } },
  { id: 'lynx', name: 'Lynx', image: animalSprite, spritePosition: { row: 1, col: 8 } },
  { id: 'bobcat', name: 'Bobcat', image: animalSprite, spritePosition: { row: 1, col: 9 } },

  // Row 2
  { id: 'gray_wolf', name: 'Gray Wolf', image: animalSprite, spritePosition: { row: 2, col: 0 } },
  { id: 'coyote', name: 'Coyote', image: animalSprite, spritePosition: { row: 2, col: 1 } },
  { id: 'dingo', name: 'Dingo', image: animalSprite, spritePosition: { row: 2, col: 2 } },
  { id: 'jackal', name: 'Jackal', image: animalSprite, spritePosition: { row: 2, col: 3 } },
  { id: 'wild_dog', name: 'Wild Dog', image: animalSprite, spritePosition: { row: 2, col: 4 } },
  { id: 'arctic_wolf', name: 'Arctic Wolf', image: animalSprite, spritePosition: { row: 2, col: 5 } },
  { id: 'hyena', name: 'Hyena', image: animalSprite, spritePosition: { row: 2, col: 6 } },
  { id: 'maned_wolf', name: 'Maned Wolf', image: animalSprite, spritePosition: { row: 2, col: 7 } },
  { id: 'dhole', name: 'Dhole', image: animalSprite, spritePosition: { row: 2, col: 8 } },
  { id: 'bush_dog', name: 'Bush Dog', image: animalSprite, spritePosition: { row: 2, col: 9 } },

  // Row 3
  { id: 'flamingo', name: 'Flamingo', image: animalSprite, spritePosition: { row: 3, col: 0 } },
  { id: 'fennec_fox', name: 'Fennec Fox', image: animalSprite, spritePosition: { row: 3, col: 1 } },
  { id: 'german_shepherd', name: 'German Shepherd', image: animalSprite, spritePosition: { row: 3, col: 2 } },
  { id: 'grizzly_bear', name: 'Grizzly Bear', image: animalSprite, spritePosition: { row: 3, col: 3 } },
  { id: 'kodiak_bear', name: 'Kodiak Bear', image: animalSprite, spritePosition: { row: 3, col: 4 } },
  { id: 'border_collie', name: 'Border Collie', image: animalSprite, spritePosition: { row: 3, col: 5 } },
  { id: 'belgian_shepherd', name: 'Belgian Shepherd', image: animalSprite, spritePosition: { row: 3, col: 6 } },
  { id: 'crow', name: 'Crow', image: animalSprite, spritePosition: { row: 3, col: 7 } },
  { id: 'raven', name: 'Raven', image: animalSprite, spritePosition: { row: 3, col: 8 } },
  { id: 'magpie', name: 'Magpie', image: animalSprite, spritePosition: { row: 3, col: 9 } },

  // Row 4
  { id: 'leopard', name: 'Leopard', image: animalSprite, spritePosition: { row: 4, col: 0 } },
  { id: 'blue_lizard', name: 'Blue Lizard', image: animalSprite, spritePosition: { row: 4, col: 1 } },
  { id: 'snake', name: 'Snake', image: animalSprite, spritePosition: { row: 4, col: 2 } },
  { id: 'kit_fox', name: 'Kit Fox', image: animalSprite, spritePosition: { row: 4, col: 3 } },
  { id: 'swift_fox', name: 'Swift Fox', image: animalSprite, spritePosition: { row: 4, col: 4 } },
  { id: 'puppy', name: 'Puppy', image: animalSprite, spritePosition: { row: 4, col: 5 } },
  { id: 'platypus', name: 'Platypus', image: animalSprite, spritePosition: { row: 4, col: 6 } },
  { id: 'crocodile', name: 'Crocodile', image: animalSprite, spritePosition: { row: 4, col: 7 } },
  { id: 'caiman', name: 'Caiman', image: animalSprite, spritePosition: { row: 4, col: 8 } },
  { id: 'gharial', name: 'Gharial', image: animalSprite, spritePosition: { row: 4, col: 9 } },

  // Row 5
  { id: 'alligator', name: 'Alligator', image: animalSprite, spritePosition: { row: 5, col: 0 } },
  { id: 'panda', name: 'Panda', image: animalSprite, spritePosition: { row: 5, col: 1 } },
  { id: 'python', name: 'Python', image: animalSprite, spritePosition: { row: 5, col: 2 } },
  { id: 'meerkat', name: 'Meerkat', image: animalSprite, spritePosition: { row: 5, col: 3 } },
  { id: 'monitor_lizard', name: 'Monitor Lizard', image: animalSprite, spritePosition: { row: 5, col: 4 } },
  { id: 'iguana', name: 'Iguana', image: animalSprite, spritePosition: { row: 5, col: 5 } },
  { id: 'baby_koala', name: 'Baby Koala', image: animalSprite, spritePosition: { row: 5, col: 6 } },
  { id: 'wombat', name: 'Wombat', image: animalSprite, spritePosition: { row: 5, col: 7 } },
  { id: 'tasmanian_devil', name: 'Tasmanian Devil', image: animalSprite, spritePosition: { row: 5, col: 8 } },
  { id: 'numbat', name: 'Numbat', image: animalSprite, spritePosition: { row: 5, col: 9 } },

  // Row 6
  { id: 'red_squirrel', name: 'Red Squirrel', image: animalSprite, spritePosition: { row: 6, col: 0 } },
  { id: 'gray_squirrel', name: 'Gray Squirrel', image: animalSprite, spritePosition: { row: 6, col: 1 } },
  { id: 'cat', name: 'Cat', image: animalSprite, spritePosition: { row: 6, col: 2 } },
  { id: 'viper', name: 'Viper', image: animalSprite, spritePosition: { row: 6, col: 3 } },
  { id: 'saltwater_croc', name: 'Saltwater Croc', image: animalSprite, spritePosition: { row: 6, col: 4 } },
  { id: 'wallaby', name: 'Wallaby', image: animalSprite, spritePosition: { row: 6, col: 5 } },
  { id: 'seal', name: 'Seal', image: animalSprite, spritePosition: { row: 6, col: 6 } },
  { id: 'giant_panda', name: 'Giant Panda', image: animalSprite, spritePosition: { row: 6, col: 7 } },
  { id: 'red_panda', name: 'Red Panda', image: animalSprite, spritePosition: { row: 6, col: 8 } },
  { id: 'sloth', name: 'Sloth', image: animalSprite, spritePosition: { row: 6, col: 9 } },

  // Row 7
  { id: 'chameleon', name: 'Chameleon', image: animalSprite, spritePosition: { row: 7, col: 0 } },
  { id: 'king_penguin', name: 'King Penguin', image: animalSprite, spritePosition: { row: 7, col: 1 } },
  { id: 'sea_turtle', name: 'Sea Turtle', image: animalSprite, spritePosition: { row: 7, col: 2 } },
  { id: 'tortoise', name: 'Tortoise', image: animalSprite, spritePosition: { row: 7, col: 3 } },
  { id: 'eagle', name: 'Eagle', image: animalSprite, spritePosition: { row: 7, col: 4 } },
  { id: 'hawk', name: 'Hawk', image: animalSprite, spritePosition: { row: 7, col: 5 } },
  { id: 'armadillo', name: 'Armadillo', image: animalSprite, spritePosition: { row: 7, col: 6 } },
  { id: 'pink_flamingo', name: 'Pink Flamingo', image: animalSprite, spritePosition: { row: 7, col: 7 } },
  { id: 'stork', name: 'Stork', image: animalSprite, spritePosition: { row: 7, col: 8 } },
  { id: 'heron', name: 'Heron', image: animalSprite, spritePosition: { row: 7, col: 9 } },

  // Row 8
  { id: 'timber_wolf', name: 'Timber Wolf', image: animalSprite, spritePosition: { row: 8, col: 0 } },
  { id: 'australian_dingo', name: 'Australian Dingo', image: animalSprite, spritePosition: { row: 8, col: 1 } },
  { id: 'shark', name: 'Shark', image: animalSprite, spritePosition: { row: 8, col: 2 } },
  { id: 'dolphin', name: 'Dolphin', image: animalSprite, spritePosition: { row: 8, col: 3 } },
  { id: 'eel', name: 'Eel', image: animalSprite, spritePosition: { row: 8, col: 4 } },
  { id: 'emperor_penguin', name: 'Emperor Penguin', image: animalSprite, spritePosition: { row: 8, col: 5 } },
  { id: 'penguin', name: 'Penguin', image: animalSprite, spritePosition: { row: 8, col: 6 } },
  { id: 'husky', name: 'Husky', image: animalSprite, spritePosition: { row: 8, col: 7 } },
  { id: 'malamute', name: 'Malamute', image: animalSprite, spritePosition: { row: 8, col: 8 } },
  { id: 'samoyed', name: 'Samoyed', image: animalSprite, spritePosition: { row: 8, col: 9 } },

  // Row 9
  { id: 'sun_bear', name: 'Sun Bear', image: animalSprite, spritePosition: { row: 9, col: 0 } },
  { id: 'flying_squirrel', name: 'Flying Squirrel', image: animalSprite, spritePosition: { row: 9, col: 1 } },
  { id: 'otter', name: 'Otter', image: animalSprite, spritePosition: { row: 9, col: 2 } },
  { id: 'tropical_fish', name: 'Tropical Fish', image: animalSprite, spritePosition: { row: 9, col: 3 } },
  { id: 'bottlenose_dolphin', name: 'Bottlenose Dolphin', image: animalSprite, spritePosition: { row: 9, col: 4 } },
  { id: 'box_turtle', name: 'Box Turtle', image: animalSprite, spritePosition: { row: 9, col: 5 } },
  { id: 'red_kangaroo', name: 'Red Kangaroo', image: animalSprite, spritePosition: { row: 9, col: 6 } },
  { id: 'red_wolf', name: 'Red Wolf', image: animalSprite, spritePosition: { row: 9, col: 7 } },
  { id: 'ethiopian_wolf', name: 'Ethiopian Wolf', image: animalSprite, spritePosition: { row: 9, col: 8 } },
  { id: 'iberian_lynx', name: 'Iberian Lynx', image: animalSprite, spritePosition: { row: 9, col: 9 } },

  // Row 10
  { id: 'great_white_shark', name: 'Great White Shark', image: animalSprite, spritePosition: { row: 10, col: 0 } },
  { id: 'hammerhead_shark', name: 'Hammerhead Shark', image: animalSprite, spritePosition: { row: 10, col: 1 } },
  { id: 'spotted_turtle', name: 'Spotted Turtle', image: animalSprite, spritePosition: { row: 10, col: 2 } },
  { id: 'painted_turtle', name: 'Painted Turtle', image: animalSprite, spritePosition: { row: 10, col: 3 } },
  { id: 'snapping_turtle', name: 'Snapping Turtle', image: animalSprite, spritePosition: { row: 10, col: 4 } },
  { id: 'bass', name: 'Bass', image: animalSprite, spritePosition: { row: 10, col: 5 } },
  { id: 'toucan', name: 'Toucan', image: animalSprite, spritePosition: { row: 10, col: 6 } },
  { id: 'macaw', name: 'Macaw', image: animalSprite, spritePosition: { row: 10, col: 7 } },
  { id: 'parrot', name: 'Parrot', image: animalSprite, spritePosition: { row: 10, col: 8 } },
  { id: 'cockatoo', name: 'Cockatoo', image: animalSprite, spritePosition: { row: 10, col: 9 } },

  // Row 11
  { id: 'lionfish', name: 'Lionfish', image: animalSprite, spritePosition: { row: 11, col: 0 } },
  { id: 'arctic_fox', name: 'Arctic Fox', image: animalSprite, spritePosition: { row: 11, col: 1 } },
  { id: 'corsac_fox', name: 'Corsac Fox', image: animalSprite, spritePosition: { row: 11, col: 2 } },
  { id: 'silver_fox', name: 'Silver Fox', image: animalSprite, spritePosition: { row: 11, col: 3 } },
  { id: 'river_dolphin', name: 'River Dolphin', image: animalSprite, spritePosition: { row: 11, col: 4 } },
  { id: 'falcon', name: 'Falcon', image: animalSprite, spritePosition: { row: 11, col: 5 } },
  { id: 'quail', name: 'Quail', image: animalSprite, spritePosition: { row: 11, col: 6 } },
  { id: 'peacock', name: 'Peacock', image: animalSprite, spritePosition: { row: 11, col: 7 } },
  { id: 'pheasant', name: 'Pheasant', image: animalSprite, spritePosition: { row: 11, col: 8 } },
  { id: 'turkey', name: 'Turkey', image: animalSprite, spritePosition: { row: 11, col: 9 } },

  // Row 12
  { id: 'owl', name: 'Owl', image: animalSprite, spritePosition: { row: 12, col: 0 } },
  { id: 'perch', name: 'Perch', image: animalSprite, spritePosition: { row: 12, col: 1 } },
  { id: 'lioness', name: 'Lioness', image: animalSprite, spritePosition: { row: 12, col: 2 } },
  { id: 'adelie_penguin', name: 'Adelie Penguin', image: animalSprite, spritePosition: { row: 12, col: 3 } },
  { id: 'hornbill', name: 'Hornbill', image: animalSprite, spritePosition: { row: 12, col: 4 } },
  { id: 'indian_peacock', name: 'Indian Peacock', image: animalSprite, spritePosition: { row: 12, col: 5 } },
  { id: 'green_peacock', name: 'Green Peacock', image: animalSprite, spritePosition: { row: 12, col: 6 } },
  { id: 'snowy_owl', name: 'Snowy Owl', image: animalSprite, spritePosition: { row: 12, col: 7 } },
  { id: 'barn_owl', name: 'Barn Owl', image: animalSprite, spritePosition: { row: 12, col: 8 } },
  { id: 'great_horned_owl', name: 'Great Horned Owl', image: animalSprite, spritePosition: { row: 12, col: 9 } },
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
