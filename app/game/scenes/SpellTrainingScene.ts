// ============================================================
// SpellTrainingScene — Good-Path Spell Training Quest
// Three instructors: Elvarinth (Lumos), Valeria (Nox), Clara (Expelliarmus)
// Characters displayed as real portrait images on decorative pedestals.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { isQuestAvailable } from '../data/questPaths';
import { useGameStore } from '../../stores/gameStore';

const WORLD_W = 1680;
const WORLD_H = 960;

const DEFAULT_SPAWN_X = 840;
const DEFAULT_SPAWN_Y = 800;

// ── Instructor definitions ─────────────────────────────────
interface Instructor {
  id:           'elvarinth' | 'valeria' | 'clara';
  name:         string;
  title:        string;              // flavour subtitle
  spell:        'lumos' | 'nox' | 'expelliarmus';
  x:            number;
  y:            number;
  textureKey:   string;              // Phaser texture key for portrait
  imageFile:    string;              // path served from /public
  /** primary theme colour (hex number) */
  themeColor:   number;
  accentColor:  number;
  icon:         string;
  requiresKey:  keyof ReturnType<typeof useGameStore.getState> | null;
}

const INSTRUCTORS: Instructor[] = [
  {
    id:          'clara',
    name:        'CLARA',
    title:       'Master of Light',
    spell:       'lumos',
    x:           400,
    y:           490,
    textureKey:  'char_clara',
    imageFile:   '/clara.png',
    themeColor:  0x4da6ff,    // bright blue
    accentColor: 0xb8d8ff,    // silver-blue
    icon:        '☀️',
    requiresKey: null,
  },
  {
    id:          'valeria',
    name:        'VALERIA',
    title:       'Mistress of Shadow',
    spell:       'nox',
    x:           840,
    y:           490,
    textureKey:  'char_valeria',
    imageFile:   '/valeria.png',
    themeColor:  0x9b59ff,    // violet
    accentColor: 0xccaaff,    // lavender
    icon:        '🌑',
    requiresKey: 'lumosCompleted',
  },
  {
    id:          'elvarinth',
    name:        'ELVARINTH',
    title:       'Duelling Prodigy',
    spell:       'expelliarmus',
    x:           1280,
    y:           490,
    textureKey:  'char_elvarinth',
    imageFile:   '/Elvarinth.png',
    themeColor:  0xff6644,    // fiery orange-red
    accentColor: 0xffd700,    // gold
    icon:        '⚡',
    requiresKey: 'noxCompleted',
  },
];

const INTERACT_RADIUS = 200;

// ── Return zone (bottom-centre) ────────────────────────────
const RETURN_ZONE = { x: 840, y: 870, radius: 60 };

// Portrait display dimensions
const PORTRAIT_W = 160;
const PORTRAIT_H = 200;

export class SpellTrainingScene extends Phaser.Scene {
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;

  private isTransitioning = false;
  private nearInstructor: Instructor | null = null;
  private nearReturn = false;

  // Per-instructor GameObjects
  private lockIcons:   Map<string, Phaser.GameObjects.Text> = new Map();
  private portraits:   Map<string, Phaser.GameObjects.Image> = new Map();
  private lockOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  private floatMsg?:     Phaser.GameObjects.Text;

  // Completion overlay
  private completionOverlay?: Phaser.GameObjects.Container;

  // EventBus unsub
  private _offSpellLearned?: () => void;

  constructor() { super({ key: 'SpellTrainingScene' }); }

  // ── Load the character portraits ───────────────────────────
  preload() {
    for (const inst of INSTRUCTORS) {
      if (!this.textures.exists(inst.textureKey)) {
        this.load.image(inst.textureKey, inst.imageFile);
      }
    }
  }

