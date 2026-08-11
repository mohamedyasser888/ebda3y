// ============================================================
// PotionLabScene — Alchemy Laboratory (1200×900)
// Mystical alchemy workspace with magical atmosphere
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }           from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { BUILDING_MAP }     from '../data/buildings';

const WORLD_W = 1200;
const WORLD_H = 900;

const DEFAULT_SPAWN_X = 600;
const DEFAULT_SPAWN_Y = 820;

// Alchemy table centre
const TABLE_X      = 600;
const TABLE_Y      = 480;
const TABLE_RADIUS = 120;

// Exit door
const EXIT_X      = 150;
const EXIT_Y      = 860;
const EXIT_RADIUS = 64;

// Colour palette
const STONE_DARK   = 0x2a2a44;
const STONE_LIGHT  = 0x3a3a5c;
const WALL_DARK    = 0x1a1a2e;
const WOOD_DARK    = 0x2c1810;
const WOOD_MID     = 0x8B4513;
const MAGIC_PURPLE = 0x9b59b6;
const GREEN_BREW   = 0x2ecc71;

const COLLIDERS: [number,number,number,number][] = [
  [0,   0,   WORLD_W, 60],
  [0,   0,   60,  WORLD_H],
  [WORLD_W-60,0, 60,  WORLD_H],
  [0,   WORLD_H-40,WORLD_W, 40],

  // Shelves
  [60,  60,  200, 120],
  [280, 60,  200, 120],
  [500, 60,  200, 120],
  [720, 60,  200, 120],
  [940, 60,  200, 120],

  // Alchemy table
  [480, 400, 240, 160],

  // Workbenches
  [60,  280, 160, 140],
  [WORLD_W-220,280,160, 140],

  // Barrels + chests
  [60,  700, 140, 140],
  [WORLD_W-200,700,140, 140],
];

export class PotionLabScene extends Phaser.Scene {
  private wizard!:        Wizard;
  private controller!:    PlayerController;
  private staticGroup!:   Phaser.Physics.Arcade.StaticGroup;
  private nearTable       = false;
  private nearExit        = false;
  private isTransitioning = false;
  private brewingOpen     = false;
  private unsubs:         Array<()=>void> = [];
  private currentPotionColor = GREEN_BREW;
  private baseZoom = 1.0;

  constructor() { super({ key: 'PotionLabScene' }); }

  create(data?: { buildingId?: string; spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearTable = false;
    this.nearExit  = false;
    this.brewingOpen = false;
    this.unsubs = [];
    this.currentPotionColor = GREEN_BREW;

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    this.physics.world.setBounds(60, 60, WORLD_W-120, WORLD_H-100);

    this._drawFloor();
    this._drawWalls();
    this._drawShelves();
    this._drawAlchemyTable();
    this._drawWorkbenches();
    this._drawBarrelsAndChests();
    this._drawExitDoor();
    this._createTableIndicator();
    this._createExitIndicator();
    this._spawnMysticalAtmosphere();

    this.staticGroup = this.physics.add.staticGroup();
    for (const [x,y,w,h] of COLLIDERS) {
      const r = this.add.rectangle(x+w/2, y+h/2, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.staticGroup.add(r);
    }

    this.wizard = new Wizard(this, spawnX, spawnY);
    const spr   = this.wizard.getSprite();
    spr.setDepth(20);
    this.physics.add.collider(spr, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => {
      if (this.nearTable && !this.brewingOpen && !this.isTransitioning) {
        this._openBrewing();
      } else if (this.nearExit && !this.isTransitioning) {
        this._exit(data?.buildingId);
      }
    });

    const { width, height } = this.cameras.main;
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(spr, true, 0.09, 0.09);
    
    const setZoomFunc = (w: number, h: number) => {
      this.baseZoom = Math.min(w / 1440, h / 810) * 1.0;
      if (!this.brewingOpen) {
        this.cameras.main.setZoom(this.baseZoom);
      }
    };
    setZoomFunc(width, height);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      setZoomFunc(gameSize.width, gameSize.height);
    });

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    const u1 = eventBus.on('CLOSE_BREWING', () => {
      this.brewingOpen = false;
      this.controller.setBlocked(false);
      this.tweens.add({ targets:this.cameras.main, zoom: this.baseZoom, duration:500, ease:'Cubic.easeOut' });
    });
    const u2 = eventBus.on('WIZARD_CELEBRATE', () => this.wizard.celebrate());
    const u3 = eventBus.on('WIZARD_SHAKE',     () => this.wizard.shake());
    this.unsubs.push(u1, u2, u3);

    eventBus.emit('SCENE_READY', { scene: 'PotionLabScene' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    this.controller.update(delta);
    const spr = this.wizard.getSprite();

    const dT = Phaser.Math.Distance.Between(spr.x, spr.y, TABLE_X, TABLE_Y);
    const wasT = this.nearTable;
    this.nearTable = dT < TABLE_RADIUS;
    if (this.nearTable !== wasT) eventBus.emit('PLAYER_NEAR_CAULDRON', { near: this.nearTable });

    const dE = Phaser.Math.Distance.Between(spr.x, spr.y, EXIT_X, EXIT_Y);
    const wasE = this.nearExit;
    this.nearExit = dE < EXIT_RADIUS;
    if (this.nearExit !== wasE) eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'outdoor' });
  }

