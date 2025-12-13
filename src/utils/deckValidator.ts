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
 * Get deduplicated unique animals from ANIMALS array.
 * Ensures no animal ID appears more than once.
 */
function getUniqueAnimals(): AnimalData[] {
  const seen = new Set<string>();
  const unique: AnimalData[] = [];
  
  for (const animal of ANIMALS) {
    if (!seen.has(animal.id)) {
      seen.add(animal.id);
      unique.push(animal);
    }
  }
  
  return unique;
}

/**
 * Creates a validated deck of cards for the memory game.
 * STRICT RULE: Each animal appears EXACTLY 2 times (one pair).
 * No duplicates, no missing pairs.
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

  // Get strictly unique animals (deduped by ID)
  const uniqueAnimals = getUniqueAnimals();

  // Validation: we must have enough unique animals
  if (pairsNeeded > uniqueAnimals.length) {
    errors.push(`Not enough unique animals: need ${pairsNeeded} pairs but only have ${uniqueAnimals.length} animals`);
    return { isValid: false, errors, cards: [] };
  }

  // Shuffle and select the required number of unique animals
  const shuffledAnimals = shuffleArray(uniqueAnimals);
  const selectedAnimals = shuffledAnimals.slice(0, pairsNeeded);

  // STRICT: Track which animals are used to prevent any duplicates
  const usedAnimalIds = new Set<string>();
  const cards: CardData[] = [];
  let cardId = 0;

  for (const animal of selectedAnimals) {
    // Double-check: skip if somehow this animal was already used
    if (usedAnimalIds.has(animal.id)) {
      console.error(`Duplicate animal detected during deck creation: ${animal.id}`);
      continue;
    }
    
    usedAnimalIds.add(animal.id);

    // Create EXACTLY 2 cards for this animal
    cards.push({
      id: cardId++,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
    cards.push({
      id: cardId++,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
  }

  // Verify we have exact card count
  if (cards.length !== totalCards) {
    errors.push(`Card count mismatch: expected ${totalCards}, got ${cards.length}`);
    return { isValid: false, errors, cards: [] };
  }

  // Shuffle the final deck and reassign sequential IDs
  const shuffledCards = shuffleArray(cards).map((card, index) => ({
    ...card,
    id: index,
  }));

  // Final validation
  const validationResult = validateDeck(shuffledCards, pairsNeeded);
  
  if (!validationResult.isValid) {
    return { isValid: false, errors: validationResult.errors, cards: [] };
  }

  console.log(`✓ Deck validated: ${shuffledCards.length} cards, ${pairsNeeded} unique pairs`);
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
 * Returns a fresh, valid deck. Always succeeds.
 */
export function autoCorrectDeck(gridSize: number): CardData[] {
  // Get unique animals first
  const uniqueAnimals = getUniqueAnimals();
  const totalCards = gridSize * gridSize;
  const pairsNeeded = totalCards / 2;
  
  // Cap grid size if we don't have enough animals
  const maxPairs = uniqueAnimals.length;
  const actualPairs = Math.min(pairsNeeded, maxPairs);
  const actualGridSize = actualPairs <= 2 ? 2 : actualPairs <= 8 ? 4 : 6;
  
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const result = createValidatedDeck(actualGridSize);
    if (result.isValid) {
      return result.cards;
    }
    console.warn(`Deck validation failed (attempt ${attempts + 1}):`, result.errors);
    attempts++;
  }

  // Ultimate fallback: manually create a guaranteed valid 2x2 deck
  console.error('Using ultimate fallback: creating minimal 2x2 deck');
  const fallbackAnimals = shuffleArray(uniqueAnimals).slice(0, 2);
  const fallbackCards: CardData[] = [];
  
  fallbackAnimals.forEach((animal, pairIndex) => {
    fallbackCards.push({
      id: pairIndex * 2,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
    fallbackCards.push({
      id: pairIndex * 2 + 1,
      animalId: animal.id,
      animalName: animal.name,
      imageUrl: animal.image,
      isFlipped: false,
      isMatched: false,
    });
  });
  
  return shuffleArray(fallbackCards).map((card, index) => ({ ...card, id: index }));
}
