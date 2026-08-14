// ============================================================
// RarePlantQuestScene — T9 Rare Plant Quest
// ============================================================
// Phase 1 — WALK:  T9 background, character walks freely,
//            one glowing bubble in the centre.
// Phase 2 — CLICK: Fade black → Arabic text → fixed
//            point-and-click board with many drawn plants.
//            All plants are drawn with Phaser Graphics — no images.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }           from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { rarePlantQuestState } from './BotanicalClassroomScene';

// ── World ─────────────────────────────────────────────────────
const WORLD_W = 1680;
const WORLD_H = 960;
const SPAWN_X = 840;
const SPAWN_Y = 820;
const BUBBLE_X = 840;
const BUBBLE_Y = 480;
const BUBBLE_R = 80;

// ── Which of the 3 target plants is real (randomised each run) ─
const REAL_IDX = Math.floor(Math.random() * 3);

// ── Plant drawing helpers ──────────────────────────────────────

/** Draw a generic decorative plant at (x,y) on a Graphics object.
 *  style controls pot colour, leaf shape, flower colour, etc.       */
function drawDecoyPlant(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  style: {
    potCol:    number;  // hex
    leafCol:   number;
    flowerCol: number;
    tall:      boolean; // tall vs wide leaf spread
    hasFlower: boolean;
    scale:     number;  // 1 = normal
  },
) {
  const s = style.scale;

  // Pot
  g.fillStyle(style.potCol, 1);
  g.fillRect(x - 18 * s, y - 10 * s, 36 * s, 28 * s);
  // Pot rim
  g.fillStyle(Phaser.Display.Color.ValueToColor(style.potCol).darken(15).color, 1);
  g.fillRect(x - 21 * s, y - 13 * s, 42 * s, 8 * s);
  // Soil
  g.fillStyle(0x3b2006, 1);
  g.fillEllipse(x, y - 10 * s, 32 * s, 10 * s);

  // Stem
  g.fillStyle(0x3a7d44, 1);
  g.fillRect(x - 3 * s, y - 42 * s, 6 * s, 34 * s);

  // Leaves
  g.fillStyle(style.leafCol, 0.92);
  if (style.tall) {
    // Two upright elongated leaves
    g.fillEllipse(x - 18 * s, y - 60 * s, 20 * s, 44 * s);
    g.fillEllipse(x + 18 * s, y - 62 * s, 20 * s, 44 * s);
    g.fillEllipse(x,          y - 70 * s, 18 * s, 38 * s);
  } else {
    // Spreading round leaves
    g.fillEllipse(x - 22 * s, y - 48 * s, 30 * s, 22 * s);
    g.fillEllipse(x + 22 * s, y - 48 * s, 30 * s, 22 * s);
    g.fillEllipse(x,          y - 56 * s, 28 * s, 22 * s);
  }

  // Flower
  if (style.hasFlower) {
    g.fillStyle(style.flowerCol, 1);
    g.fillCircle(x, y - (style.tall ? 88 : 68) * s, 10 * s);
    g.fillStyle(0xffff88, 1);
    g.fillCircle(x, y - (style.tall ? 88 : 68) * s, 5 * s);
  }
}

/** Draw the TARGET plant — identical for all 3.
 *  Distinctive but not flashy: round dark-green pot, two heart-shaped
 *  leaves, tiny white star flower on top.                            */
function drawTargetPlant(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
) {
  const s = 1.15;

  // Round pot — dark teal
  g.fillStyle(0x1e5f5f, 1);
  g.fillEllipse(x, y + 4 * s, 38 * s, 30 * s);   // pot body
  g.fillStyle(0x154444, 1);
  g.fillRect(x - 19 * s, y - 10 * s, 38 * s, 18 * s); // flat front face
  g.fillStyle(0x277070, 1);
  g.fillRect(x - 22 * s, y - 14 * s, 44 * s, 8 * s);  // rim

  // Soil
  g.fillStyle(0x2e1503, 1);
  g.fillEllipse(x, y - 10 * s, 34 * s, 10 * s);

  // Stem (slightly curved via two rects)
  g.fillStyle(0x2d8c4e, 1);
  g.fillRect(x - 3 * s, y - 46 * s, 6 * s, 38 * s);

  // Two heart/oval leaves fanning left and right
  g.fillStyle(0x2db05a, 0.95);
  g.fillEllipse(x - 22 * s, y - 58 * s, 32 * s, 22 * s);
  g.fillEllipse(x + 22 * s, y - 56 * s, 32 * s, 22 * s);
  // Central leaf
  g.fillStyle(0x3ecf6e, 0.88);
  g.fillEllipse(x, y - 68 * s, 24 * s, 30 * s);

  // Tiny white star flower (4 petals + centre)
  const fy = y - 86 * s;
  g.fillStyle(0xffffff, 1);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.fillEllipse(x + Math.cos(a) * 8 * s, fy + Math.sin(a) * 8 * s, 9 * s, 6 * s);
  }
  g.fillStyle(0xffee88, 1);
  g.fillCircle(x, fy, 5 * s);  // centre
}

