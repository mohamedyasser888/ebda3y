import Phaser from 'phaser';
import {
  WORLD_W,
  WORLD_H,
  ARENA_X,
  ARENA_Y,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  DOOR_POSITION,
  DUEL_PLATFORM,
  SPECTATOR_POSITIONS,
} from './DuelArenaConfig';

export function drawArenaBackground(scene: Phaser.Scene) {
  const bg = scene.add.graphics();
  bg.fillStyle(0x12172b);
  bg.fillRect(0, 0, WORLD_W, WORLD_H);

  // Subtle ambient floornoise overlay
  for (let i = 0; i < 120; i++) {
    const x = Phaser.Math.Between(0, WORLD_W);
    const y = Phaser.Math.Between(0, WORLD_H);
    bg.fillStyle(0xffffff, 0.02);
    bg.fillRect(x, y, 2, 2);
  }
}

export function drawArenaFloor(scene: Phaser.Scene) {
  const g = scene.add.graphics();

  // Outer stone floor
  g.fillStyle(0x2f334a);
  g.fillRect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);

  // Floor tile grid inside arena
  g.lineStyle(1, 0x23263c, 0.5);
  for (let y = ARENA_Y; y <= ARENA_Y + ARENA_HEIGHT; y += 60) {
    g.lineBetween(ARENA_X, y, ARENA_X + ARENA_WIDTH, y);
  }
  for (let x = ARENA_X; x <= ARENA_X + ARENA_WIDTH; x += 60) {
    g.lineBetween(x, ARENA_Y, x, ARENA_Y + ARENA_HEIGHT);
  }

  // Central duel patch
  g.fillStyle(0x3b4460);
  g.fillRoundedRect(ARENA_X + 110, ARENA_Y + 90, ARENA_WIDTH - 220, ARENA_HEIGHT - 180, 18);

  // Magical edge ring
  g.lineStyle(5, 0x7e57c2, 0.55);
  g.strokeRoundedRect(ARENA_X + 104, ARENA_Y + 84, ARENA_WIDTH - 208, ARENA_HEIGHT - 188, 22);

  // Rune clusters
  const runeColors = [0x8e44ad, 0xba55d3, 0xd68fff];
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const x = 600 + Math.cos(angle) * 280;
    const y = 450 + Math.sin(angle) * 220;
    drawRune(scene, x, y, runeColors[i % runeColors.length]);
  }
}

function drawRune(scene: Phaser.Scene, x: number, y: number, color: number) {
  const r = scene.add.graphics();
  r.fillStyle(color, 0.9);
  r.fillCircle(x, y, 10);
  r.lineStyle(2, 0xffffff, 0.6);
  r.strokeCircle(x, y, 10);
  r.strokeLineShape(new Phaser.Geom.Line(x - 4, y, x + 4, y));
  r.strokeLineShape(new Phaser.Geom.Line(x, y - 4, x, y + 4));
  r.strokeCircle(x, y, 4);
}

export function drawArenaBoundary(scene: Phaser.Scene) {
  const g = scene.add.graphics();

  // Massive stone boundary
  g.fillStyle(0x1f2436);
  g.fillRect(0, 0, WORLD_W, 80);
  g.fillRect(0, WORLD_H - 80, WORLD_W, 80);
  g.fillRect(0, 0, 80, WORLD_H);
  g.fillRect(WORLD_W - 80, 0, 80, WORLD_H);

  // Decorative wall topping
  g.fillStyle(0x31384f);
  g.fillRect(0, 80, WORLD_W, 18);
  g.fillRect(0, WORLD_H - 98, WORLD_W, 18);
  g.fillRect(80, 0, 18, WORLD_H);
  g.fillRect(WORLD_W - 98, 0, 18, WORLD_H);

  drawWallDetail(scene, 160, 40);
  drawWallDetail(scene, WORLD_W - 160, 40);
  drawWallDetail(scene, 160, WORLD_H - 40);
  drawWallDetail(scene, WORLD_W - 160, WORLD_H - 40);
}

function drawWallDetail(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics();
  g.fillStyle(0x4b5167);
  g.fillRect(x - 20, y - 28, 40, 56);
  g.lineStyle(2, 0x23263c);
  g.strokeRect(x - 20, y - 28, 40, 56);
  g.fillStyle(0xc19b6f);
  g.fillRect(x - 8, y - 18, 16, 36);
}

