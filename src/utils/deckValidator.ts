import { ANIMALS, AnimalData } from '@/data/animals';

export interface CardData {
  id: number;
  animalId: string;
  animalName: string;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  cards: CardData[];
}

/**
 * Fisher-Yates shuffle algorithm for truly random shuffling
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Creates a validated deck of cards for the memory game.
 * Ensures exactly 2 cards per animal with no duplicates or missing pairs.
 */
export function createValidatedDeck(gridSize: number): ValidationResult {
  const errors: string[] = [];
  const totalCards = gridSize * gridSize;
  const pairsNeeded = totalCards / 2;

  // Validation: total cards must be even
  if (totalCards % 2 !== 0) {
    errors.push(`Invalid grid size: ${gridSize}x${gridSize} produces odd number of cards (${totalCards})`);
    return { isValid: false, errors, cards: [] };
  }

  // Validation: we must have enough unique animals
  if (pairsNeeded > ANIMALS.length) {
    errors.push(`Not enough unique animals: need ${pairsNeeded} pairs but only have ${ANIMALS.length} animals`);
    return { isValid: false, errors, cards: [] };
  }

  // Get unique animals only (filter by unique id)
  const uniqueAnimals = ANIMALS.filter((animal, index, self) => 
    self.findIndex(a => a.id === animal.id) === index
  );

  // Shuffle and select the required number of unique animals
  const shuffledAnimals = shuffleArray(uniqueAnimals);
  const selectedAnimals = shuffledAnimals.slice(0, pairsNeeded);

  // Create exactly 2 cards per animal
  const cards: CardData[] = [];
  let cardId = 0;

  selectedAnimals.forEach((animal: AnimalData) => {
    // First card of pair
    cards.push({
      id: cardId++,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
    // Second card of pair (exact match)
    cards.push({
      id: cardId++,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
  });

  // Shuffle the final deck
  const shuffledCards = shuffleArray(cards).map((card, index) => ({
    ...card,
    id: index, // Reassign IDs after shuffle
  }));

  // Final validation
  const validationResult = validateDeck(shuffledCards, pairsNeeded);
  
  if (!validationResult.isValid) {
    return { isValid: false, errors: validationResult.errors, cards: [] };
  }

  return { isValid: true, errors: [], cards: shuffledCards };
}

/**
 * Validates a deck to ensure it meets all game requirements.
 */
export function validateDeck(cards: CardData[], expectedPairs: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check total card count
  if (cards.length !== expectedPairs * 2) {
    errors.push(`Invalid card count: expected ${expectedPairs * 2}, got ${cards.length}`);
  }

  // Count cards per animal
  const animalCounts: Record<string, number> = {};
  cards.forEach(card => {
    animalCounts[card.animalId] = (animalCounts[card.animalId] || 0) + 1;
  });

  // Validate each animal appears exactly twice
  Object.entries(animalCounts).forEach(([animalId, count]) => {
    if (count !== 2) {
      errors.push(`Animal "${animalId}" appears ${count} times (should be exactly 2)`);
    }
  });

  // Validate correct number of unique animals
  const uniqueAnimalCount = Object.keys(animalCounts).length;
  if (uniqueAnimalCount !== expectedPairs) {
    errors.push(`Expected ${expectedPairs} unique animals, got ${uniqueAnimalCount}`);
  }

  // Check for duplicate card IDs
  const cardIds = cards.map(c => c.id);
  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== cardIds.length) {
    errors.push('Duplicate card IDs detected');
  }

  // Check all cards have valid image URLs
  const missingImages = cards.filter(c => !c.imageUrl);
  if (missingImages.length > 0) {
    errors.push(`${missingImages.length} cards missing image URLs`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Auto-corrects a deck if validation fails.
 * Returns a fresh, valid deck.
 */
export function autoCorrectDeck(gridSize: number): CardData[] {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    const result = createValidatedDeck(gridSize);
    if (result.isValid) {
      console.log(`Deck created successfully on attempt ${attempts + 1}`);
      return result.cards;
    }
    console.warn(`Deck validation failed (attempt ${attempts + 1}):`, result.errors);
    attempts++;
  }

  // Fallback: create a minimal valid deck
  console.error('Failed to create valid deck after max attempts, using fallback');
  return createValidatedDeck(Math.min(gridSize, 4)).cards;
}