// ── Click board layout (23 items) ─────────────────────────────
// Positions in normalised 0–1 space; renderX/Y computed at runtime.
interface PlantSlot {
  nx: number;  // 0–1 of board width
  ny: number;  // 0–1 of board height
  kind:  'decoy' | 'target';
  isReal?: boolean;
  // runtime
  container?: Phaser.GameObjects.Container;
  hitZone?:   Phaser.GameObjects.Rectangle;
  found?:     boolean;
  decoyStyle?: {
    potCol: number; leafCol: number; flowerCol: number;
    tall: boolean; hasFlower: boolean; scale: number;
  };
}

// 22 decoy positions + 3 target positions in a tight centered 5x5 grid
const SLOT_DEFS: Omit<PlantSlot, 'container' | 'hitZone' | 'found' | 'decoyStyle'>[] = [
  // ── row 1 ──────────────────────────────────────────────
  { nx: 0.28, ny: 0.30, kind: 'decoy' },
  { nx: 0.39, ny: 0.30, kind: 'decoy' },
  { nx: 0.50, ny: 0.30, kind: 'decoy' },
  { nx: 0.61, ny: 0.30, kind: 'decoy' },
  { nx: 0.72, ny: 0.30, kind: 'decoy' },
  // ── row 2 ──────────────────────────────────────────────
  { nx: 0.28, ny: 0.42, kind: 'decoy' },
  { nx: 0.39, ny: 0.42, kind: 'decoy' },
  { nx: 0.50, ny: 0.42, kind: 'target', isReal: REAL_IDX === 0 }, // TARGET A
  { nx: 0.61, ny: 0.42, kind: 'decoy' },
  { nx: 0.72, ny: 0.42, kind: 'decoy' },
  // ── row 3 ──────────────────────────────────────────────
  { nx: 0.28, ny: 0.54, kind: 'decoy' },
  { nx: 0.39, ny: 0.54, kind: 'target', isReal: REAL_IDX === 1 }, // TARGET B
  { nx: 0.50, ny: 0.54, kind: 'decoy' },
  { nx: 0.61, ny: 0.54, kind: 'decoy' },
  { nx: 0.72, ny: 0.54, kind: 'decoy' },
  // ── row 4 ──────────────────────────────────────────────
  { nx: 0.28, ny: 0.66, kind: 'decoy' },
  { nx: 0.39, ny: 0.66, kind: 'decoy' },
  { nx: 0.50, ny: 0.66, kind: 'decoy' },
  { nx: 0.61, ny: 0.66, kind: 'target', isReal: REAL_IDX === 2 }, // TARGET C
  { nx: 0.72, ny: 0.66, kind: 'decoy' },
  // ── row 5 ──────────────────────────────────────────────
  { nx: 0.28, ny: 0.78, kind: 'decoy' },
  { nx: 0.39, ny: 0.78, kind: 'decoy' },
  { nx: 0.50, ny: 0.78, kind: 'decoy' },
  { nx: 0.61, ny: 0.78, kind: 'decoy' },
  { nx: 0.72, ny: 0.78, kind: 'decoy' },
];

