import mapData from '../../../game.json';

type CollisionBlock = {
  x: number;
  y: number;
  w?: number;
  width?: number;
  h?: number;
  height?: number;
};

type BuildingVisual = {
  door?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  collision?: CollisionBlock[] | number[][];
};

type RoomData = {
  position?: { x: number; y: number };
  size: { width: number; height: number };
  playerSpawn?: { x: number; y: number };
  paths?: Array<{ points: number[][]; type: string }>;
  ground?: { tile: string; variation?: string[]; walkable?: boolean };
  visual?: BuildingVisual;
  buildings?: string[];
  collision?: { source?: string } | any;
};

const MAP_TILE_SIZE = 20;

const exteriorRoom = mapData.world.rooms.hogwartsExterior as unknown as RoomData;
const duelingBuilding = mapData.world.rooms.duelingBuilding as unknown as RoomData;

export const TILE_SIZE = MAP_TILE_SIZE;
export const WORLD_W = exteriorRoom.size.width * MAP_TILE_SIZE;
export const WORLD_H = exteriorRoom.size.height * MAP_TILE_SIZE;

export const HOGWARTS_EXTERIOR = exteriorRoom;
export const HOGWARTS_PATHS = exteriorRoom.paths ?? [];
export const HOGWARTS_GROUND = exteriorRoom.ground ?? { tile: 'grass', variation: ['grass'], walkable: true };

export const DUEL_BUILDING_ROOM = duelingBuilding;
export const DUEL_BUILDING_POSITION = {
  x: (duelingBuilding.position?.x ?? 0) * MAP_TILE_SIZE,
  y: (duelingBuilding.position?.y ?? 0) * MAP_TILE_SIZE,
  width: duelingBuilding.size.width * MAP_TILE_SIZE,
  height: duelingBuilding.size.height * MAP_TILE_SIZE,
};

export const DUEL_BUILDING_LAYOUT = duelingBuilding.visual ?? {};

const doorLayout = DUEL_BUILDING_LAYOUT.door ?? { x: 18, y: 24, w: 6, h: 6 };
export const DUEL_BUILDING_DOOR = {
  x: DUEL_BUILDING_POSITION.x + doorLayout.x * MAP_TILE_SIZE + (doorLayout.w * MAP_TILE_SIZE) / 2,
  y: DUEL_BUILDING_POSITION.y + doorLayout.y * MAP_TILE_SIZE + (doorLayout.h * MAP_TILE_SIZE) / 2,
};

export const DUEL_BUILDING_EXIT = DUEL_BUILDING_DOOR;

export const OUTDOOR_PLAYER_SPAWN = {
  x: DUEL_BUILDING_DOOR.x,
  y: DUEL_BUILDING_DOOR.y + 100,
};

export const toWorldPx = (tileX: number, tileY: number) => ({
  x: tileX * MAP_TILE_SIZE,
  y: tileY * MAP_TILE_SIZE,
});

export const groundColor = (tile: string) => {
  switch (tile) {
    case 'grass_dark': return 0x1e4d12;
    case 'grass_light': return 0x3d8a28;
    case 'grass':
    default:
      return 0x2d6a1f;
  }
};

export const pathColor = (type: string) => {
  switch (type) {
    case 'stone': return 0x8a8a8a;
    case 'dirt': return 0x8b6914;
    default: return 0x8a8a8a;
  }
};
