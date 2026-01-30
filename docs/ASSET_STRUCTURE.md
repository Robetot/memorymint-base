# Memory Mint - Week 1 HOPA Asset Structure

This document describes the asset organization for the Week 1 Hidden Object Puzzle Adventure (HOPA) game.

## Overview

Week 1 is a Roman-themed HOPA game with 3 scenes and 20 hidden objects.

---

## Image Assets

### Backgrounds

**Path:** `/assets/images/backgrounds/`  
**Format:** PNG  
**Dimensions:** 1280×720 (16:9)

| File | Description |
|------|-------------|
| `scene_barracks.png` | Roman military barracks scene |
| `scene_market.png` | Roman marketplace scene |
| `scene_forum.png` | Roman forum scene |

### Object Sprites

All sprites are **transparent PNG** files.

#### 1:1 Aspect Ratio (960×960)

**Path:** `/assets/images/objects/1x1/`

- `gold_coin.png`
- `roman_key.png`
- `laurel_crown.png`
- `oil_lamp.png`
- `gem_ring.png`
- `dice.png`
- `statue_hand.png`
- `coin_purse.png`
- `wax_tablet.png`
- `theatre_mask.png`
- `mosaic_tile.png`

#### 2:3 Aspect Ratio (784×1176)

**Path:** `/assets/images/objects/2x3/`

- `ceramic_vase.png`
- `centurion_helmet.png`
- `torch.png`
- `aquila_standard.png`
- `perfume_bottle.png`

#### 3:2 Aspect Ratio (1176×784)

**Path:** `/assets/images/objects/3x2/`

- `open_scroll.png`
- `gladius_sword.png`
- `empire_map.png`
- `legionary_shield.png`

---

## Audio Assets

### Sound Effects

**Path:** `/assets/audio/sfx/`  
**Format:** MP3

| File | Trigger Event |
|------|---------------|
| `SFX_Object_Found.mp3` | Object successfully found |
| `SFX_Wrong_Tap.mp3` | Incorrect tap |
| `SFX_UI_Tap.mp3` | UI button press |
| `SFX_Menu_Open.mp3` | Menu opened |
| `SFX_Menu_Close.mp3` | Menu closed |
| `SFX_Hint_Available.mp3` | Hint becomes available |
| `SFX_Hint_Used.mp3` | Hint activated |
| `SFX_Scene_Load.mp3` | Scene transition |

### Voice/Narration

**Path:** `/assets/audio/voice/`  
**Format:** MP3

| File | Trigger Event |
|------|---------------|
| `VO_Scene_Start.mp3` | Scene begins |
| `VO_Mid_Scene.mp3` | Mid-scene progress |
| `VO_Scene_Complete.mp3` | Scene completed |

---

## Data Files

**Path:** `/data/`

| File | Purpose |
|------|---------|
| `scenes.json` | Scene configuration and object placements |
| `objects.json` | Object definitions and paths |
| `audioMap.json` | Audio event mappings |
| `difficulty.json` | Difficulty level settings |

---

## Code Modules

**Path:** `/src/hopa/`

| File | Purpose |
|------|---------|
| `main.js` | Game entry point |
| `gameConfig.js` | Game configuration |
| `sceneManager.js` | Scene loading and transitions |
| `uiManager.js` | UI components |
| `audioManager.js` | Audio playback |
| `hitboxManager.js` | Hitbox detection |
| `difficultyManager.js` | Difficulty settings |

---

## Design Assumptions

- **Mobile-first:** Touch-optimized with minimum 48px tap targets
- **Responsive:** Background scales to fill viewport (16:9)
- **Transparency:** All object sprites have transparent backgrounds
- **Hitboxes:** Based on sprite bounds with configurable scale per difficulty
- **Polygon hitboxes:** Supported for irregular shapes

---

## Naming Conventions

- **Backgrounds:** `scene_{location}.png`
- **Objects:** `{object_name}.png` (snake_case)
- **SFX:** `SFX_{Event_Name}.mp3` (PascalCase event)
- **Voice:** `VO_{Event_Name}.mp3` (PascalCase event)

---

## Build Command

When ready to implement, use:

```
BUILD FINAL WEEK 1 HOPA GAME FOR MEMORY MINT
```