  shutdown() { for (const u of this.unsubs) u(); this.unsubs = []; }

  private _drawFloor() {
    const g = this.add.graphics().setDepth(0);

    // Dark stone checker (48×48px)
    for (let tx = 0; tx < WORLD_W/48; tx++) {
      for (let ty = 0; ty < WORLD_H/48; ty++) {
        const col = (tx + ty) % 2 === 0 ? STONE_LIGHT : STONE_DARK;
        g.fillStyle(col);
        g.fillRect(tx*48, ty*48, 48, 48);
      }
    }

    // Grout lines
    g.lineStyle(2, WALL_DARK, 0.3);
    for (let x = 0; x <= WORLD_W; x += 48) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += 48) g.lineBetween(0, y, WORLD_W, y);

    // Worn marks (8 random patches)
    g.fillStyle(STONE_LIGHT, 0.15);
    [[200,150],[450,320],[750,280],[980,520],[340,650],[680,720],[920,380],[180,580]].forEach(([x,y]) => {
      g.fillEllipse(x, y, 40, 30);
    });

    // Magical rune circle around cauldron
    const runeContainer = this.add.container(TABLE_X, TABLE_Y).setDepth(1);
    
    const outerRing = this.add.graphics();
    outerRing.lineStyle(3, MAGIC_PURPLE);
    outerRing.strokeCircle(0, 0, 220);
    
    const innerRing = this.add.graphics();
    innerRing.lineStyle(1, 0x7d3c98);
    innerRing.strokeCircle(0, 0, 180);
    