// Pre-generate varied decoy styles so each looks different
const DECOY_STYLES: PlantSlot['decoyStyle'][] = [
  { potCol:0xb5541b, leafCol:0x27a84b, flowerCol:0xff4466, tall:false, hasFlower:true,  scale:0.9  },
  { potCol:0x7a3e12, leafCol:0x1e9c3a, flowerCol:0xffaa00, tall:true,  hasFlower:false, scale:1.0  },
  { potCol:0xc46d2a, leafCol:0x3dbf55, flowerCol:0xcc55ff, tall:false, hasFlower:true,  scale:0.85 },
  { potCol:0x8c4e1a, leafCol:0x58d68d, flowerCol:0xff6633, tall:true,  hasFlower:true,  scale:1.1  },
  { potCol:0xa05520, leafCol:0x229954, flowerCol:0x44aaff, tall:false, hasFlower:false, scale:0.95 },
  { potCol:0x6b3b0f, leafCol:0x2ecc71, flowerCol:0xff2266, tall:true,  hasFlower:true,  scale:0.88 },
  { potCol:0xd4752e, leafCol:0x1abc9c, flowerCol:0xffcc00, tall:false, hasFlower:true,  scale:1.0  },
  { potCol:0x7d4014, leafCol:0x17a589, flowerCol:0xff44aa, tall:true,  hasFlower:false, scale:1.05 },
  { potCol:0xb05c25, leafCol:0x45b39d, flowerCol:0x9955ff, tall:false, hasFlower:true,  scale:0.92 },
  { potCol:0x944d1c, leafCol:0x27ae60, flowerCol:0xff7733, tall:true,  hasFlower:true,  scale:0.96 },
];

type Phase = 'walk' | 'click' | 'done';

export class RarePlantQuestScene extends Phaser.Scene {
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;
  private discoveryDone   = false;
  private phase: Phase    = 'walk';

  private bubbleGlow?:   Phaser.GameObjects.Arc;
  private bubbleCircle?: Phaser.GameObjects.Arc;
  private bubbleIcon?:   Phaser.GameObjects.Text;
  private bubblePrompt?: Phaser.GameObjects.Text;
  private nearBubble    = false;

  private slots:         PlantSlot[] = [];
  private feedbackText?: Phaser.GameObjects.Text;
  private feedbackTimer?: Phaser.Time.TimerEvent;

  // Board dimensions (set at runtime from camera)
  private boardW = 0;
  private boardH = 0;

  constructor() { super({ key: 'RarePlantQuestScene' }); }

  // ── Preload ───────────────────────────────────────────────────────────────
  preload() {
    this.load.image('t9Bg', '/assets/backgrounds/t9-interior.png');
  }

