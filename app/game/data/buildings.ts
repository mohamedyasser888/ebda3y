// ============================================================
// Building Registry — single source of truth for every
// door location in the outdoor world and its corresponding
// interior scene + spawn/return positions.
//
// Add new buildings here without touching any scene code.
// ============================================================
import type { BuildingDef } from '../../types/game.types';
import { DUEL_BUILDING_DOOR, DUEL_BUILDING_EXIT } from './MapConfig';

// ── Outdoor world size (must match OutdoorWorldScene) ─────
export const WORLD_W = 4000;
export const WORLD_H = 3000;

// Calculate botanical classroom door position
const BOTANICAL_BUILDING_POSITION = {
  x: 110 * 20,  // 2200
  y: 50 * 20,   // 1000
};
const BOTANICAL_DOOR_LAYOUT = { x: 30, y: 28, w: 4, h: 4 };
const BOTANICAL_BUILDING_DOOR = {
  x: BOTANICAL_BUILDING_POSITION.x + BOTANICAL_DOOR_LAYOUT.x * 20 + (BOTANICAL_DOOR_LAYOUT.w * 20) / 2,
  y: BOTANICAL_BUILDING_POSITION.y + BOTANICAL_DOOR_LAYOUT.y * 20 + (BOTANICAL_DOOR_LAYOUT.h * 20) / 2,
};

// Calculate astronomy tower door position
// Building placed at tile (25, 110) → world px (500, 2200)
// Scaled to 50×32 tiles (1000×640 px)
// Door (arch tunnel) at ~50% BW, ~83% BH
const ASTRONOMY_BUILDING_POSITION = {
  x: 25  * 20,   // 500
  y: 110 * 20,   // 2200
};
const ASTRO_BW = 50 * 20;   // 1000
const ASTRO_BH = 32 * 20;   // 640
export const ASTRONOMY_BUILDING_DOOR = {
  x: ASTRONOMY_BUILDING_POSITION.x + Math.round(ASTRO_BW * 0.50),   // 1000
  y: ASTRONOMY_BUILDING_POSITION.y + Math.round(ASTRO_BH * 0.83),   // 2731
};

// Creatures Class door position
// Building at tile(50, 150) → world px (1000, 3000), scaled 50×28 tiles (1000×560 px)
// Door at ~48% BW, ~84% BH
const CREATURES_BUILDING_POSITION = { x: 50 * 20, y: 150 * 20 };
const CREATURES_BW = 50 * 20;
const CREATURES_BH = 28 * 20;
export const CREATURES_BUILDING_DOOR = {
  x: CREATURES_BUILDING_POSITION.x + Math.round(CREATURES_BW * 0.48),
  y: CREATURES_BUILDING_POSITION.y + Math.round(CREATURES_BH * 0.84),
};

// Magical Hospital door position
// Building at tile(110, 8) → world px (2200, 160), scaled 55×32 tiles (1100×640 px)
// Sits directly above the Botanical Classroom (tile 110,50) with ~200px gap
// Door: central arch at ~48% BW, ~83% BH
const HOSPITAL_BUILDING_POSITION = { x: 110 * 20, y: 8 * 20 };
const HOSPITAL_BW = 55 * 20;   // 1100
const HOSPITAL_BH = 32 * 20;   // 640
export const HOSPITAL_BUILDING_DOOR = {
  x: HOSPITAL_BUILDING_POSITION.x + Math.round(HOSPITAL_BW * 0.48),   // 2728
  y: HOSPITAL_BUILDING_POSITION.y + Math.round(HOSPITAL_BH * 0.83),   // 691
};
// Building at tile (110, 110) → world px (2200, 2200), scaled to 55×32 tiles (1100×640 px)
// Door is the central arch at ~48% BW, ~82% BH
const LIBRARY_BUILDING_POSITION = {
  x: 110 * 20,   // 2200
  y: 110 * 20,   // 2200
};
const LIBRARY_BW = 55 * 20;   // 1100
const LIBRARY_BH = 32 * 20;   // 640
export const LIBRARY_BUILDING_DOOR = {
  x: LIBRARY_BUILDING_POSITION.x + Math.round(LIBRARY_BW * 0.48),   // 2728
  y: LIBRARY_BUILDING_POSITION.y + Math.round(LIBRARY_BH * 0.82),   // 2725
};

