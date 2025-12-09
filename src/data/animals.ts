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
// New animal images
import horseImg from '@/assets/animals/horse.jpg';
import sharkImg from '@/assets/animals/shark.jpg';
import rabbitImg from '@/assets/animals/rabbit.jpg';
import eagleImg from '@/assets/animals/eagle.jpg';
import birdImg from '@/assets/animals/bird.jpg';
import penguinImg from '@/assets/animals/penguin.jpg';
import belugawhaleImg from '@/assets/animals/belugawhale.jpg';
import hedgehogImg from '@/assets/animals/hedgehog.jpg';
import mantarayImg from '@/assets/animals/mantaray.jpg';
import zebraImg from '@/assets/animals/zebra.jpg';
import lionImg from '@/assets/animals/lion.jpg';
import monkeyImg from '@/assets/animals/monkey.jpg';
import elephantImg from '@/assets/animals/elephant.jpg';
import butterflyImg from '@/assets/animals/butterfly.jpg';
import rhinocerosImg from '@/assets/animals/rhinoceros.jpg';
import seaturtleImg from '@/assets/animals/seaturtle.jpg';

export interface AnimalData {
  id: string;
  name: string;
  image: string;
}

// 36 animals matching the game card set
export const ANIMALS: AnimalData[] = [
  { id: 'cat', name: 'Cat', image: catImg },
  { id: 'calf', name: 'Calf', image: calfImg },
  { id: 'horse', name: 'Horse', image: horseImg },
  { id: 'lamb', name: 'Lamb', image: lambImg },
  { id: 'polarbear', name: 'Polar Bear', image: polarbearImg },
  { id: 'seal', name: 'Seal', image: sealImg },
  { id: 'shark', name: 'Shark', image: sharkImg },
  { id: 'duckling', name: 'Duckling', image: ducklingImg },
  { id: 'chick', name: 'Chick', image: chickImg },
  { id: 'rabbit', name: 'Rabbit', image: rabbitImg },
  { id: 'swan', name: 'Swan', image: swanImg },
  { id: 'puppy', name: 'Puppy', image: puppyImg },
  { id: 'owl', name: 'Owl', image: owlImg },
  { id: 'eagle', name: 'Eagle', image: eagleImg },
  { id: 'bird', name: 'Bird', image: birdImg },
  { id: 'parrot', name: 'Parrot', image: parrotImg },
  { id: 'penguin', name: 'Penguin', image: penguinImg },
  { id: 'piggy', name: 'Piggy', image: piggyImg },
  { id: 'belugawhale', name: 'Beluga Whale', image: belugawhaleImg },
  { id: 'hedgehog', name: 'Hedgehog', image: hedgehogImg },
  { id: 'mantaray', name: 'Manta Ray', image: mantarayImg },
  { id: 'squirrel', name: 'Squirrel', image: squirrelImg },
  { id: 'zebra', name: 'Zebra', image: zebraImg },
  { id: 'lion', name: 'Lion', image: lionImg },
  { id: 'tiger', name: 'Tiger', image: tigerImg },
  { id: 'leopard', name: 'Leopard', image: leopardImg },
  { id: 'deer', name: 'Deer', image: deerImg },
  { id: 'fox', name: 'Fox', image: foxImg },
  { id: 'monkey', name: 'Monkey', image: monkeyImg },
  { id: 'elephant', name: 'Elephant', image: elephantImg },
  { id: 'panda', name: 'Panda', image: pandaImg },
  { id: 'dolphin', name: 'Dolphin', image: dolphinImg },
  { id: 'koala', name: 'Koala', image: koalaImg },
  { id: 'butterfly', name: 'Butterfly', image: butterflyImg },
  { id: 'rhinoceros', name: 'Rhinoceros', image: rhinocerosImg },
  { id: 'seaturtle', name: 'Sea Turtle', image: seaturtleImg },
];

export type Difficulty = '2x2' | '4x4' | '6x6' | '8x8';

export const DIFFICULTY_CONFIG: Record<Difficulty, { gridSize: number; time: number; label: string; description: string }> = {
  '2x2': { gridSize: 2, time: 30, label: 'Easy', description: '2 pairs • 30 seconds' },
  '4x4': { gridSize: 4, time: 120, label: 'Normal', description: '8 pairs • 2 minutes' },
  '6x6': { gridSize: 6, time: 180, label: 'Hard', description: '18 pairs • 3 minutes' },
  '8x8': { gridSize: 8, time: 300, label: 'Expert', description: '32 pairs • 5 minutes' },
};
