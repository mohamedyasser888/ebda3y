// ============================================================
// CommonRoomScene — Hufflepuff Common Room (1200×900)
// Cozy magical gathering space with Hufflepuff theming
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }           from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { BUILDING_MAP }     from '../data/buildings';

// ── World dimensions ──────────────────────────────────────
const WORLD_W = 1200;
const WORLD_H = 900;

// ── Spawn: player enters from bottom-centre ──────────────
const DEFAULT_SPAWN_X = 600;
const DEFAULT_SPAWN_Y = 820;

// ── Exit door — bottom wall, centre ──────────────────────
const EXIT_X      = 600;
const EXIT_Y      = 860;
const EXIT_RADIUS = 64;

// ── Colour palette ────────────────────────────────────────
const FLOOR_A  = 0x8b5e3c;   // warm oak plank
const FLOOR_B  = 0x7a5230;   // darker oak
const WOOD_DK  = 0x2c1810;   // very dark wood
const WALL_COL = 0x3d1f0a;   // dark brown paneling
const WALL_LT  = 0x5a3015;   // lighter panel stripe
const HUFF_Y   = 0xf0c75e;   // Hufflepuff yellow
const HUFF_B   = 0x372e29;   // Hufflepuff black
const GOLD     = 0xf4d03f;   // gold accents

// ── Collision rectangles [x, y, w, h] ────────────────────
const COLLIDERS: [number,number,number,number][] = [
  // Boundary walls
  [0,   0,   WORLD_W, 60],      // north wall
  [0,   0,   60,  WORLD_H],     // west wall
  [WORLD_W-60,0, 60,  WORLD_H], // east wall
  [0,   WORLD_H-40,WORLD_W, 40],// south wall

  // Bookshelf row — north wall
  [60,  60,  180, 100],
  [260, 60,  180, 100],
  [460, 60,  180, 100],
  [660, 60,  180, 100],
  [860, 60,  180, 100],
  [1060,60,  80,  100],

  // Fireplace (NW corner)
  [40,  40,  160, 160],

  // Sofas (west + east)
  [40,  350, 160, 200],         // west sofa
  [WORLD_W-200,350,160, 200],   // east sofa

  // Coffee table (centre)
  [480, 400, 240, 120],

  // Armchairs
  [360, 420, 100, 100],
  [740, 420, 100, 100],

  // Plant pots (corners)
  [60,  700, 60,  60],
  [WORLD_W-120,700,60,  60],

  // Notice board (east wall)
  [WORLD_W-140,250,80,  150],

  // Side table (west wall)
  [60,  620, 140, 80],
];

export class CommonRoomScene extends Phaser.Scene {
  private wizard!:        Wizard;
  private controller!:    PlayerController;
  private staticGroup!:   Phaser.Physics.Arcade.StaticGroup;
  private nearExit        = false;
  private isTransitioning = false;

  constructor() { super({ key: 'CommonRoomScene' }); }

