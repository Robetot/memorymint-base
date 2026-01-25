export interface HiddenObject {
  id: string;
  position: { top: string; left: string };
  size?: { width: string; height: string };
}

export interface MemoryPair {
  pair: [string, string];
}

export interface WeekData {
  weekId: number;
  title: string;
  hiddenObjects: HiddenObject[];
  memoryPairs: [string, string][];
  nftMetadata: {
    name: string;
    image: string;
    description: string;
  };
}

export const WEEK_01: WeekData = {
  weekId: 1,
  title: "The Forgotten Atelier",
  hiddenObjects: [
    { id: "mirror", position: { top: "15%", left: "20%" }, size: { width: "80px", height: "80px" } },
    { id: "clock", position: { top: "40%", left: "70%" }, size: { width: "80px", height: "80px" } },
    { id: "key", position: { top: "60%", left: "30%" }, size: { width: "60px", height: "60px" } },
    { id: "brush", position: { top: "75%", left: "50%" }, size: { width: "70px", height: "70px" } },
    { id: "letter", position: { top: "20%", left: "80%" }, size: { width: "75px", height: "75px" } },
  ],
  memoryPairs: [
    ["mirror", "clock"],
    ["key", "brush"],
    ["letter", "mirror"],
  ],
  nftMetadata: {
    name: "Clock of Last Light",
    image: "/weekly/week01/nft_clock_of_last_light.webp",
    description: "A mystical timepiece from the Forgotten Atelier, forever frozen at twilight.",
  },
};