export function drawDuelPlatform(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x243349);
  g.fillCircle(DUEL_PLATFORM.x, DUEL_PLATFORM.y, 140);

  g.lineStyle(4, 0x7d3c98);
  g.strokeCircle(DUEL_PLATFORM.x, DUEL_PLATFORM.y, 140);
  g.lineStyle(2, 0xf0d86c, 0.8);
  g.strokeCircle(DUEL_PLATFORM.x, DUEL_PLATFORM.y, 120);
  g.strokeCircle(DUEL_PLATFORM.x, DUEL_PLATFORM.y, 90);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = DUEL_PLATFORM.x + Math.cos(angle) * 100;
    const y = DUEL_PLATFORM.y + Math.sin(angle) * 100;
    const rune = scene.add.text(x, y, '✦', { fontSize: '18px', color: '#d6a2f5', fontFamily: 'monospace' });
    rune.setOrigin(0.5);
    rune.setDepth(12);
  }

  const hint = scene.add.text(DUEL_PLATFORM.x, DUEL_PLATFORM.y + 160, 'Press E to begin duel', {
    fontSize: '16px', color: '#f8d672', fontFamily: 'Georgia', fontStyle: 'bold', stroke: '#1b1f33', strokeThickness: 3,
  });
  hint.setOrigin(0.5);
  hint.setAlpha(0.8);
}

export function drawDecorations(scene: Phaser.Scene) {
  drawPillar(scene, 180, 180);
  drawPillar(scene, WORLD_W - 180, 180);
  drawPillar(scene, 180, WORLD_H - 180);
  drawPillar(scene, WORLD_W - 180, WORLD_H - 180);

  drawCrystalPedestal(scene, 150, 380);
  drawCrystalPedestal(scene, WORLD_W - 150, 380);
  drawCrystalPedestal(scene, 150, WORLD_H - 380);
  drawCrystalPedestal(scene, WORLD_W - 150, WORLD_H - 380);

  drawBanner(scene, 330, 110, 0x652d91);
  drawBanner(scene, 870, 110, 0x1f70b4);
  drawBanner(scene, 330, WORLD_H - 130, 0x8b4513);
  drawBanner(scene, 870, WORLD_H - 130, 0x4a7d53);

  drawDoor(scene, DOOR_POSITION.x, DOOR_POSITION.y);
}

function drawDoor(scene: Phaser.Scene, x: number, y: number) {
  const door = scene.add.graphics();
  door.fillStyle(0x6b4f31);
  door.fillRoundedRect(x - 48, y - 70, 96, 100, 14);
  door.fillStyle(0x3f2d18);
  door.fillRect(x - 40, y - 60, 80, 84);
  door.lineStyle(4, 0x2a1e11);
  door.strokeRoundedRect(x - 48, y - 70, 96, 100, 14);
  door.fillStyle(0xd4ac6e);
  door.fillCircle(x + 22, y - 20, 6);
  door.lineStyle(2, 0x2a1e11);
  door.lineBetween(x - 18, y + 20, x - 18, y + 30);
  door.lineBetween(x + 18, y + 20, x + 18, y + 30);
  const plaque = scene.add.text(x, y + 45, 'DUEL CHAMBER', { fontSize: '12px', color: '#f8d672', fontFamily: 'Georgia', fontStyle: 'bold' });
  plaque.setOrigin(0.5);
}

function drawPillar(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics();
  g.fillStyle(0x31384f);
  g.fillRect(x - 24, y - 40, 48, 80);
  g.lineStyle(2, 0x1d2338);
  g.strokeRect(x - 24, y - 40, 48, 80);
  g.fillStyle(0x6a6f8a);
  g.fillRect(x - 24, y - 48, 48, 14);
}

function drawBanner(scene: Phaser.Scene, x: number, y: number, color: number) {
  const g = scene.add.graphics();
  g.fillStyle(0x2f334a);
  g.fillRect(x - 12, y - 12, 24, 80);
  g.fillStyle(color);
  g.fillRect(x, y - 6, 40, 60);
  g.lineStyle(2, 0xf8d672);
  g.strokeRect(x, y - 6, 40, 60);
}

function drawCrystalPedestal(scene: Phaser.Scene, x: number, y: number) {
  const base = scene.add.graphics();
  base.fillStyle(0x413b4f);
  base.fillRect(x - 20, y, 40, 40);
  base.fillStyle(0x5d4d72);
  base.fillRect(x - 14, y - 20, 28, 20);
  const crystal = scene.add.graphics();
  crystal.fillStyle(0x8c69ff);
  crystal.fillPoints([
    new Phaser.Math.Vector2(x, y - 68),
    new Phaser.Math.Vector2(x - 14, y - 16),
    new Phaser.Math.Vector2(x, y - 58),
    new Phaser.Math.Vector2(x + 14, y - 16),
  ]);
}

export function drawSpectators(scene: Phaser.Scene) {
  for (const pos of SPECTATOR_POSITIONS) {
    drawSpectator(scene, pos.x, pos.y);
  }
}

function drawSpectator(scene: Phaser.Scene, x: number, y: number) {
  const c = scene.add.container(x, y).setDepth(y + 1);
  const body = scene.add.ellipse(0, 8, 22, 24, 0x2f2f42);
  const cloak = scene.add.ellipse(0, 0, 28, 26, 0x4b3f6a);
  const head = scene.add.circle(0, -14, 10, 0xd6b89f);
  const wand = scene.add.rectangle(12, -4, 16, 3, 0x8b5e3c);
  c.add([body, cloak, head, wand]);
  const glow = scene.add.circle(0, -42, 5, 0xf8d672, 0.6);
  c.add(glow);
}