  create(data?: { buildingId?: string; spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit        = false;

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    // Physics covers full floor
    this.physics.world.setBounds(60, 60, WORLD_W - 120, WORLD_H - 100);

    // ── Draw the flat top-down map ────────────────────────
    this._drawFloor();
    this._drawWalls();
    this._drawBookshelf();
    this._drawFireplace();
    this._drawRug();
    this._drawFurniture();
    this._drawHufflepuffDetails();
    this._drawExitDoor();

    // ── Collision static bodies ───────────────────────────
    this.staticGroup = this.physics.add.staticGroup();
    for (const [x,y,w,h] of COLLIDERS) {
      const r = this.add.rectangle(x+w/2, y+h/2, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.staticGroup.add(r);
    }

    // ── Exit indicator ────────────────────────────────────
    this._createExitIndicator();

    // ── Wizard ───────────────────────────────────────────
    this.wizard = new Wizard(this, spawnX, spawnY);
    const spr   = this.wizard.getSprite();
    spr.setDepth(20);
    this.physics.add.collider(spr, this.staticGroup);

    // ── Controller ───────────────────────────────────────
    this.controller = new PlayerController(this, this.wizard, () => {
      if (this.nearExit && !this.isTransitioning) this._exit(data?.buildingId);
    });

    // ── Camera ───────────────────────────────────────────
    const { width, height } = this.cameras.main;
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(spr, true, 0.09, 0.09);
    
    const setZoomFunc = (w: number, h: number) => {
      const zoom = Math.min(w / 1440, h / 810) * 1.0;
      this.cameras.main.setZoom(zoom);
    };
    setZoomFunc(width, height);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      setZoomFunc(gameSize.width, gameSize.height);
    });
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    eventBus.emit('SCENE_READY', { scene: 'CommonRoomScene' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    this.controller.update(delta);

    const spr  = this.wizard.getSprite();
    const dist = Phaser.Math.Distance.Between(spr.x, spr.y, EXIT_X, EXIT_Y);
    const was  = this.nearExit;
    this.nearExit = dist < EXIT_RADIUS;
    if (this.nearExit !== was) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'outdoor' });
    }
  }

  private _exit(buildingId?: string) {
    this.isTransitioning = true;
    this.controller.setBlocked(true);
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    this._playDoorSound();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const b = buildingId ? BUILDING_MAP[buildingId] : null;
      this.scene.start('OutdoorWorldScene', { returnX: b?.returnX, returnY: b?.returnY });
    });
  }

  // ── Floor: warm wooden planks ────────────────────────────
  private _drawFloor() {
    const g = this.add.graphics().setDepth(0);

    // Base warm floor colour
    g.fillStyle(FLOOR_A);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Horizontal plank strips (40px tall each)
    for (let y = 0; y < WORLD_H; y += 40) {
      const col = (y / 40) % 2 === 0 ? FLOOR_A : FLOOR_B;
      g.fillStyle(col);
      g.fillRect(0, y, WORLD_W, 40);
      
      // Gap line between planks
      g.fillStyle(WOOD_DK);
      g.fillRect(0, y + 39, WORLD_W, 1);
      
      // Lighter top highlight
      g.fillStyle(0xaa7755, 0.3);
      g.fillRect(0, y, WORLD_W, 1);
    }

    // Random wood knots (dark ellipses)
    g.fillStyle(WOOD_DK, 0.4);
    const knotPositions = [
      [180, 120], [450, 280], [720, 150], [920, 380], [340, 520],
      [580, 420], [850, 680], [220, 760], [1050, 240], [130, 590],
      [770, 570], [480, 710], [990, 470], [290, 350], [640, 810],
    ];
    knotPositions.forEach(([x, y]) => {
      g.fillEllipse(x, y, 8, 6);
    });
  }

  // ── Walls: dark wood panelling ──────────────────────────
  private _drawWalls() {
    const g = this.add.graphics().setDepth(1);

    // North wall panelling (y=0 to y=120)
    g.fillStyle(WALL_COL);
    g.fillRect(0, 0, WORLD_W, 120);

    // Vertical panels every 80px
    for (let x = 0; x < WORLD_W; x += 80) {
      // Lighter left edge
      g.fillStyle(WALL_LT, 0.4);
      g.fillRect(x, 8, 3, 105);
      
      // Darker right shadow
      g.fillStyle(WOOD_DK, 0.3);
      g.fillRect(x + 77, 8, 3, 105);
    }

    // Gold chair rail molding at y=120
    g.fillStyle(GOLD);
    g.fillRect(0, 118, WORLD_W, 4);
    g.fillStyle(GOLD, 0.4);
    g.fillRect(0, 120, WORLD_W, 2);

    // West wall strip
    g.fillStyle(WALL_COL);
    g.fillRect(0, 0, 60, WORLD_H);
    g.fillStyle(WALL_LT, 0.3);
    g.fillRect(55, 0, 5, WORLD_H);

    // East wall strip
    g.fillStyle(WALL_COL);
    g.fillRect(WORLD_W-60, 0, 60, WORLD_H);
    g.fillStyle(WALL_LT, 0.3);
    g.fillRect(WORLD_W-60, 0, 5, WORLD_H);
  }

  // ── Bookshelf on north wall ─────────────────────────────
  private _drawBookshelf() {
    const g = this.add.graphics().setDepth(2);
    
    const shelfSections = [
      [60, 60, 180],
      [260, 60, 180],
      [460, 60, 180],
      [660, 60, 180],
      [860, 60, 180],
      [1060, 60, 80],
    ];

    shelfSections.forEach(([sx, sy, sw]) => {
      // Heavy frame
      g.fillStyle(WOOD_DK);
      g.fillRect(sx, sy, sw, 100);
      g.fillStyle(0x2d1508);
      g.fillRect(sx+4, sy+4, sw-8, 92);

      // 3 shelf boards
      g.fillStyle(WALL_LT);
      [28, 56, 84].forEach(yOffset => {
        g.fillRect(sx+2, sy+yOffset, sw-4, 3);
      });

      // Row 1: Tall books (varied colors)
      const colors1 = [0xc0192c, 0x1a5276, 0x0c5c35, 0x7b3fc4, 0x8b0000];
      for (let i = 0; i < Math.floor((sw-12)/20); i++) {
        const bx = sx + 8 + i * 20;
        const bw = 14 + Math.random() * 6;
        g.fillStyle(colors1[i % colors1.length]);
        g.fillRect(bx, sy+8, bw, 18);
        // Spine highlight
        g.fillStyle(0xffffff, 0.2);
        g.fillRect(bx, sy+8, 1, 18);
        // Title lines
        g.fillStyle(0x000000, 0.3);
        g.fillRect(bx+2, sy+12, bw-4, 1);
      }

      // Row 2: Medium books (earthy tones)
      const colors2 = [0xd4a373, 0x8b6914, 0xb87333, 0x6b8e23];
      for (let i = 0; i < Math.floor((sw-12)/18); i++) {
        const bx = sx + 8 + i * 18;
        g.fillStyle(colors2[i % colors2.length]);
        g.fillRect(bx, sy+36, 14, 16);
        g.fillStyle(0xffffff, 0.2);
        g.fillRect(bx, sy+36, 1, 16);
      }

      // Row 3: Short books (pastels)
      const colors3 = [0xffd1dc, 0xe6e6fa, 0xd8bfd8, 0xffdab9];
      for (let i = 0; i < Math.floor((sw-12)/16); i++) {
        const bx = sx + 8 + i * 16;
        g.fillStyle(colors3[i % colors3.length]);
        g.fillRect(bx, sy+64, 12, 14);
        g.fillStyle(0xffffff, 0.2);
        g.fillRect(bx, sy+64, 1, 14);
      }

      // Bookend every section
      g.fillStyle(0x2a2a2a);
      g.fillRect(sx+4, sy+6, 6, 72);
      g.fillRect(sx+sw-10, sy+6, 6, 72);
    });

    // Floating books (3 total)
    [[350, 30, 0x7b3fc4], [700, 35, 0x1a5276], [1000, 32, 0xc0192c]].forEach(([x, y, col]) => {
      const book = this.add.container(x, y).setDepth(3);
      const left = this.add.rectangle(-8, 0, 14, 20, col);
      const right = this.add.rectangle(8, 0, 14, 20, col);
      book.add([left, right]);
      
      this.tweens.add({
        targets: book,
        y: y + 6,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // Enchanted portraits (2 on wall)
    [[240, 20], [840, 20]].forEach(([px, py]) => {
      // Gold frame
      g.fillStyle(GOLD);
      g.fillRect(px, py, 50, 60);
      // Dark interior
      g.fillStyle(0x1a0a02);
      g.fillRect(px+4, py+4, 42, 52);
      // Figure silhouette
      g.fillStyle(HUFF_Y, 0.6);
      g.fillCircle(px+25, py+22, 8);
      g.fillRect(px+17, py+30, 16, 22);
      
      // Subtle glow
      const glow = this.add.circle(px+25, py+30, 30, GOLD, 0);
      glow.setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0, to: 0.12 },
        duration: 1500,
        yoyo: true,
        repeat: -1
      });
    });
  }

  // ── Fireplace (NW corner) ───────────────────────────────
  private _drawFireplace() {
    const g = this.add.graphics().setDepth(2);
    const fx = 40, fy = 40;

    // Stone surround (individual bricks)
    const bricks = [
      [fx, fy, 32, 20], [fx+34, fy, 32, 20], [fx+68, fy, 32, 20],
      [fx, fy+22, 32, 20], [fx+34, fy+22, 32, 20], [fx+68, fy+22, 32, 20],
    ];
    bricks.forEach(([bx, by, bw, bh]) => {
      g.fillStyle(0x6b6b6b);
      g.fillRect(bx, by, bw, bh);
      // Mortar lines
      g.lineStyle(1, 0x4a4a4a);
      g.strokeRect(bx, by, bw, bh);
    });

    // Arch opening
    g.fillStyle(0x1a1a1a);
    g.fillRect(fx+20, fy+50, 90, 80);
    g.fillCircle(fx+65, fy+50, 35);

    // Fire (4 layers)
    const fire1 = this.add.ellipse(fx+65, fy+110, 60, 40, 0xff6b35, 0.9).setDepth(3);
    const fire2 = this.add.ellipse(fx+65, fy+105, 45, 35, 0xf9ca24, 0.8).setDepth(3);
    const fire3 = this.add.ellipse(fx+65, fy+100, 30, 28, 0xfff176, 0.7).setDepth(3);
    const fire4 = this.add.ellipse(fx+65, fy+95, 18, 22, 0xffffff, 0.6).setDepth(3);
    
    [fire1, fire2, fire3, fire4].forEach((f, i) => {
      this.tweens.add({
        targets: f,
        scaleY: { from: 0.9, to: 1.15 },
        alpha: { from: f.alpha-0.1, to: f.alpha+0.1 },
        duration: 300 + i * 80,
        yoyo: true,
        repeat: -1
      });
    });

    // Ember glow on floor
    const ember = this.add.circle(fx+65, fy+140, 60, 0xff6b35, 0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: ember,
      alpha: { from: 0.08, to: 0.15 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // Mantle
    g.fillStyle(WOOD_DK);
    g.fillRect(fx-4, fy+35, 138, 10);

    // Mantle items
    // 3 Candles
    [[fx+20, fy+20], [fx+65, fy+20], [fx+110, fy+20]].forEach(([cx, cy]) => {
      g.fillStyle(0xfff5cc);
      g.fillRect(cx, cy, 6, 16);
      const flame = this.add.ellipse(cx+3, cy-2, 6, 8, 0xffcc44, 0.9).setDepth(3);
      this.tweens.add({
        targets: flame,
        scaleY: { from: 0.9, to: 1.2 },
        duration: 400,
        yoyo: true,
        repeat: -1
      });
    });

    // Honey jar
    g.fillStyle(0xdaa520, 0.8);
    g.fillEllipse(fx+45, fy+28, 14, 18);
    g.fillStyle(GOLD);
    g.fillEllipse(fx+45, fy+22, 14, 4);

    // Small clock
    g.fillStyle(WOOD_DK);
    g.fillRect(fx+85, fy+24, 16, 18);
    g.fillStyle(0xeeeeee);
    g.fillCircle(fx+93, fy+32, 6);
    g.lineStyle(1, 0x000000);
    g.lineBetween(fx+93, fy+32, fx+93, fy+28);

    // School crest above fireplace
    g.fillStyle(GOLD);
    g.fillCircle(fx+65, fy-10, 18);
    g.fillStyle(HUFF_B);
    g.fillCircle(fx+65, fy-10, 14);
    // Badger "H"
    g.lineStyle(2, HUFF_Y);
    g.lineBetween(fx+60, fy-15, fx+60, fy-5);
    g.lineBetween(fx+70, fy-15, fx+70, fy-5);
    g.lineBetween(fx+60, fy-10, fx+70, fy-10);

    const crestGlow = this.add.circle(fx+65, fy-10, 20, GOLD, 0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: crestGlow,
      alpha: { from: 0.05, to: 0.15 },
      duration: 1200,
      yoyo: true,
      repeat: -1
    });
  }

  // ── Large circular rug (centre) ─────────────────────────
  private _drawRug() {
    const g = this.add.graphics().setDepth(1);
    const rx = 600, ry = 480, rw = 300, rh = 210;

    // Base
    g.fillStyle(HUFF_Y);
    g.fillEllipse(rx, ry, rw, rh);

    // Black border ring
    g.lineStyle(12, HUFF_B);
    g.strokeEllipse(rx, ry, rw, rh);

    // Inner pattern - diamond lattice
    g.lineStyle(2, HUFF_B, 0.4);
    for (let dx = -4; dx < 5; dx++) {
      for (let dy = -3; dy < 4; dy++) {
        const px = rx + dx * 50;
        const py = ry + dy * 50;
        g.lineBetween(px-8, py, px+8, py);
        g.lineBetween(px, py-8, px, py+8);
      }
    }

    // Corner tassels
    [[rx-150, ry-105], [rx+150, ry-105], [rx-150, ry+105], [rx+150, ry+105]].forEach(([tx, ty]) => {
      g.fillStyle(HUFF_B);
      for (let i = 0; i < 5; i++) {
        g.fillRect(tx + i * 3, ty, 2, 12);
      }
    });
  }

  private _drawFurniture() {
    const g = this.add.graphics().setDepth(5);

    // West sofa
    g.fillStyle(HUFF_Y);
    g.fillRect(40, 350, 160, 200);
    g.lineStyle(3, HUFF_B);
    g.strokeRect(40, 350, 160, 200);
    g.fillStyle(HUFF_B);
    [[70, 380], [130, 380]].forEach(([px, py]) => g.fillRect(px, py, 40, 50));

    // East sofa
    g.fillStyle(HUFF_Y);
    g.fillRect(WORLD_W-200, 350, 160, 200);
    g.lineStyle(3, HUFF_B);
    g.strokeRect(WORLD_W-200, 350, 160, 200);
    g.fillStyle(HUFF_B);
    [[WORLD_W-170, 380], [WORLD_W-110, 380]].forEach(([px, py]) => g.fillRect(px, py, 40, 50));

    // Coffee table
    g.fillStyle(WOOD_DK);
    g.fillRect(480, 400, 240, 120);
    g.fillStyle(0x7a4a20);
    g.fillRect(484, 404, 232, 112);

    // Crystal ball on table
    g.fillStyle(0x7b3fc4, 0.3);
    g.fillCircle(600, 460, 24);
    g.fillStyle(0xe9d5ff, 0.6);
    g.fillCircle(595, 455, 14);
    const crystalGlow = this.add.circle(600, 460, 30, 0x7b3fc4, 0).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: crystalGlow,
      alpha: { from: 0.1, to: 0.3 },
      duration: 1500,
      yoyo: true,
      repeat: -1
    });

    // Honey pot on table
    g.fillStyle(0xdaa520, 0.8);
    g.fillEllipse(550, 450, 22, 28);
    g.fillStyle(GOLD);
    g.fillEllipse(550, 438, 22, 6);

    // Armchairs
    [[360, 420], [740, 420]].forEach(([ax, ay]) => {
      g.fillStyle(0x8b3a1a);
      g.fillRect(ax, ay, 100, 100);
      g.fillStyle(HUFF_Y, 0.6);
      g.fillRect(ax+10, ay+10, 80, 70);
    });
  }

  private _drawHufflepuffDetails() {
    const g = this.add.graphics().setDepth(6);

    // Potted plants
    [[60, 700], [WORLD_W-120, 700], [220, 300], [WORLD_W-240, 300]].forEach(([px, py]) => {
      // Pot
      g.fillStyle(0xc1440e);
      g.beginPath();
      g.moveTo(px+10, py+30);
      g.lineTo(px, py+60);
      g.lineTo(px+60, py+60);
      g.lineTo(px+50, py+30);
      g.closePath();
      g.fillPath();
      
      // Leaves
      const leaves = this.add.container(px+30, py+20).setDepth(7);
      for (let i = 0; i < 5; i++) {
        const leaf = this.add.ellipse(Math.cos(i * 1.3) * 15, Math.sin(i * 1.3) * 12, 18, 12, 0x2a7a10);
        leaves.add(leaf);
      }
      
      this.tweens.add({
        targets: leaves,
        rotation: { from: -0.08, to: 0.08 },
        duration: 3000,
        yoyo: true,
        repeat: -1
      });
    });

    // Honey jars on shelf
    [[140, 650], [450, 280], [850, 280]].forEach(([hx, hy]) => {
      g.fillStyle(0xdaa520, 0.8);
      g.fillEllipse(hx, hy, 16, 20);
      g.fillStyle(GOLD);
      g.fillEllipse(hx, hy-8, 16, 4);
    });

    // Warm lanterns
    [[200, 180], [600, 180], [1000, 180]].forEach(([lx, ly]) => {
      // Pentagon shade
      g.fillStyle(0xffcc44, 0.6);
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(lx + Math.cos(a) * 12, ly + Math.sin(a) * 12);
      }
      g.closePath();
      g.fillPath();

      // Glow
      const glow = this.add.circle(lx, ly+20, 40, 0xffcc44, 0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.08, to: 0.16 },
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1
      });
    });

    // Notice board (east wall)
    g.fillStyle(0xd4a96a);
    g.fillRect(WORLD_W-138, 250, 78, 148);

    // Pinned papers
    [[WORLD_W-128, 260, 0xfff8e7], [WORLD_W-124, 310, 0xe8f4ff], [WORLD_W-130, 360, 0xfff0e8]].forEach(([px, py, col]) => {
      g.fillStyle(col);
      g.fillRect(px, py, 48, 36);
      g.fillStyle(0xc0192c);
      g.fillCircle(px+24, py+2, 2);
    });

    // Floating magical motes
    for (let i = 0; i < 8; i++) {
      const mote = this.add.circle(
        200 + Math.random() * 800,
        200 + Math.random() * 500,
        2 + Math.random() * 2,
        i % 2 === 0 ? GOLD : 0x7b3fc4,
        0.3
      ).setDepth(8);

      this.tweens.add({
        targets: mote,
        y: mote.y - 10,
        alpha: { from: 0.3, to: 0.8 },
        duration: 2000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000
      });
    }
  }

  private _drawExitDoor() {
    const g = this.add.graphics().setDepth(5);
    const dx = EXIT_X - 40;

    // Wooden door
    g.fillStyle(WOOD_DK);
    g.fillRect(dx, WORLD_H-40, 80, 40);
    g.fillStyle(0x8B4513);
    g.fillRect(dx+4, WORLD_H-38, 36, 36);
    g.fillRect(dx+44, WORLD_H-38, 32, 36);

    // Gold handles
    g.fillStyle(GOLD);
    g.fillCircle(dx+36, WORLD_H-20, 3);
    g.fillCircle(dx+44, WORLD_H-20, 3);
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
      y: EXIT_Y-55,
      alpha: { from: 0.7, to: 1.0 },
      duration: 900,
      yoyo: true,
      repeat: -1
    });
  }

  private _playDoorSound() {
    try {
      const ctx=new AudioContext(),osc=ctx.createOscillator(),g=ctx.createGain();
      osc.connect(g);g.connect(ctx.destination);osc.type='sine';
      osc.frequency.setValueAtTime(330,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(165,ctx.currentTime+0.5);
      g.gain.setValueAtTime(0.14,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.6);
      osc.start();osc.stop(ctx.currentTime+0.6);osc.onended=()=>ctx.close();
    } catch{/*silence*/}
  }
}