  create(_data?: { fromDueling?: boolean }) {
    this.isTransitioning = false;
    this.nearInstructor  = null;
    this.nearReturn      = false;
    this.lockIcons.clear();
    this.portraits.clear();
    this.lockOverlays.clear();

    // Guard: if quest not available, return to duelling room
    if (!isQuestAvailable('goodDuelingTraining')) {
      this.scene.start('DuellingRoomScene', { spawnX: 1277, spawnY: 830 });
      return;
    }

    // Mark training started
    useGameStore.getState().setGoodTrainingStarted();

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // ── Draw the room environment ─────────────────────────────
    this._drawRoom();

    // ── Create each instructor with portrait ──────────────────
    INSTRUCTORS.forEach((inst) => this._createInstructor(inst));

    // ── Physics colliders ─────────────────────────────────────
    this.staticGroup = this.physics.add.staticGroup();
    this._addWallColliders();
    this._addCharacterColliders();

    // ── Player wizard ─────────────────────────────────────────
    this.wizard = new Wizard(this, DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y);
    const spr = this.wizard.getSprite();
    spr.setDepth(DEFAULT_SPAWN_Y + 10);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh);
      body.setOffset(Math.round((spr.width - fw) / 2), spr.height - fh);
    }
    this.physics.add.collider(spr, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    // ── Return bubble ─────────────────────────────────────────
    this._createReturnBubble();

    // ── Camera ────────────────────────────────────────────────
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) =>
      cam.setZoom(Math.min(w / 1440, h / 810) * 1.0);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) =>
      setZoom(sz.width, sz.height));
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // ── EventBus: SPELL_LEARNED from React ────────────────────
    this._offSpellLearned = eventBus.on('SPELL_LEARNED', (data: unknown) => {
      const { spell } = data as { spell: 'lumos' | 'nox' | 'expelliarmus' };
      this._onSpellLearned(spell);
    });

    eventBus.emit('SCENE_READY', { scene: 'SpellTrainingScene' });
  }

  // ════════════════════════════════════════════════════════
  update(_t: number, delta: number) {
    if (this.isTransitioning || !this.wizard || !this.controller) return;

    this.controller.update(delta);

    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);
    const wx = spr.x, wy = spr.y;

    // ── Find nearest instructor in range ─────────────────────
    let newNearest: Instructor | null = null;
    let minDist = Infinity;
    for (const inst of INSTRUCTORS) {
      const d = Phaser.Math.Distance.Between(wx, wy, inst.x, inst.y);
      if (d < INTERACT_RADIUS && d < minDist) {
        minDist = d;
        newNearest = inst;
      }
    }

    if (newNearest !== this.nearInstructor) {
      if (this.nearInstructor) {
        eventBus.emit('PLAYER_NEAR_INSTRUCTOR', { near: false });
      }
      this.nearInstructor = newNearest;
      if (this.nearInstructor) {
        const state = useGameStore.getState();
        const isLocked = this.nearInstructor.requiresKey !== null &&
          !state[this.nearInstructor.requiresKey as keyof ReturnType<typeof useGameStore.getState>];
        eventBus.emit('PLAYER_NEAR_INSTRUCTOR', { 
          near: true, 
          name: this.nearInstructor.name, 
          locked: isLocked 
        });
      }
    }

    // ── Return zone ──────────────────────────────────────────
    const wasNearReturn = this.nearReturn;
    this.nearReturn = Phaser.Math.Distance.Between(
      wx, wy, RETURN_ZONE.x, RETURN_ZONE.y,
    ) < RETURN_ZONE.radius;
    if (this.nearReturn !== wasNearReturn) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearReturn, target: 'outdoor' });
    }
  }

  // ════════════════════════════════════════════════════════
  // ROOM DRAWING
  private _drawRoom() {
    const g = this.add.graphics().setDepth(0);

    // ── Floor — dark stone tiles ──────────────────────────────
    g.fillStyle(0x14101e, 1);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Tile grid
    g.lineStyle(1, 0x22183a, 0.8);
    const TILE = 60;
    for (let x = 0; x <= WORLD_W; x += TILE) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += TILE) g.lineBetween(0, y, WORLD_W, y);

    // Subtle floor highlights
    g.lineStyle(1, 0x2e1f50, 0.3);
    for (let x = TILE / 2; x <= WORLD_W; x += TILE) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = TILE / 2; y <= WORLD_H; y += TILE) g.lineBetween(0, y, WORLD_W, y);

    // ── Back wall ─────────────────────────────────────────────
    g.fillStyle(0x1c1030, 1);
    g.fillRect(0, 0, WORLD_W, 200);
    // Wall-floor divider
    g.lineStyle(3, 0x7744cc, 0.7);
    g.lineBetween(0, 200, WORLD_W, 200);
    // Wall stone courses
    g.lineStyle(1, 0x2a1844, 0.6);
    for (let x = 0; x <= WORLD_W; x += 140) g.lineBetween(x, 0, x, 200);
    for (let y = 50; y <= 200; y += 50)  g.lineBetween(0, y, WORLD_W, y);

    // Arched windows on back wall
    this._drawArch(g, 220,  100, 90, 90, 0x5533bb);
    this._drawArch(g, 840,  100, 90, 90, 0x5533bb);
    this._drawArch(g, 1460, 100, 90, 90, 0x5533bb);

    // ── Bookshelves left & right ──────────────────────────────
    this._drawBookshelf(g, 24,  200, 110, 600);
    this._drawBookshelf(g, WORLD_W - 134, 200, 110, 600);

    // ── Mystical rugs under each instructor ───────────────────
    // Elvarinth (blue)
    g.fillStyle(0x102060, 0.55);
    g.fillEllipse(400, 650, 300, 90);
    g.lineStyle(2, 0x4488ee, 0.8);
    g.strokeEllipse(400, 650, 300, 90);
    // Valeria (purple)
    g.fillStyle(0x280d55, 0.55);
    g.fillEllipse(840, 650, 300, 90);
    g.lineStyle(2, 0x9955ff, 0.8);
    g.strokeEllipse(840, 650, 300, 90);
    // Clara (red-gold)
    g.fillStyle(0x4a0f0a, 0.55);
    g.fillEllipse(1280, 650, 300, 90);
    g.lineStyle(2, 0xff5522, 0.8);
    g.strokeEllipse(1280, 650, 300, 90);

    // ── Room border ───────────────────────────────────────────
    g.lineStyle(4, 0x6633aa, 0.9);
    g.strokeRect(4, 4, WORLD_W - 8, WORLD_H - 8);
    g.lineStyle(2, 0xaa55ff, 0.3);
    g.strokeRect(10, 10, WORLD_W - 20, WORLD_H - 20);

    // ── Floating magic particles ──────────────────────────────
    for (let i = 0; i < 35; i++) {
      const px = Phaser.Math.Between(90, WORLD_W - 90);
      const py = Phaser.Math.Between(210, WORLD_H - 120);
      const pr = Phaser.Math.Between(2, 5);
      const colors = [0xaa44ff, 0x4488ff, 0xff4488, 0x44ffbb];
      const col = colors[Phaser.Math.Between(0, colors.length - 1)];
      const particle = this.add.circle(px, py, pr, col,
        Phaser.Math.FloatBetween(0.25, 0.75)).setDepth(2);
      const dy = -Phaser.Math.Between(18, 55);
      this.tweens.add({
        targets: particle, y: py + dy,
        alpha: { from: Phaser.Math.FloatBetween(0.3, 0.7), to: 0 },
        duration: Phaser.Math.Between(1400, 4200),
        delay: Phaser.Math.Between(0, 3500),
        repeat: -1, yoyo: false,
        onRepeat: () => { particle.setY(py); particle.setAlpha(Phaser.Math.FloatBetween(0.3, 0.75)); },
      });
    }

    // ── Candles ──────────────────────────────────────────────
    this._drawCandle(190,  310);
    this._drawCandle(310,  310);
    this._drawCandle(WORLD_W - 190, 310);
    this._drawCandle(WORLD_W - 310, 310);
    this._drawCandle(840, 230);
  }

  private _drawArch(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number, color: number,
  ) {
    g.fillStyle(color, 0.22);
    g.fillRect(cx - w / 2, cy - h / 2 + 16, w, h - 16);
    g.fillStyle(color, 0.38);
    g.fillEllipse(cx, cy - h / 2 + 16, w, 32);
    g.lineStyle(2, 0xcc99ff, 0.65);
    g.strokeRect(cx - w / 2, cy - h / 2 + 16, w, h - 16);
    g.strokeEllipse(cx, cy - h / 2 + 16, w, 32);
  }

  private _drawBookshelf(
    g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number,
  ) {
    g.fillStyle(0x1e120a, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x4a2a0e, 1);
    g.strokeRect(x, y, w, h);
    const palettes = [0xaa3322, 0x225599, 0x228855, 0xaa8822, 0x772299, 0x44aacc];
    const rows = 6, shelfH = h / rows;
    for (let row = 0; row < rows; row++) {
      const sy = y + row * shelfH;
      g.lineStyle(2, 0x4a2a0e, 1);
      g.lineBetween(x, sy + shelfH - 5, x + w, sy + shelfH - 5);
      let bx = x + 5;
      let ci = 0;
      while (bx < x + w - 5) {
        const bw = Phaser.Math.Between(10, 17);
        const bh = Phaser.Math.Between(
          Math.round(shelfH * 0.52), Math.round(shelfH * 0.82));
        g.fillStyle(palettes[(ci + row * 3) % palettes.length], 0.88);
        g.fillRect(bx, sy + shelfH - 5 - bh, bw, bh);
        g.lineStyle(1, 0x00000044, 1);
        g.strokeRect(bx, sy + shelfH - 5 - bh, bw, bh);
        bx += bw + 2; ci++;
      }
    }
  }

  private _drawCandle(x: number, y: number) {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0xf5e6c8, 1);
    g.fillRect(x - 5, y, 10, 30);
    const flame = this.add.graphics().setDepth(6);
    flame.fillStyle(0xffdd44, 0.9);
    flame.fillEllipse(x, y - 12, 12, 20);
    flame.fillStyle(0xffffff, 0.55);
    flame.fillEllipse(x, y - 10, 6, 12);
    this.tweens.add({
      targets: flame,
      scaleX: { from: 0.82, to: 1.18 },
      scaleY: { from: 0.88, to: 1.12 },
      alpha:  { from: 0.72, to: 1.0  },
      duration: Phaser.Math.Between(280, 580),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const halo = this.add.circle(x, y - 12, 24, 0xffdd44, 0.07).setDepth(4);
    this.tweens.add({
      targets: halo, alpha: { from: 0.04, to: 0.20 },
      duration: 550, yoyo: true, repeat: -1,
    });
  }

  // ════════════════════════════════════════════════════════
  // INSTRUCTOR CREATION — portrait image on a decorative pedestal
  private _createInstructor(inst: Instructor) {
    const { x, y, themeColor, accentColor, name, title, icon } = inst;

    const state     = useGameStore.getState();
    const isLocked  = inst.requiresKey !== null &&
      !state[inst.requiresKey as keyof ReturnType<typeof useGameStore.getState>];

    const alpha = isLocked ? 0.38 : 1.0;

    // ── Pedestal base (drawn behind portrait) ─────────────────
    const pg = this.add.graphics().setDepth(8);
    // Pillar shadow
    pg.fillStyle(0x000000, 0.22 * alpha);
    pg.fillEllipse(x, y + 120, PORTRAIT_W + 20, 28);
    // Pedestal body
    const pedCol = isLocked ? 0x2a2a2a : (themeColor & 0x3f3f3f) | 0x1a1a2a;
    pg.fillStyle(pedCol, alpha);
    pg.fillRect(x - PORTRAIT_W / 2 - 8, y + PORTRAIT_H / 2 - 10, PORTRAIT_W + 16, 30);
    pg.fillRect(x - PORTRAIT_W / 2 - 16, y + PORTRAIT_H / 2 + 18, PORTRAIT_W + 32, 12);
    // Pedestal edge highlight
    if (!isLocked) {
      pg.lineStyle(2, accentColor, 0.7);
      pg.strokeRect(x - PORTRAIT_W / 2 - 8, y + PORTRAIT_H / 2 - 10, PORTRAIT_W + 16, 30);
    }

    // ── Portrait frame (background) ───────────────────────────
    const frameFill = isLocked ? 0x1a1a1a : 0x0a001a;
    const frameGfx = this.add.graphics().setDepth(9);
    // Outer ornate frame
    frameGfx.fillStyle(isLocked ? 0x333333 : accentColor, isLocked ? 0.3 : 0.9);
    frameGfx.fillRect(
      x - PORTRAIT_W / 2 - 6, y - PORTRAIT_H / 2 - 6,
      PORTRAIT_W + 12, PORTRAIT_H + 12,
    );
    // Inner dark mat
    frameGfx.fillStyle(frameFill, 1);
    frameGfx.fillRect(
      x - PORTRAIT_W / 2 - 2, y - PORTRAIT_H / 2 - 2,
      PORTRAIT_W + 4, PORTRAIT_H + 4,
    );
    // Corner ornaments
    if (!isLocked) {
      const corners = [
        [x - PORTRAIT_W / 2 - 6, y - PORTRAIT_H / 2 - 6],
        [x + PORTRAIT_W / 2 + 6, y - PORTRAIT_H / 2 - 6],
        [x - PORTRAIT_W / 2 - 6, y + PORTRAIT_H / 2 + 6],
        [x + PORTRAIT_W / 2 + 6, y + PORTRAIT_H / 2 + 6],
      ] as [number, number][];
      for (const [cx2, cy2] of corners) {
        frameGfx.fillStyle(accentColor, 1);
        frameGfx.fillCircle(cx2, cy2, 5);
      }
    }

    // ── Portrait image ────────────────────────────────────────
    const portrait = this.add.image(x, y, inst.textureKey)
      .setDisplaySize(PORTRAIT_W, PORTRAIT_H)
      .setOrigin(0.5, 0.5)
      .setDepth(10)
      .setAlpha(alpha);
    this.portraits.set(inst.id, portrait);

    // If locked, add a dark overlay on the portrait
    if (isLocked) {
      const lockRect = this.add.rectangle(
        x, y, PORTRAIT_W, PORTRAIT_H, 0x000000, 0.55,
      ).setDepth(11);
      this.lockOverlays.set(inst.id, lockRect);
    }

    // ── Glow halo behind frame ────────────────────────────────
    const glowColor = isLocked ? 0x444444 : themeColor;
    const glow = this.add.rectangle(
      x, y,
      PORTRAIT_W + 40, PORTRAIT_H + 40,
      glowColor, isLocked ? 0.04 : 0.14,
    ).setDepth(7);
    if (!isLocked) {
      this.tweens.add({
        targets: glow,
        fillAlpha: { from: 0.08, to: 0.24 },
        scaleX: { from: 0.92, to: 1.08 },
        scaleY: { from: 0.92, to: 1.08 },
        duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── Name plate below pedestal ─────────────────────────────
    const nameColor = isLocked ? '#555555' :
      '#' + themeColor.toString(16).padStart(6, '0');
    this.add.text(x, y + PORTRAIT_H / 2 + 36, name, {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: nameColor, stroke: '#04000e', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(15);

    this.add.text(x, y + PORTRAIT_H / 2 + 54, title, {
      fontFamily: 'monospace', fontSize: '9px',
      color: isLocked ? '#444444' : '#' + accentColor.toString(16).padStart(6, '0'),
      stroke: '#04000e', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);

    // ── Spell badge (icon + label) ────────────────────────────
    const spellLabel = { lumos: 'LUMOS', nox: 'NOX', expelliarmus: 'EXPELLIARMUS' }[inst.spell];
    const badge = this.add.text(
      x, y - PORTRAIT_H / 2 - 24,
      `${icon}  ${spellLabel}`,
      {
        fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
        color: isLocked ? '#444444' : '#' + accentColor.toString(16).padStart(6, '0'),
        stroke: '#04000e', strokeThickness: 4,
        padding: { x: 8, y: 3 },
        backgroundColor: isLocked ? '#111111cc' : '#0a001acc',
      },
    ).setOrigin(0.5).setDepth(15);

    if (!isLocked) {
      this.tweens.add({
        targets: badge, y: badge.y - 4,
        duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── Lock icon ─────────────────────────────────────────────
    if (isLocked) {
      const lockTxt = this.add.text(x, y - PORTRAIT_H / 2 - 56, '🔒', {
        fontSize: '26px',
      }).setOrigin(0.5).setDepth(16);
      this.lockIcons.set(inst.id, lockTxt);
      this.tweens.add({
        targets: lockTxt, y: lockTxt.y - 6,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  // ════════════════════════════════════════════════════════
  // RETURN BUBBLE
  private _createReturnBubble() {
    const cx = RETURN_ZONE.x, cy = RETURN_ZONE.y;
    const glow = this.add.circle(cx, cy, 36, 0xffcc22, 0.12).setDepth(20);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from: 0.06, to: 0.3 },
      scaleX: { from: 0.85, to: 1.2 },
      scaleY: { from: 0.85, to: 1.2 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const bubble = this.add.circle(cx, cy, 24, 0x1a0a02, 0.9)
      .setStrokeStyle(2, 0xffcc55, 1).setDepth(21);
    const icon = this.add.text(cx, cy, '🚪', { fontSize: '18px' })
      .setOrigin(0.5).setDepth(22);
    this.tweens.add({
      targets: [glow, bubble, icon], y: '-=6',
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.add.text(cx, cy + 38, 'RETURN', {
      fontFamily: 'monospace', fontSize: '8px', color: '#ffcc55',
      stroke: '#20150d', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22);
  }

  // ════════════════════════════════════════════════════════
  // WALL + CHARACTER COLLIDERS
  private _addWallColliders() {
    const t = 40;
    const rects: [number, number, number, number][] = [
      [0,              0,              WORLD_W, t],
      [0,              WORLD_H - t,    WORLD_W, t],
      [0,              0,              t, WORLD_H],
      [WORLD_W - t,    0,              t, WORLD_H],
    ];
    for (const [rx, ry, rw, rh] of rects) {
      const wall = this.add.rectangle(rx + rw / 2, ry + rh / 2, rw, rh, 0, 0);
      this.physics.add.existing(wall, true);
      this.staticGroup.add(wall);
    }
  }

  private _addCharacterColliders() {
    for (const inst of INSTRUCTORS) {
      const block = this.add.rectangle(inst.x, inst.y, PORTRAIT_W, PORTRAIT_H + 60, 0, 0);
      this.physics.add.existing(block, true);
      this.staticGroup.add(block);
    }
  }

  // ════════════════════════════════════════════════════════
  // INTERACTION
  private _handleInteract() {
    if (this.isTransitioning) return;

    if (this.nearReturn) { this._leaveScene(); return; }

    if (this.nearInstructor) {
      const inst  = this.nearInstructor;
      const state = useGameStore.getState();

      // Locked?
      if (inst.requiresKey !== null) {
        const unlocked = !!state[inst.requiresKey as keyof ReturnType<typeof useGameStore.getState>];
        if (!unlocked) {
          this._showFloatMessage('Complete the previous spell first!');
          return;
        }
      }

      // Already learned?
      const alreadyLearned = {
        lumos:        state.lumosCompleted,
        nox:          state.noxCompleted,
        expelliarmus: state.expelliarmusCompleted,
      }[inst.spell];

      if (alreadyLearned) {
        this._showFloatMessage(`${inst.spell.toUpperCase()} already mastered! ✓`);
        return;
      }

      eventBus.emit('OPEN_SPELL_GESTURE', { spell: inst.spell });
    }
  }

  // ════════════════════════════════════════════════════════
  // SPELL LEARNED (from React)
  private _onSpellLearned(spell: 'lumos' | 'nox' | 'expelliarmus') {
    const state = useGameStore.getState();

    if (spell === 'lumos') {
      state.setLumosCompleted();
      this._celebrateSpell(400, 490, 0x4da6ff, 'LUMOS');
      this._unlockInstructor('valeria');
    } else if (spell === 'nox') {
      state.setNoxCompleted();
      this._celebrateSpell(840, 490, 0x9b59ff, 'NOX');
      this._unlockInstructor('elvarinth');
    } else if (spell === 'expelliarmus') {
      state.setExpelliarmusCompleted();
      this._celebrateSpell(1280, 490, 0xff6644, 'EXPELLIARMUS');

      const s = useGameStore.getState();
      if (s.lumosCompleted && s.noxCompleted && s.expelliarmusCompleted) {
        this.time.delayedCall(1500, () => this._completeTraining());
      }
    }
  }

  /** Sparkle burst + floating label at character's position */
  private _celebrateSpell(x: number, y: number, color: number, spellName: string) {
    const ring = this.add.circle(x, y, 90, color, 0.5).setDepth(80);
    this.tweens.add({
      targets: ring,
      scaleX: { from: 0.2, to: 2.8 },
      scaleY: { from: 0.2, to: 2.8 },
      alpha: { from: 0.5, to: 0 },
      duration: 900, ease: 'Power2',
      onComplete: () => ring.destroy(),
    });

    const label = this.add.text(x, y - PORTRAIT_H / 2 - 80,
      `✦ ${spellName} LEARNED! ✦`,
      {
        fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold',
        color: '#' + color.toString(16).padStart(6, '0'),
        stroke: '#04000e', strokeThickness: 6,
      },
    ).setOrigin(0.5).setDepth(90);
    this.tweens.add({
      targets: label, y: y - PORTRAIT_H / 2 - 140,
      alpha: { from: 1, to: 0 }, duration: 2200, ease: 'Power2',
      onComplete: () => label.destroy(),
    });

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const spark = this.add.circle(
        x + Math.cos(angle) * 70,
        y + Math.sin(angle) * 70,
        5, color, 1,
      ).setDepth(82);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 160,
        y: y + Math.sin(angle) * 160,
        alpha: { from: 1, to: 0 }, scaleX: 0.1, scaleY: 0.1,
        duration: 750 + i * 35, ease: 'Power2',
        onComplete: () => spark.destroy(),
      });
    }
  }

  /** Remove lock overlay + icon and refresh talk prompt for an instructor */
  private _unlockInstructor(id: 'elvarinth' | 'valeria' | 'clara') {
    // Remove greyscale lock overlay on portrait
    const overlay = this.lockOverlays.get(id);
    if (overlay) { overlay.destroy(); this.lockOverlays.delete(id); }

    // Restore portrait alpha
    const portrait = this.portraits.get(id);
    if (portrait) {
      this.tweens.add({ targets: portrait, alpha: 1, duration: 600, ease: 'Power2' });
    }

    // Remove lock icon
    const lockTxt = this.lockIcons.get(id);
    if (lockTxt) { lockTxt.destroy(); this.lockIcons.delete(id); }

    // Update talk prompt if player is near
    if (this.nearInstructor && this.nearInstructor.id === id) {
      eventBus.emit('PLAYER_NEAR_INSTRUCTOR', {
        near: true,
        name: this.nearInstructor.name,
        locked: false
      });
    }
  }

  // ════════════════════════════════════════════════════════
  // QUEST COMPLETION
  private _completeTraining() {
    if (this.isTransitioning) return;
    useGameStore.getState().setGoodTrainingCompleted();
    this.isTransitioning = true;

    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    const bg = this.add.rectangle(cx, cy, 700, 320, 0x06001a, 0.94)
      .setDepth(200).setStrokeStyle(3, 0xaa44ff, 1);
    const title = this.add.text(cx, cy - 80,
      '⚡  SPELL TRAINING COMPLETE  ⚡',
      { fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold',
        color: '#cc88ff', stroke: '#06001a', strokeThickness: 7 },
    ).setOrigin(0.5).setDepth(201);
    const sub = this.add.text(cx, cy,
      'You have mastered\nLUMOS  ·  NOX  ·  EXPELLIARMUS',
      { fontFamily: 'monospace', fontSize: '15px',
        color: '#ddbbff', stroke: '#06001a', strokeThickness: 5, align: 'center' },
    ).setOrigin(0.5).setDepth(201);
    const hint = this.add.text(cx, cy + 90,
      'Returning to the Duelling Room…',
      { fontFamily: 'monospace', fontSize: '11px',
        color: '#7777aa', stroke: '#06001a', strokeThickness: 3 },
    ).setOrigin(0.5).setDepth(201);

    this.tweens.add({
      targets: bg,
      strokeAlpha: { from: 0.5, to: 1.0 },
      duration: 900, yoyo: true, repeat: -1,
    });

    this.completionOverlay = this.add.container(0, 0, [bg, title, sub, hint]);
    this.completionOverlay.setDepth(200);

    this.time.delayedCall(3200, () => {
      this.cameras.main.fadeOut(700, 10, 0, 40);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('DuellingRoomScene', { spawnX: 1277, spawnY: 830 });
      });
    });
  }

  // ════════════════════════════════════════════════════════
  // LEAVE SCENE (manual return)
  private _leaveScene() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('DuellingRoomScene', { spawnX: 1277, spawnY: 830 });
    });
  }

  // ════════════════════════════════════════════════════════
  // FLOAT MESSAGE
  private _showFloatMessage(msg: string) {
    if (this.floatMsg) { this.floatMsg.destroy(); this.floatMsg = undefined; }
    const spr = this.wizard?.getSprite();
    const mx = spr ? spr.x : WORLD_W / 2;
    const my = spr ? spr.y - 90 : WORLD_H / 2;
    this.floatMsg = this.add.text(mx, my, msg, {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#ff8888', stroke: '#2a0000', strokeThickness: 4,
      padding: { x: 10, y: 5 }, backgroundColor: '#3a0000dd',
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({
      targets: this.floatMsg, y: my - 35,
      alpha: { from: 1, to: 0 }, duration: 1900, ease: 'Power1',
      onComplete: () => { this.floatMsg?.destroy(); this.floatMsg = undefined; },
    });
  }

  // ════════════════════════════════════════════════════════
  // SHUTDOWN
  shutdown() {
    if (this._offSpellLearned) {
      this._offSpellLearned();
      this._offSpellLearned = undefined;
    }
  }
}
