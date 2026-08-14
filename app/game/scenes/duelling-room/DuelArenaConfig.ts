import Phaser from 'phaser';

// ── Interior world size ───────────────────────────────────────────────────
// t7.png is 1365×768, rendered at 1680×960 (scale 1.2308×, 1.25×)
export const WORLD_W = 1680;
export const WORLD_H = 960;

// ── Arena layout ─────────────────────────────────────────────────────────
export const ARENA_MARGIN = 90;
export const ARENA_WIDTH  = 528;
export const ARENA_HEIGHT = 417;
export const ARENA_X      = 1004;
export const ARENA_Y      = 307;

// ── Duel spawns (inside arena, left/right of centre) ─────────────────────
export const PLAYER1_SPAWN = { x: 1100, y: 560 };
export const PLAYER2_SPAWN = { x: 1460, y: 560 };

// ── Key positions ─────────────────────────────────────────────────────────
// DOOR_POSITION = exit zone — bottom entrance gap (where player enters/exits)
// In t7, the railing bottom rail is at y=696. The open gap is x 1167-1387.
// Exit zone sits just below the bottom rails, at the centre of the gap.
export const DOOR_POSITION = { x: 1277, y: 790, radius: 100 };

// DUEL_PLATFORM = dead centre of the arena circle
// Arena railing: left x=1004, right x=1532 → centre x=1268
// Top y=307, bottom y=724 → centre y=515
export const DUEL_PLATFORM = { x: 1268, y: 515, radius: 210 };
export const DUEL_TRIGGER  = { x: 1268, y: 660, radius: 100 };

// ── Spectator positions ───────────────────────────────────────────────────
export const SPECTATOR_POSITIONS = [
  { x: 210, y: 450 },
  { x: 370, y: 450 },
  { x: 210, y: 590 },
  { x: 370, y: 590 },
];

// ── Collider rects [x, y, w, h] ───────────────────────────────────────────
// All values in WORLD coordinates (1680×960).
// t7 pixel → world:  x_world = x_t7 × 1.2308,  y_world = y_t7 × 1.25
//
// KEY SAFE ZONES (no collision):
//   Arena interior: fully open — NO top arc collider.
//   Entrance gap:   x 1167–1387, fully passable.
//   Exit arch:      x 900–1110 open for walking through.
export const COLLIDER_RECTS: [number, number, number, number][] = [

  // ── OUTER WALLS ──────────────────────────────────────────────────────────
  [0,    0,    WORLD_W, 50],    // top wall
  [0,    0,    40,  WORLD_H],   // left wall
  [1640, 0,    40,  WORLD_H],   // right wall
  // Bottom wall — entrance arch open x 640–880
  [0,    900,  640, 60],
  [880,  900,  800, 60],

  // ── LEFT TEACHING AREA ───────────────────────────────────────────────────
  [0,    0,    490, 175],       // back wall + chalkboard
  [0,    200,  80,  130],       // left barrel cluster
  [70,   240,  430, 185],       // teacher hex-desk
  [50,   440,  450, 70],        // student desks row 1
  [50,   560,  450, 70],        // student desks row 2
  [0,    640,  75,  320],       // bottom-left barrels

  // ── CENTRE BOOKSHELVES ────────────────────────────────────────────────────
  [505,  0,    165, 300],       // left bookshelf
  [710,  0,    170, 300],       // right bookshelf

  // ── EXIT ARCH FRAME (top-right) ──────────────────────────────────────────
  [900,  0,    270, 75],        // stone header above arch opening
  [900,  75,   55,  145],       // left arch pillar
  [1115, 75,   55,  145],       // right arch pillar
  // NOTE: arch opening x 955–1115 left OPEN for exit interaction

  // ── RIGHT SIDE — training dummies ────────────────────────────────────────
  [1180, 180,  75,  205],       // left dummy + stand
  [1500, 180,  75,  205],       // right dummy + stand

  // ── ARENA RAILING ────────────────────────────────────────────────────────
  // NO top arc → interior fully walkable.
  // Only left/right pillars + bottom rails with wide entrance gap.
  [1004, 307,  28,  417],       // left railing pillar  (full height)
  [1504, 307,  28,  417],       // right railing pillar
  // Bottom rails — gap x 1167–1387 (220 px wide, easy to walk through)
  [1004, 696,  163, 28],        // bottom rail LEFT
  [1387, 696,  145, 28],        // bottom rail RIGHT
];

export const SPECTATOR_STAND_RECTS: [number, number, number, number][] = [];

export function isWithinCircle(
  point:  { x: number; y: number },
  circle: { x: number; y: number; radius: number },
) {
  return Phaser.Math.Distance.Between(point.x, point.y, circle.x, circle.y) < circle.radius;
}