// ── Buildings ─────────────────────────────────────────────
export const BUILDINGS: BuildingDef[] = [
  {
    id:          'duellingRoom',
    label:       'Dueling Club',
    sceneKey:    'DuellingRoomScene',
    doorX:       DUEL_BUILDING_DOOR.x,
    doorY:       DUEL_BUILDING_DOOR.y,
    doorRadius:  80,
    spawnX:      1020,
    spawnY:      700,
    returnX:     DUEL_BUILDING_EXIT.x,
    returnY:     DUEL_BUILDING_EXIT.y,
    enterPrompt: '⚡  Press E to enter Dueling Club',
  },
  {
    id:          'botanicalClassroom',
    label:       'Botanical Classroom',
    sceneKey:    'BotanicalClassroomScene',
    doorX:       BOTANICAL_BUILDING_DOOR.x,
    doorY:       BOTANICAL_BUILDING_DOOR.y,
    doorRadius:  80,
    spawnX:      960,
    spawnY:      700,
    returnX:     BOTANICAL_BUILDING_DOOR.x,
    returnY:     BOTANICAL_BUILDING_DOOR.y + 80,
    enterPrompt: '🌿  Press E to enter Botanical Classroom',
  },
  {
    id:          'astronomyTower',
    label:       'Astronomy Tower',
    sceneKey:    'AstronomyTowerScene',
    doorX:       ASTRONOMY_BUILDING_DOOR.x,
    doorY:       ASTRONOMY_BUILDING_DOOR.y,
    doorRadius:  90,
    spawnX:      960,
    spawnY:      600,
    returnX:     ASTRONOMY_BUILDING_DOOR.x,
    returnY:     ASTRONOMY_BUILDING_DOOR.y + 110,
    enterPrompt: '🔭  Press E to enter Astronomy Tower',
  },
  {
    id:          'hogwartsLibrary',
    label:       'Hogwarts Library',
    sceneKey:    'HogwartsLibraryScene',
    doorX:       LIBRARY_BUILDING_DOOR.x,
    doorY:       LIBRARY_BUILDING_DOOR.y,
    doorRadius:  90,
    spawnX:      800,
    spawnY:      650,
    returnX:     LIBRARY_BUILDING_DOOR.x,
    returnY:     LIBRARY_BUILDING_DOOR.y + 110,
    enterPrompt: 'Press E to enter Hogwarts Library',
  },
  {
    id:          'creaturesClass',
    label:       'Magical Creatures Class',
    sceneKey:    'CreaturesClassScene',
    doorX:       CREATURES_BUILDING_DOOR.x,
    doorY:       CREATURES_BUILDING_DOOR.y,
    doorRadius:  90,
    spawnX:      960,
    spawnY:      650,
    returnX:     CREATURES_BUILDING_DOOR.x,
    returnY:     CREATURES_BUILDING_DOOR.y + 110,
    enterPrompt: 'Press E to enter Magical Creatures Class',
  },
  {
    id:          'magicalHospital',
    label:       'Magical Hospital',
    sceneKey:    'MagicalHospitalScene',
    doorX:       HOSPITAL_BUILDING_DOOR.x,
    doorY:       HOSPITAL_BUILDING_DOOR.y,
    doorRadius:  90,
    spawnX:      840,
    spawnY:      860,
    returnX:     HOSPITAL_BUILDING_DOOR.x,
    returnY:     HOSPITAL_BUILDING_DOOR.y + 110,
    enterPrompt: 'Press E to enter Magical Hospital',
  },
];

// Quick lookup by id
export const BUILDING_MAP: Record<string, BuildingDef> =
  Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
