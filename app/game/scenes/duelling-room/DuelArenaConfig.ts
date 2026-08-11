import Phaser from 'phaser';

// ── Interior world size (ttr.png rendered at 1680×960) ───────────────────
export const WORLD_W = 1680;
export const WORLD_H = 960;

// ── Arena layout ─────────────────────────────────────────────────────────
// Arena circle in ttr.png: centre ~76% W = 1277, ~54% H = 518, radius ~190px
export const ARENA_MARGIN = 90;
export const ARENA_WIDTH  = 380;
export const ARENA_HEIGHT = 380;
export const ARENA_X      = 1087;
export const ARENA_Y      = 328;

// ── Spawns (placed inside arena for duel) ────────────────────────────────
export const PLAYER1_SPAWN = { x: 1150, y: 510 };
export const PLAYER2_SPAWN = { x: 1410, y: 510 };

// ── Key positions ─────────────────────────────────────────────────────────
// DOOR_POSITION = exit zone — dark arch top-right of image (~63% W, 12% H)
export const DOOR_POSITION = { x: 1055, y: 115, radius: 80 };

// DUEL_PLATFORM = true centre of the arena circle
export const DUEL_PLATFORM = { x: 1277, y: 518, radius: 180 };
export const DUEL_TRIGGER  = { x: 1277, y: 640, radius: 90  };

// ── Spectator positions (seated students on left side) ────────────────────
export const SPECTATOR_POSITIONS = [
  { x: 220, y: 460 },
  { x: 380, y: 460 },
  { x: 220, y: 600 },
  { x: 380, y: 600 },
];

// ── Collider rects [x, y, w, h] ───────────────────────────────────────────
// Layout analysis of ttr.png at 1680×960:
//
// OUTER WALLS — all four sides
// TOP WALL: full width, y 0–60
// LEFT WALL: x 0–48, full height
// RIGHT WALL: x 1632–1680, full height
// BOTTOM WALL: split — entrance arch open at x 690–860
//
// LEFT TEACHING AREA:
//   Chalkboard + back wall:   x 32–490,  y 60–190
//   Teacher desk (hex):       x 150–490, y 250–400
//   Left barrel:              x 32–100,  y 220–340
//   Student desks row 1:      x 110–490, y 430–510
//   Student desks row 2:      x 110–490, y 545–625
//   Bottom-left barrels:      x 32–110,  y 650–880
//
// CENTRE TOP — bookshelves:
//   Left bookshelf:           x 530–700, y 60–280
//   Right bookshelf:          x 700–870, y 60–280
//
// TOP-RIGHT — arch entrance doorway header (stone arch frame):
//   Left pillar:              x 900–970, y 60–220
//   Right pillar:             x 1100–1160, y 60–220
//   Header above arch:        x 900–1160, y 60–110
//
// RIGHT SIDE — training dummies + shields:
//   Dummy stand left:         x 1180–1250, y 200–400
//   Dummy stand right:        x 1540–1640, y 200–400
//
// ARENA RAILING — circular fence split at bottom entrance (x 1260–1300 open):
//   Top arc (solid):          x 1168–1588, y 347–375
//   Left pillar:              x 1168–1196, y 375–690
//   Right pillar:             x 1560–1588, y 375–690
//   Bottom rail left:         x 1168–1268, y 680–708
//   Bottom rail right:        x 1298–1588, y 680–708
export const COLLIDER_RECTS: [number, number, number, number][] = [
  // ── Outer walls ───────────────────────────────────────────────────────
  [0,    0,    WORLD_W, 60],    // top
  [0,    0,    48, WORLD_H],    // left
  [1632, 0,    48, WORLD_H],    // right
  // Bottom wall — entrance arch open at x 690–860
  [0,    900,  690, 60],        // bottom-left
  [860,  900,  820, 60],        // bottom-right

  // ── Left teaching area ────────────────────────────────────────────────
  [48,   60,   458, 130],       // chalkboard + back wall
  [48,   200,  68,  120],       // left barrel
  [148,  250,  344, 150],       // teacher desk (hexagonal)
  [110,  430,  382, 80],        // student desks row 1
  [110,  545,  382, 80],        // student desks row 2
  [48,   650,  80,  230],       // bottom-left barrels

  // ── Centre bookshelves ────────────────────────────────────────────────
  [530,  60,   170, 220],       // left bookshelf
  [700,  60,   170, 220],       // right bookshelf

  // ── Arch doorway frame (exit arch top-right) ──────────────────────────
  [900,  60,   260, 50],        // stone header above arch
  [900,  110,  70,  110],       // left pillar
  [1090, 110,  70,  110],       // right pillar

  // ── Right side training dummies ───────────────────────────────────────
  [1087, 200,  70,  200],       // left dummy on stand
  [1460, 200,  72,  200],       // right dummy on stand

  // ── Arena railing ─────────────────────────────────────────────────────
  [1087, 328,  380, 28],        // top arc
  [1087, 356,  28,  330],       // left pillar
  [1439, 356,  28,  330],       // right pillar
  [1087, 658,  100, 28],        // bottom rail left  (gap x:1187–1267 open for entry)
  [1267, 658,  200, 28],        // bottom rail right
];

export const SPECTATOR_STAND_RECTS: [number, number, number, number][] = [];

export function isWithinCircle(
  point:  { x: number; y: number },
  circle: { x: number; y: number; radius: number },
) {
  return Phaser.Math.Distance.Between(point.x, point.y, circle.x, circle.y) < circle.radius;
}
