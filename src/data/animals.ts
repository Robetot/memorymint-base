// Animal card data with images
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

// 21 unique animals with proper images - no duplicates
// Only include animals that have their own unique image file
export const ANIMALS: AnimalData[] = [
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

export type Difficulty = '2x2' | '4x4' | '6x6';

export const DIFFICULTY_CONFIG: Record<Difficulty, { gridSize: number; time: number; label: string; description: string }> = {
  '2x2': { gridSize: 2, time: 30, label: 'Easy', description: '2 pairs • 30 seconds' },
  '4x4': { gridSize: 4, time: 120, label: 'Normal', description: '8 pairs • 2 minutes' },
  '6x6': { gridSize: 6, time: 180, label: 'Hard', description: '18 pairs • 3 minutes' },
};
