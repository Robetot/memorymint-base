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
    { id: "mirror", position: { top: "15%", left: "10%" }, size: { width: "65px", height: "65px" } },
    { id: "clock", position: { top: "35%", left: "70%" }, size: { width: "65px", height: "65px" } },
    { id: "key", position: { top: "55%", left: "20%" }, size: { width: "55px", height: "55px" } },
    { id: "brush", position: { top: "70%", left: "60%" }, size: { width: "60px", height: "60px" } },
    { id: "letter", position: { top: "45%", left: "40%" }, size: { width: "60px", height: "60px" } },
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