    // 6-pointed star
    const star = this.add.graphics();
    star.lineStyle(2, MAGIC_PURPLE, 0.6);
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * Math.PI * 2;
      const a2 = ((i + 3) / 6) * Math.PI * 2;
      star.lineBetween(
        Math.cos(a1) * 180, Math.sin(a1) * 180,
        Math.cos(a2) * 180, Math.sin(a2) * 180
      );
    }
    
    // 8 rune symbols
    const runes = this.add.graphics();
    runes.fillStyle(MAGIC_PURPLE, 0.7);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 200;
      const y = Math.sin(a) * 200;
      
      // Different rune shapes
      if (i % 4 === 0) runes.fillCircle(x, y, 4);
      else if (i % 4 === 1) runes.fillTriangle(x-4, y+4, x+4, y+4, x, y-4);
      else if (i % 4 === 2) runes.fillRect(x-4, y-4, 8, 8);
      else runes.fillEllipse(x, y, 8, 4);
    }

    runeContainer.add([outerRing, innerRing, star, runes]);
    
    // Slow rotation
    this.tweens.add({
      targets: runeContainer,
      rotation: Math.PI * 2,
      duration: 20000,
      repeat: -1,
      ease: 'Linear'
    });

    // Purple glow pool
    const glowPool = this.add.circle(TABLE_X, TABLE_Y, 240, MAGIC_PURPLE, 0.08).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glowPool,
      alpha: { from: 0.05, to: 0.12 },
      duration: 2000,
      yoyo: true,
      repeat: -1
    });
  }

  private _drawWalls() {
    const g = this.add.graphics().setDepth(1);

    // North wall - stone blocks
    for (let bx = 0; bx < WORLD_W; bx += 100) {
      for (let by = 0; by < 60; by += 50) {
        const shade = 0x2d2d44 + (Math.random() * 0x100000);
        g.fillStyle(shade);
        g.fillRect(bx, by, 100, 50);
        g.lineStyle(2, WALL_DARK);
        g.strokeRect(bx, by, 100, 50);
      }
    }

    // Wall stains
    g.fillStyle(WALL_DARK, 0.2);
    [[120, 10], [480, 20], [780, 15], [1050, 18]].forEach(([x, y]) => {
      g.fillRect(x, y, 60, 35);
    });

    // West + East walls
    g.fillStyle(WALL_DARK);
    g.fillRect(0, 0, 60, WORLD_H);
    g.fillRect(WORLD_W-60, 0, 60, WORLD_H);

    // Wall torches
    [[150, 78], [600, 78], [1050, 78]].forEach(([tx, ty]) => {
      this._drawWallTorch(tx, ty);
    });

    // Wall runes
    g.fillStyle(MAGIC_PURPLE, 0.4);
    [[80, 200], [180, 240], [WORLD_W-100, 220], [WORLD_W-180, 260]].forEach(([rx, ry]) => {
      g.fillCircle(rx, ry, 3);
      g.fillTriangle(rx-6, ry+8, rx+6, ry+8, rx, ry-8);
    });
  }

  private _drawWallTorch(x: number, y: number) {
    const g = this.add.graphics().setDepth(2);
    
    // Bracket
    g.fillStyle(0x444444);
    g.fillRect(x-4, y-12, 8, 14);
    
    // Flame layers
    const flame1 = this.add.ellipse(x, y-20, 12, 16, 0xff6b35, 0.9).setDepth(3);
    const flame2 = this.add.ellipse(x, y-24, 8, 12, 0xf9ca24, 0.8).setDepth(3);
    const flame3 = this.add.ellipse(x, y-26, 4, 8, 0xffffff, 0.6).setDepth(3);

    [flame1, flame2, flame3].forEach((f, i) => {
      this.tweens.add({
        targets: f,
        scaleY: { from: 0.9, to: 1.2 },
        alpha: { from: f.alpha - 0.1, to: f.alpha + 0.1 },
        duration: 400 + i * 100,
        yoyo: true,
        repeat: -1
      });
    });

    // Light pool on wall
    const light = this.add.circle(x, y, 80, 0xff6b35, 0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: light,
      alpha: { from: 0.06, to: 0.12 },
      duration: 600,
      yoyo: true,
      repeat: -1
    });
  }

  private _drawShelves() {
    const g = this.add.graphics().setDepth(3);
    
    const sections = [
      [60, 60, 200], [280, 60, 200], [500, 60, 200], [720, 60, 200], [940, 60, 200]
    ];

    // 20 unique ingredient bottles
    const bottles = [
      { name: 'mint-leaves', x: 100, y: 100, type: 'tall-thin', color: 0x2ecc71 },
      { name: 'fairy-dust', x: 140, y: 105, type: 'bubble', color: 0xff69b4 },
      { name: 'unicorn-hair', x: 180, y: 95, type: 'elegant', color: 0xe8d5f5 },
      { name: 'red-mushroom', x: 220, y: 110, type: 'squat', color: 0x8B0000 },
      { name: 'crystal-powder', x: 320, y: 100, type: 'angular', color: 0x00bcd4 },
      { name: 'moon-flower', x: 360, y: 105, type: 'crescent', color: 0xb0c4de },
      { name: 'glow-berry', x: 400, y: 112, type: 'round', color: 0xff8c00 },
      { name: 'dragon-scale', x: 440, y: 100, type: 'armored', color: 0x8B0000 },
      { name: 'golden-herb', x: 540, y: 105, type: 'teardrop', color: 0xDAA520 },
      { name: 'magic-crystal', x: 580, y: 95, type: 'hexagon', color: 0x9b59b6 },
      { name: 'spider-silk', x: 620, y: 98, type: 'dark-narrow', color: 0x1a1a2e },
      { name: 'lavender', x: 660, y: 108, type: 'rounded', color: 0xdda0dd },
      { name: 'bat-wing', x: 760, y: 100, type: 'gothic', color: 0x0d0d0d },
      { name: 'unicorn-tears', x: 800, y: 95, type: 'delicate', color: 0x87ceeb },
      { name: 'moonwater', x: 840, y: 110, type: 'wide-flat', color: 0xc0c0c0 },
      { name: 'mandrake-root', x: 880, y: 108, type: 'earthy', color: 0x556b2f },
      { name: 'phoenix-feather', x: 980, y: 100, type: 'flame', color: 0xff4500 },
      { name: 'starlight-petal', x: 1020, y: 105, type: 'star', color: 0xfffff0 },
      { name: 'rose-essence', x: 1060, y: 108, type: 'rose', color: 0xff1493 },
      { name: 'dreamroot', x: 1100, y: 102, type: 'swirl', color: 0x7b2fff },
    ];

    sections.forEach(([sx, sy, sw]) => {
      // Frame
      g.fillStyle(WOOD_DARK);
      g.fillRect(sx, sy, sw, 120);
      g.fillStyle(0x2d1508);
      g.fillRect(sx+4, sy+4, sw-8, 112);

      // Shelf boards
      g.fillStyle(0x5a3015);
      [35, 70, 105].forEach(yOff => {
        g.fillRect(sx+2, sy+yOff, sw-4, 3);
        g.fillStyle(0x7a5230, 0.4);
        g.fillRect(sx+2, sy+yOff, sw-4, 1);
        g.fillStyle(0x5a3015);
      });
    });

    // Draw unique bottles
    bottles.forEach(bottle => {
      this._drawUniqueBottle(bottle.x, bottle.y, bottle.type, bottle.color);
    });
  }

  private _drawUniqueBottle(x: number, y: number, type: string, color: number) {
    const g = this.add.graphics().setDepth(4);
    
    switch(type) {
      case 'tall-thin':
        g.fillStyle(color, 0.9);
        g.fillRect(x-5, y, 10, 40);
        g.fillCircle(x, y-2, 3);
        break;
      case 'bubble':
        g.fillStyle(color, 0.9);
        g.fillCircle(x, y+9, 18);
        g.fillCircle(x, y-5, 6);
        // Glitter
        g.fillStyle(0xffffff, 0.6);
        [[x-4, y+4], [x+6, y+8], [x-2, y+12], [x+4, y+2]].forEach(([gx, gy]) => {
          g.fillCircle(gx, gy, 1);
        });
        break;
      case 'elegant':
        g.fillStyle(color, 0.9);
        g.fillRect(x-6, y, 12, 45);
        g.fillEllipse(x, y-3, 8, 5);
        // Rainbow shimmer
        const shimmer = this.add.circle(x, y+20, 15, 0xffffff, 0.2).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: shimmer,
          alpha: { from: 0.1, to: 0.3 },
          duration: 1200,
          yoyo: true,
          repeat: -1
        });
        break;
      case 'squat':
        g.fillStyle(color, 0.9);
        g.fillRect(x-14, y+10, 28, 22);
        g.fillEllipse(x, y+8, 28, 6);
        // Mushroom cap etched
        g.lineStyle(1, 0x000000, 0.4);
        g.strokeCircle(x, y+18, 8);
        break;
      case 'angular':
        g.fillStyle(color, 0.9);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x-8, y+15);
        g.lineTo(x-6, y+35);
        g.lineTo(x+6, y+35);
        g.lineTo(x+8, y+15);
        g.closePath();
        g.fillPath();
        break;
      case 'crescent':
        g.fillStyle(color, 0.9);
        g.arc(x, y+15, 16, Math.PI * 0.3, Math.PI * 1.7);
        g.fillPath();
        break;
      case 'round':
        g.fillStyle(color, 0.9);
        g.fillCircle(x, y+14, 14);
        g.fillCircle(x, y+2, 4);
        // Pulsing glow
        const glow = this.add.circle(x, y+14, 18, color, 0).setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.3, to: 0.7 },
          duration: 1000,
          yoyo: true,
          repeat: -1
        });
        break;
      case 'hexagon':
        g.fillStyle(color, 0.9);
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          g.lineTo(x + Math.cos(a) * 10, y + 20 + Math.sin(a) * 10);
        }
        g.closePath();
        g.fillPath();
        g.fillRect(x-10, y, 20, 20);
        break;
      case 'star':
        g.fillStyle(color, 0.9);
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? 12 : 6;
          if (i === 0) g.moveTo(x + Math.cos(a) * r, y + 15 + Math.sin(a) * r);
          else g.lineTo(x + Math.cos(a) * r, y + 15 + Math.sin(a) * r);
        }
        g.closePath();
        g.fillPath();
        break;
      default:
        // Default bottle
        g.fillStyle(color, 0.9);
        g.fillRect(x-6, y+5, 12, 28);
        g.fillCircle(x, y+3, 4);
    }

    // Label
    g.fillStyle(0xf5e6c8);
    g.fillRect(x-8, y+38, 16, 6);

    // Ambient glow
    const ambientGlow = this.add.circle(x, y+20, 20, color, 0).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
    ambientGlow.setAlpha(0.15);
  }

  private _drawAlchemyTable() {
    const g = this.add.graphics().setDepth(5);
    const tx = TABLE_X, ty = TABLE_Y;

    // Stone trivet platform
    g.fillStyle(0x555555);
    g.fillRect(tx-120, ty-80, 240, 160);
    g.fillStyle(0x666666);
    g.fillRect(tx-116, ty-76, 232, 152);
    
    // Corner stone pillars
    g.fillStyle(0x444444);
    [[tx-120,ty-80],[tx+116,ty-80],[tx-120,ty+76],[tx+116,ty+76]].forEach(([cx,cy]) => {
      g.fillRect(cx-8, cy-8, 16, 16);
    });

    // 3 curved iron legs
    g.lineStyle(8, 0x111111);
    [[-30, 0], [30, 0], [0, 35]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(tx+dx, ty+dy, 40, 0, Math.PI, false);
      g.strokePath();
    });

    // Cauldron body
    g.fillStyle(0x2d2d44);
    g.fillEllipse(tx, ty, 120, 100);
    g.fillStyle(0x1a1a1a);
    g.fillEllipse(tx, ty-4, 116, 94);

    // Rim
    g.lineStyle(6, 0x333333);
    g.strokeEllipse(tx, ty-18, 100, 36);

    // Liquid surface - COLOR CHANGES
    const liquid = this.add.ellipse(tx, ty-22, 90, 28, this.currentPotionColor, 0.85).setDepth(6);
    this.tweens.add({
      targets: liquid,
      alpha: { from: 0.8, to: 1.0 },
      scaleX: { from: 1.0, to: 1.05 },
      duration: 1500,
      yoyo: true,
      repeat: -1
    });

    // Bubbles (6 particles)
    for (let i = 0; i < 6; i++) {
      const bubble = this.add.circle(
        tx + (Math.random() - 0.5) * 60,
        ty - 10,
        2 + Math.random() * 2,
        0xffffff,
        0.6
      ).setDepth(7);

      this.tweens.add({
        targets: bubble,
        y: ty - 40,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        delay: i * 150,
        repeat: -1
      });
    }

    // Fire beneath (4 layers)
    const fireY = ty + 52;
    const fire1 = this.add.ellipse(tx, fireY, 70, 30, 0xff6b35, 0.9).setDepth(4);
    const fire2 = this.add.ellipse(tx, fireY-6, 50, 24, 0xf9ca24, 0.8).setDepth(4);
    const fire3 = this.add.ellipse(tx, fireY-10, 32, 18, 0xfff176, 0.7).setDepth(4);
    const fire4 = this.add.ellipse(tx, fireY-14, 18, 12, 0xffffff, 0.6).setDepth(4);

    [fire1, fire2, fire3, fire4].forEach((f, i) => {
      this.tweens.add({
        targets: f,
        scaleY: { from: 0.8, to: 1.3 },
        duration: 280 + i * 60,
        yoyo: true,
        repeat: -1
      });
    });

    // Steam above
    for (let i = 0; i < 3; i++) {
      const steam = this.add.ellipse(
        tx + (i - 1) * 20,
        ty - 35,
        12, 6,
        0xaaaaaa,
        0.3
      ).setDepth(7);

      this.tweens.add({
        targets: steam,
        y: ty - 60,
        alpha: 0,
        duration: 1200,
        delay: i * 400,
        repeat: -1
      });
    }

    // Cauldron handles
    g.fillStyle(0x444444);
    g.fillEllipse(tx-62, ty-10, 18, 32);
    g.fillEllipse(tx+62, ty-10, 18, 32);
    g.fillStyle(STONE_DARK);
    g.fillEllipse(tx-62, ty-10, 8, 20);
    g.fillEllipse(tx+62, ty-10, 8, 20);
  }

  private _drawWorkbenches() {
    const g = this.add.graphics().setDepth(5);

    // West workbench
    g.fillStyle(WOOD_DARK);
    g.fillRect(60, 280, 160, 140);
    g.fillStyle(WOOD_MID);
    g.fillRect(64, 284, 152, 132);

    // Mortar & pestle
    g.fillStyle(0x666666);
    g.fillCircle(120, 330, 20);
    g.fillStyle(0x555555);
    g.fillCircle(120, 330, 16);
    g.fillStyle(WOOD_MID);
    g.fillRect(118, 310, 4, 25);
    g.fillEllipse(120, 308, 10, 6);

    // Distiller
    g.lineStyle(2, 0x87ceeb, 0.7);
    g.lineBetween(140, 300, 140, 350);
    g.fillStyle(0x87ceeb, 0.6);
    g.fillCircle(140, 360, 12);

    // Open tome (left and right pages)
    g.fillStyle(0xf5e6c8);
    g.fillRect(158, 325, 18, 30); // Left page
    g.fillRect(182, 325, 18, 30); // Right page
    g.lineStyle(1, 0x8B4513);
    g.lineBetween(180, 325, 180, 355); // Spine

    // East workbench
    g.fillStyle(WOOD_DARK);
    g.fillRect(WORLD_W-220, 280, 160, 140);
    g.fillStyle(WOOD_MID);
    g.fillRect(WORLD_W-216, 284, 152, 132);

    // Display: completed potions
    const potionColors = [0xe74c3c, 0x3498db, 0xe67e22, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xff4500, 0x1abc9c];
    potionColors.forEach((col, i) => {
      const px = WORLD_W - 200 + (i % 4) * 28;
      const py = 300 + Math.floor(i / 4) * 60;
      g.fillStyle(col, 0.9);
      g.fillRect(px, py, 10, 24);
      g.fillCircle(px+5, py-2, 3);
    });

    // Crystal specimens
    [[WORLD_W-140, 340], [WORLD_W-100, 335], [WORLD_W-170, 350]].forEach(([cx, cy]) => {
      g.fillStyle(0x00bcd4, 0.7);
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
      }
      g.closePath();
      g.fillPath();
    });
  }

  private _drawBarrelsAndChests() {
    const g = this.add.graphics().setDepth(5);

    // SW barrel cluster
    [[90, 740], [140, 760], [90, 800]].forEach(([bx, by]) => {
      // Shadow
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(bx, by+35, 50, 16);
      
      // Barrel body
      g.fillStyle(WOOD_DARK);
      g.fillRect(bx-25, by, 50, 70);
      g.fillStyle(WOOD_MID);
      g.fillRect(bx-21, by+4, 42, 62);
      
      // Metal bands
      g.fillStyle(0x888888);
      g.fillRect(bx-27, by+18, 54, 4);
      g.fillRect(bx-27, by+48, 54, 4);
    });

    // SE chest cluster
    [[WORLD_W-160, 740], [WORLD_W-120, 780]].forEach(([cx, cy]) => {
      g.fillStyle(WOOD_DARK);
      g.fillRect(cx, cy, 70, 65);
      g.fillStyle(WOOD_MID);
      g.fillRect(cx+3, cy+3, 64, 59);
      
      // Gold latch
      g.fillStyle(0xd4af37);
      g.fillRect(cx+24, cy+28, 22, 8);
      g.fillCircle(cx+35, cy+32, 4);
      
      // Amber glow from crack
      const glow = this.add.rectangle(cx+35, cy+62, 40, 2, 0xdaa520, 0.6).setDepth(6);
    });
  }

  private _drawExitDoor() {
    const g = this.add.graphics().setDepth(5);
    const dx = EXIT_X - 40;

    g.fillStyle(WOOD_DARK);
    g.fillRect(dx, WORLD_H-40, 80, 40);
    g.fillStyle(WOOD_MID);
    g.fillRect(dx+3, WORLD_H-38, 36, 36);
    g.fillRect(dx+43, WORLD_H-38, 34, 36);
    
    // Iron bands
    g.fillStyle(0x444444);
    g.fillRect(dx, WORLD_H-30, 80, 3);
    g.fillRect(dx, WORLD_H-15, 80, 3);

    g.fillStyle(0xd4af37);
    g.fillCircle(dx+36, WORLD_H-20, 3);
    g.fillCircle(dx+44, WORLD_H-20, 3);
  }

  private _createTableIndicator() {
    const glow = this.add.circle(TABLE_X, TABLE_Y, 55, GREEN_BREW, 0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      fillAlpha: 0.16,
      radius: 72,
      duration: 1300,
      yoyo: true,
      repeat: -1
    });

    // Rising sparkles
    for (let i = 0; i < 14; i++) {
      const sparkle = this.add.circle(
        TABLE_X + (Math.random() - 0.5) * 80,
        TABLE_Y - 20,
        3 + Math.random() * 4,
        0x4ade80,
        0.7
      ).setDepth(3);

      this.tweens.add({
        targets: sparkle,
        y: sparkle.y - 50 - Math.random() * 30,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        duration: 700 + Math.random() * 600,
        delay: Math.random() * 1000,
        repeat: -1,
        onRepeat: () => {
          sparkle.setPosition(TABLE_X + (Math.random() - 0.5) * 80, TABLE_Y - 20);
          sparkle.setAlpha(0.7).setScale(1);
        }
      });
    }

    const label = this.add.text(TABLE_X, TABLE_Y - 110, '⚗️ Press E to Brew', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '8px',
      color: '#86efac',
      stroke: '#0a1a0a',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(6);

    this.tweens.add({
      targets: label,
      y: TABLE_Y - 115,
      alpha: { from: 0.6, to: 1.0 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    });
  }

  private _createExitIndicator() {
    const glow = this.add.circle(EXIT_X, EXIT_Y-20, 28, 0x2ecc71, 0).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      fillAlpha: 0.22,
      radius: 42,
      duration: 1100,
      yoyo: true,
      repeat: -1
    });

    const label = this.add.text(EXIT_X, EXIT_Y-50, '← Press E to Exit', {
      fontFamily: 'Press Start 2P, monospace',
      fontSize: '7px',
      color: '#f0cd60',
      stroke: '#1a0533',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(7);

    this.tweens.add({
      targets: label,
      alpha: { from: 0.65, to: 1.0 },
      duration: 900,
      yoyo: true,
      repeat: -1
    });
  }

  private _spawnMysticalAtmosphere() {
    // Floating scrolls
    [[300, 200], [700, 220], [950, 180]].forEach(([sx, sy], i) => {
      const scroll = this.add.container(sx, sy).setDepth(8);
      const body = this.add.rectangle(0, 0, 30, 12, 0xf5e6c8);
      const roll1 = this.add.circle(-16, 0, 4, WOOD_DARK);
      const roll2 = this.add.circle(16, 0, 4, WOOD_DARK);
      scroll.add([body, roll1, roll2]);

      this.tweens.add({
        targets: scroll,
        y: sy + 8,
        duration: 2500,
        yoyo: true,
        repeat: -1,
        delay: i * 800
      });
    });

    // Glowing crystals in corners
    [[100, 650], [WORLD_W-100, 650], [100, 200], [WORLD_W-100, 200]].forEach(([cx, cy]) => {
      const g = this.add.graphics().setDepth(8);
      g.fillStyle(0x00bcd4, 0.8);
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
      }
      g.closePath();
      g.fillPath();

      const glow = this.add.circle(cx, cy, 25, 0x00bcd4, 0).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.3 },
        duration: 1800,
        yoyo: true,
        repeat: -1
      });
    });

    // Magical motes floating upward
    for (let i = 0; i < 10; i++) {
      const mote = this.add.circle(
        200 + Math.random() * 800,
        700,
        2 + Math.random() * 2,
        i % 2 === 0 ? MAGIC_PURPLE : 0x3498db,
        0.7
      ).setDepth(9);

      this.tweens.add({
        targets: mote,
        y: 100,
        alpha: 0,
        duration: 4000 + Math.random() * 2000,
        delay: Math.random() * 3000,
        repeat: -1,
        onRepeat: () => {
          mote.setY(700);
          mote.setAlpha(0.7);
        }
      });
    }

    // Constellation map on east wall
    const stars = [[WORLD_W-120, 400], [WORLD_W-100, 420], [WORLD_W-140, 440], [WORLD_W-110, 460]];
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x3498db, 0.6);
    stars.forEach(([sx, sy]) => g.fillCircle(sx, sy, 2));
    g.lineStyle(1, 0x3498db, 0.4);
    for (let i = 0; i < stars.length - 1; i++) {
      g.lineBetween(stars[i][0], stars[i][1], stars[i+1][0], stars[i+1][1]);
    }

    // Ambient runes
    const runes = ['✦', '⊕', '◈', '✧', '⟡'];
    for (let i = 0; i < 14; i++) {
      const rune = this.add.text(
        200 + Math.random() * 800,
        200 + Math.random() * 500,
        runes[i % runes.length],
        {
          fontFamily: 'Press Start 2P, monospace',
          fontSize: '6px',
          color: '#7b3fc4'
        }
      ).setAlpha(0).setDepth(1);

      this.tweens.add({
        targets: rune,
        alpha: 0.25,
        y: rune.y - 38,
        duration: 2500 + Math.random() * 2000,
        delay: Math.random() * 3000,
        yoyo: true,
        repeat: -1
      });
    }
  }

  private _openBrewing() {
    this.brewingOpen = true;
    this.controller.setBlocked(true);
    this._playMagicSound();
    const z = this.cameras.main.zoom;
    this.tweens.add({
      targets: this.cameras.main,
      zoom: z * 1.18,
      duration: 500,
      ease: 'Cubic.easeInOut',
      onComplete: () => eventBus.emit('OPEN_BREWING')
    });
  }

  private _exit(buildingId?: string) {
    this.isTransitioning = true;
    this.controller.setBlocked(true);
    eventBus.emit('PLAYER_NEAR_CAULDRON', { near: false });
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    this._playDoorSound();
    this.cameras.main.fadeOut(480, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const b = buildingId ? BUILDING_MAP[buildingId] : null;
      this.scene.start('OutdoorWorldScene', { returnX: b?.returnX, returnY: b?.returnY });
    });
  }

  private _playMagicSound() {
    try {
      const ctx = new AudioContext();
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = f;
        const t = ctx.currentTime + i * 0.09;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.14, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t); o.stop(t + 0.35);
        if (i === 3) o.onended = () => ctx.close();
      });
    } catch {/*silence*/}
  }

  private _playDoorSound() {
    try {
      const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      o.frequency.setValueAtTime(330, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(165, ctx.currentTime + 0.5);
      g.gain.setValueAtTime(0.14, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.start(); o.stop(ctx.currentTime + 0.6);
      o.onended = () => ctx.close();
    } catch {/*silence*/}
  }
}