  // ── Create ────────────────────────────────────────────────────────────────
  create() {
    this.isTransitioning = false;
    this.discoveryDone   = false;
    this.phase           = 'walk';
    this.nearBubble      = false;
    this.slots           = [];

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Background
    const bg = this.add.image(0, 0, 't9Bg').setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(WORLD_W, WORLD_H);

    // Walls
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // Ambient particles
    this._spawnAmbientParticles();

    // Central bubble
    this._createBubble();

    // Wizard
    this.wizard = new Wizard(this, SPAWN_X, SPAWN_Y);
    const spr = this.wizard.getSprite();
    spr.setDepth(SPAWN_Y + 10);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh);
      body.setOffset(Math.round((spr.width - fw) / 2), spr.height - fh);
    }
    this.physics.add.collider(spr, this.staticGroup);
    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    // Camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) => cam.setZoom(Math.min(w / 1440, h / 810) * 1.05);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) => setZoom(sz.width, sz.height));
    cam.setRoundPixels(true);
    cam.fadeIn(700, 0, 18, 4);

    eventBus.emit('SCENE_READY', { scene: 'RarePlantQuestScene' as any });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_t: number, delta: number) {
    if (this.isTransitioning || this.discoveryDone) return;
    if (this.phase !== 'walk') return;

    this.controller.update(delta);
    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);

    const d = Phaser.Math.Distance.Between(spr.x, spr.y, BUBBLE_X, BUBBLE_Y);
    const wasNear = this.nearBubble;
    this.nearBubble = d < BUBBLE_R;
    if (this.nearBubble !== wasNear) {
      this.bubblePrompt?.setVisible(this.nearBubble);
    }
  }

  // ── Interaction ───────────────────────────────────────────────────────────
  private _handleInteract() {
    if (this.isTransitioning || this.discoveryDone) return;
    if (this.phase === 'walk' && this.nearBubble) {
      this._activateBubble();
    }
  }

  // ── Bubble ────────────────────────────────────────────────────────────────
  private _createBubble() {
    const cx = BUBBLE_X, cy = BUBBLE_Y;

    this.bubbleGlow = this.add.circle(cx, cy, 54, 0x22ffaa, 0.14).setDepth(15);
    this.tweens.add({
      targets: this.bubbleGlow,
      fillAlpha: { from: 0.06, to: 0.40 },
      scaleX: { from: 0.82, to: 1.22 }, scaleY: { from: 0.82, to: 1.22 },
      duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.bubbleCircle = this.add.circle(cx, cy, 36, 0x041a0d, 0.94)
      .setStrokeStyle(2.6, 0x55ffbb, 1).setDepth(16);

    this.bubbleIcon = this.add.text(cx, cy - 3, '🌿', { fontSize: '24px' })
      .setOrigin(0.5).setDepth(17);

    this.tweens.add({
      targets: [this.bubbleGlow, this.bubbleCircle, this.bubbleIcon],
      y: '-=10', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.bubblePrompt = this.add.text(cx, cy - 68, 'E  INTERACT', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 8, y: 4 }, backgroundColor: '#1a2a0a',
    }).setOrigin(0.5).setDepth(18).setVisible(false);
  }

  // ── Activate bubble ───────────────────────────────────────────────────────
  private _activateBubble() {
    this.isTransitioning = true;
    this.controller.setBlocked(true);
    this.bubblePrompt?.setVisible(false);

    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Hide walk-phase objects
      this.bubbleGlow?.setVisible(false);
      this.bubbleCircle?.setVisible(false);
      this.bubbleIcon?.setVisible(false);
      this.wizard.getSprite().setVisible(false);
      this._showArabicMessage();
    });
  }

  // ── Arabic message ────────────────────────────────────────────────────────
  private _showArabicMessage() {
    // Full black bg (fixed to camera)
    const blackBg = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width * 3, this.scale.height * 3,
      0x000000, 1,
    ).setDepth(200).setScrollFactor(0);

    this.cameras.main.fadeIn(600, 0, 0, 0);

    const cx = this.scale.width  / 2;
    const cy = this.scale.height / 2;

    const title = this.add.text(cx, cy - 70, '✦  نداء النبات النادر  ✦', {
      fontFamily: '"Amiri", serif', fontSize: '18px',
      color: '#88ffcc', stroke: '#021208', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(202).setScrollFactor(0).setAlpha(0);

    const arabic = this.add.text(cx, cy, 'ثلاثةٌ يشبهونني، لكن واحدًا فقط هو الصحيح', {
      fontFamily: '"Amiri", serif', fontSize: '28px', fontStyle: 'bold',
      color: '#e8ffe0', stroke: '#020e06', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(202).setScrollFactor(0).setAlpha(0);

    const hint = this.add.text(cx, cy + 70, '— اضغط  E  للبدء —', {
      fontFamily: '"Amiri", serif', fontSize: '16px', color: '#66cc99',
    }).setOrigin(0.5).setDepth(202).setScrollFactor(0).setAlpha(0);

    this.tweens.add({ targets: title,  alpha: 1, duration: 500, delay: 200 });
    this.tweens.add({ targets: arabic, alpha: 1, duration: 700, delay: 500 });
    this.tweens.add({ targets: hint,   alpha: 1, duration: 500, delay: 1000 });

    this.time.delayedCall(1300, () => {
      if (!this.input.keyboard) return;
      const eKey    = this.input.keyboard.addKey('E');
      const spKey   = this.input.keyboard.addKey('SPACE');
      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        eKey.removeAllListeners();
        spKey.removeAllListeners();
        this.tweens.add({
          targets: [title, arabic, hint, blackBg], alpha: 0, duration: 500,
          onComplete: () => {
            [title, arabic, hint, blackBg].forEach(o => o.destroy());
            this._startClickGame();
          },
        });
      };
      eKey.once('down', dismiss);
      spKey.once('down', dismiss);
    });
  }

  // ── Click game ────────────────────────────────────────────────────────────
  private _startClickGame() {
    this.phase = 'click';
    this.isTransitioning = false;

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setScroll(0, 0);
    cam.setZoom(1);

    this.boardW = this.scale.width;
    this.boardH = this.scale.height;

    // Dark overlay on the background
    this.add.rectangle(
      this.boardW / 2, this.boardH / 2,
      this.boardW * 2, this.boardH * 2,
      0x000000, 0.60,
    ).setDepth(30).setScrollFactor(0);

    // Top banner
    this.add.text(this.boardW / 2, 36, '🔍  ابحث عن النبات النادر — انقر على النبات الصحيح', {
      fontFamily: '"Amiri", serif', fontSize: '17px',
      color: '#88ffcc', stroke: '#001408', strokeThickness: 4,
      padding: { x: 16, y: 7 }, backgroundColor: '#041a0ddd',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0);

    // Feedback text
    this.feedbackText = this.add.text(this.boardW / 2, this.boardH - 44, '', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold',
      color: '#ff9999', stroke: '#1a0000', strokeThickness: 5,
      padding: { x: 14, y: 8 }, backgroundColor: '#2a0000dd',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0).setAlpha(0);

    // Build slots
    let decoyStyleIdx = 0;
    this.slots = SLOT_DEFS.map(def => {
      const slot: PlantSlot = { ...def, found: false };
      if (slot.kind === 'decoy') {
        slot.decoyStyle = DECOY_STYLES[decoyStyleIdx % DECOY_STYLES.length];
        decoyStyleIdx++;
      }
      return slot;
    });

    // Draw all plants staggered
    this.slots.forEach((slot, i) => {
      this.time.delayedCall(i * 35, () => this._drawSlot(slot));
    });
  }

  // ── Draw one plant slot ───────────────────────────────────────────────────
  private _drawSlot(slot: PlantSlot) {
    const px = slot.nx * this.boardW;
    const py = slot.ny * this.boardH;

    // Graphics for the plant
    const g = this.add.graphics().setDepth(35).setScrollFactor(0);
    g.setAlpha(0);

    if (slot.kind === 'target') {
      drawTargetPlant(g, px, py);
    } else {
      drawDecoyPlant(g, px, py, slot.decoyStyle!);
    }

    // Invisible hit zone (rectangle over the plant)
    const hit = this.add.rectangle(px, py - 44, 70, 110, 0xffffff, 0)
      .setDepth(36).setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    // Label (Removed text as per user request)
    const lbl = this.add.text(px, py + 22, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#99ccaa',
    }).setOrigin(0.5).setDepth(37).setScrollFactor(0).setAlpha(0);

    // Fade in
    this.tweens.add({ targets: [g, lbl], alpha: 1, duration: 400, ease: 'Power2' });

    // Hover highlight
    hit.on('pointerover', () => {
      if (!slot.found) {
        g.setAlpha(1);
        hit.setFillStyle(0xffffff, 0.07);
      }
    });
    hit.on('pointerout', () => {
      hit.setFillStyle(0xffffff, 0);
    });

    // Click
    hit.on('pointerdown', () => this._onClickSlot(slot, g, hit, lbl));

    slot.container = undefined; // not using container, store g ref via closure
    slot.hitZone   = hit;

    // Store graphics ref so we can tint later — attach to slot via closure
    (slot as PlantSlot & { gfx?: Phaser.GameObjects.Graphics }).gfx = g;
  }

  // ── Slot clicked ──────────────────────────────────────────────────────────
  private _onClickSlot(
    slot: PlantSlot,
    g: Phaser.GameObjects.Graphics,
    hit: Phaser.GameObjects.Rectangle,
    lbl: Phaser.GameObjects.Text,
  ) {
    if (slot.found || this.discoveryDone) return;

    if (slot.kind === 'decoy') {
      // Decoys: subtle shake, nothing else — don't reveal anything
      this.tweens.add({
        targets: g, x: g.x - 5, duration: 55, yoyo: true, repeat: 3,
        onComplete: () => g.setX(0),
      });
      return;
    }

    // It's a target plant
    slot.found = true;
    hit.disableInteractive();

    if (slot.isReal) {
      this._startDiscovery(g, slot);
    } else {
      // Wrong target — dim it
      this.tweens.add({ targets: g, alpha: 0.30, duration: 300 });
      this.tweens.add({ targets: lbl, alpha: 0.20, duration: 300 });
      this._showFeedback('نبات خاطئ، ابحث مجدداً  /  Wrong plant. Keep searching.');
    }
  }

  // ── Feedback ──────────────────────────────────────────────────────────────
  private _showFeedback(msg: string) {
    if (!this.feedbackText) return;
    this.feedbackText.setText(msg).setAlpha(1);
    if (this.feedbackTimer) this.feedbackTimer.remove();
    this.feedbackTimer = this.time.delayedCall(2600, () => {
      this.tweens.add({ targets: this.feedbackText!, alpha: 0, duration: 500 });
    });
  }

  // ── Discovery ─────────────────────────────────────────────────────────────
  private _startDiscovery(g: Phaser.GameObjects.Graphics, slot: PlantSlot) {
    this.discoveryDone = true;
    for (const s of this.slots) s.hitZone?.disableInteractive();

    const px = slot.nx * this.boardW;
    const py = slot.ny * this.boardH - 44; // approx centre of plant

    // Darken room
    const dark = this.add.rectangle(
      this.boardW / 2, this.boardH / 2,
      this.boardW * 2, this.boardH * 2, 0x000000, 0,
    ).setDepth(40).setScrollFactor(0);
    this.tweens.add({ targets: dark, fillAlpha: 0.85, duration: 1200, ease: 'Power2' });

    // Plant scales up and stays on top
    g.setDepth(60);
    this.tweens.add({ targets: g, scaleX: 1.55, scaleY: 1.55, duration: 900, ease: 'Back.easeOut' });

    // Glow rings
    for (let i = 0; i < 4; i++) {
      const ring = this.add.circle(px, py, 28 + i * 18, 0x44ff88, 0)
        .setDepth(58).setScrollFactor(0);
      this.tweens.add({
        targets: ring,
        fillAlpha: { from: 0.38, to: 0 },
        scaleX: { from: 0.4, to: 2.6 }, scaleY: { from: 0.4, to: 2.6 },
        duration: 1700, delay: i * 210, repeat: 3, ease: 'Power2',
      });
    }

    // Sparkles
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const r = 55 + Math.random() * 75;
      const sp = this.add.circle(
        px + Math.cos(a) * r, py + Math.sin(a) * r,
        2 + Math.random() * 4, 0x88ffaa, 0.9,
      ).setDepth(62).setScrollFactor(0);
      this.tweens.add({
        targets: sp,
        x: px + Math.cos(a) * (r + 90),
        y: py + Math.sin(a) * (r + 90),
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 1300 + Math.random() * 800, delay: Math.random() * 400,
        ease: 'Power2',
      });
    }

    // Discovery text
    this.time.delayedCall(1500, () => {
      const t1 = this.add.text(px, py - 100, '🌿  لقد وجدت النبات النادر!', {
        fontFamily: '"Amiri", serif', fontSize: '26px', fontStyle: 'bold',
        color: '#88ffbb', stroke: '#001a08', strokeThickness: 6,
        padding: { x: 20, y: 12 }, backgroundColor: '#041a0d',
      }).setOrigin(0.5).setDepth(70).setScrollFactor(0).setAlpha(0);
      this.tweens.add({ targets: t1, alpha: 1, y: py - 118, duration: 700, ease: 'Back.easeOut' });

      const t2 = this.add.text(px, py - 60, '✨  Rare Plant Found  ✨', {
        fontFamily: 'monospace', fontSize: '14px',
        color: '#f0c060', stroke: '#1a0a00', strokeThickness: 4,
        padding: { x: 12, y: 7 }, backgroundColor: '#1a1200',
      }).setOrigin(0.5).setDepth(70).setScrollFactor(0).setAlpha(0);
      this.tweens.add({ targets: t2, alpha: 1, duration: 600, delay: 400 });
    });

    // Complete
    this.time.delayedCall(4600, () => {
      rarePlantQuestState.completed = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useGameStore } = require('../../stores/gameStore') as typeof import('../../stores/gameStore');
        const store = useGameStore.getState();
        store.setEvilPlantFound();
        if (store.evilQuestState === 'plant_active') store.setEvilQuestState('nav_h1');
      } catch { /* noop */ }

      eventBus.emit('CLOSE_QUEST' as any, { completed: true });
      this.isTransitioning = true;
      this.cameras.main.fadeOut(900, 0, 18, 4);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('BotanicalClassroomScene', { spawnX: 1000, spawnY: 620, fromQuest: true });
      });
    });
  }

  // ── Ambient particles ─────────────────────────────────────────────────────
  private _spawnAmbientParticles() {
    for (let i = 0; i < 16; i++) {
      const px = 80 + Math.random() * (WORLD_W - 160);
      const py = 80 + Math.random() * (WORLD_H - 160);
      const p  = this.add.circle(px, py, 1.5 + Math.random() * 2, 0x44ff88, 0.5).setDepth(2);
      this.tweens.add({
        targets: p, y: py - 30 - Math.random() * 30, alpha: 0,
        duration: 2600 + Math.random() * 2200, delay: Math.random() * 3500, repeat: -1,
        onRepeat: () => { p.setPosition(px, py); p.setAlpha(0.5); },
      });
    }
  }

  // ── Colliders ─────────────────────────────────────────────────────────────
  private _createColliders() {
    const T = 32;
    this._block(WORLD_W / 2, T / 2,           WORLD_W, T);
    this._block(WORLD_W / 2, WORLD_H - T / 2, WORLD_W, T);
    this._block(T / 2,       WORLD_H / 2,     T, WORLD_H);
    this._block(WORLD_W - T/2, WORLD_H / 2,   T, WORLD_H);
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }
}
