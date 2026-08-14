// ============================================================
// H2SpellQuestScene — Spell Listening Quest
// Full quest flow: inspect object → N1 → N2 → black screen
// → Arabic message → jasline.m4a → guess "expecto patronum"
// → ex.mp4 audio + BLACK→WHITE cinematic → complete
// ============================================================
import Phaser from 'phaser';
import { eventBus }         from '../EventBus';
import { Wizard }           from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';

// ── Room constants ─────────────────────────────────────────
const WORLD_W = 1680;
const WORLD_H = 960;
const SPAWN_X = 840;
const SPAWN_Y = 820;

// ── Inspectable object position (centre open floor, pool area) ────────────
const OBJECT_X  = 840;
const OBJECT_Y  = 440;
const INTERACT_R = 140;

// ── Correct spell ──────────────────────────────────────────
const CORRECT_SPELL = 'expecto patronum';

// ── Arabic riddle (displayed on black screen while jasline.m4a plays) ──────
const ARABIC_RIDDLE = `في أقسى أوقاتِ الخَطَرِ والظَّلامْ،
أظهرُ بياضاً يَمْحُو الأوهامْ..
لستُ نَجْماً يَلْمَعُ في السَّماءْ،
ولا شَمْعَةً في قاعَةِ العَشاءْ.
عِنْدَما تُحاصِرُكَ خَوْفُ الذَّكَرَيَاتْ،
وتَحْتاجُ نُوراً يَبُثُّ الحَياةْ..
اِرْفَعْ عَصاكَ واذْكُرْ أَسْعَدَ الأَيّامْ،
يَخْرُجْ طَيْفِي ليُبَدِّدَ الظَّلامْ.
أَحْمِيكَ مِنْ كُلِّ خَوْفٍ وغابْ،
وأُرِيكَ الطَّرِيقَ بلا حِسابْ..
فَمَنْ أَكُون؟`;

type QuestPhase =
  | 'room_entered'
  | 'inspect_object'
  | 'show_n1'
  | 'show_n2'
  | 'spell_intro'
  | 'playing_audio'
  | 'choose_action'
  | 'guess_spell'
  | 'spell_hint'
  | 'final_cinematic'
  | 'completed';

export class H2SpellQuestScene extends Phaser.Scene {
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;

  private phase: QuestPhase = 'room_entered';
  private isTransitioning = false;
  private nearObject      = false;
  private failedAttempts  = 0;

  // ── Game objects ───────────────────────────────────────────
  private inspectPrompt?: Phaser.GameObjects.Container;
  private uiLayer?:       Phaser.GameObjects.Container;
  private blackOverlay?:  Phaser.GameObjects.Rectangle;
  private glowOrb?:       Phaser.GameObjects.Container;

  // ── Audio ──────────────────────────────────────────────────
  private jaslineAudio?: HTMLAudioElement;
  private exAudio?:      HTMLAudioElement;

  // ── DOM input ─────────────────────────────────────────────
  private spellInput?:   HTMLInputElement;

  constructor() { super({ key: 'H2SpellQuestScene' }); }

  // ─────────────────────────────────────────────────────────
  preload() {
    this.load.image('hospitalInterior', '/assets/backgrounds/magical-hospital-interior.png');
    this.load.image('n1_img', '/assets/quest/n1.png');
    this.load.image('n2_img', '/assets/quest/n2.png');
  }

  // ─────────────────────────────────────────────────────────
  create(data?: { spawnX?: number; spawnY?: number }) {
    this.phase          = 'room_entered';
    this.isTransitioning = false;
    this.nearObject     = false;
    this.failedAttempts = 0;
    this.jaslineAudio   = undefined;
    this.exAudio        = undefined;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // ── Use the EXISTING H2 background ──────────────────────
    const bg = this.add.image(0, 0, 'hospitalInterior').setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(WORLD_W, WORLD_H);

    this._createColliders();
    this._spawnObject();

    // ── Spawn wizard ────────────────────────────────────────
    const sx = data?.spawnX ?? SPAWN_X;
    const sy = data?.spawnY ?? SPAWN_Y;
    this.wizard = new Wizard(this, sx, sy);
    const spr   = this.wizard.getSprite();
    spr.setDepth(30);

    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh);
      body.setOffset(Math.round((spr.width - fw) / 2), spr.height - fh);
    }
    this.physics.add.collider(spr, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => {
      if (this.nearObject && this.phase === 'inspect_object' && !this.isTransitioning) {
        this._startInspection();
      }
    });

    // ── Camera ─────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(spr, true, 0.08, 0.08);
    const setZoom = (w: number, h: number) => {
      this.cameras.main.setZoom(Math.min(w / 1440, h / 810) * 0.85);
    };
    setZoom(this.cameras.main.width, this.cameras.main.height);
    this.scale.on('resize', (gs: Phaser.Structs.Size) => setZoom(gs.width, gs.height));
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // ── Inspect prompt container ────────────────────────────
    this._createInspectPrompt();

    // ── Black overlay (hidden initially) ───────────────────
    this.blackOverlay = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W * 4, WORLD_H * 4, 0x000000, 0)
      .setDepth(100).setScrollFactor(0);

    // ── UI layer ────────────────────────────────────────────
    this.uiLayer = this.add.container(0, 0).setDepth(110).setScrollFactor(0);

    eventBus.emit('SCENE_READY', { scene: 'H2SpellQuestScene' });
  }

  // ─────────────────────────────────────────────────────────
  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    if (this.phase === 'room_entered' || this.phase === 'inspect_object') {
      this.controller.update(delta);
      const spr  = this.wizard.getSprite();
      const dist  = Phaser.Math.Distance.Between(spr.x, spr.y, OBJECT_X, OBJECT_Y);
      const near  = dist < INTERACT_R;
      if (near !== this.nearObject) {
        this.nearObject = near;
        if (near && this.phase === 'room_entered') {
          this.phase = 'inspect_object';
        }
        this.inspectPrompt?.setVisible(near && this.phase === 'inspect_object');
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // ── ROOM DRAWING ─────────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _drawRoom() {
    const g = this.add.graphics().setDepth(0);

    // ── Floor ───────────────────────────────────────────────
    // Dark stone tiles
    for (let tx = 0; tx < WORLD_W; tx += 80) {
      for (let ty = 0; ty < WORLD_H; ty += 80) {
        const shade = ((tx / 80 + ty / 80) % 2 === 0) ? 0x1a1020 : 0x150d1c;
        g.fillStyle(shade); g.fillRect(tx, ty, 80, 80);
        g.fillStyle(0x2a1a38, 0.3); g.fillRect(tx, ty, 80, 2);
        g.fillStyle(0x2a1a38, 0.3); g.fillRect(tx, ty, 2, 80);
      }
    }

    // Subtle floor pattern (magic circle)
    g.lineStyle(1.5, 0x6633aa, 0.15);
    g.strokeCircle(WORLD_W / 2, WORLD_H / 2, 300);
    g.strokeCircle(WORLD_W / 2, WORLD_H / 2, 200);
    g.lineStyle(1, 0x9955cc, 0.10);
    g.strokeCircle(WORLD_W / 2, WORLD_H / 2, 380);
    // Rune lines across circle
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x1 = WORLD_W / 2 + Math.cos(angle) * 200;
      const y1 = WORLD_H / 2 + Math.sin(angle) * 200;
      const x2 = WORLD_W / 2 + Math.cos(angle + Math.PI) * 200;
      const y2 = WORLD_H / 2 + Math.sin(angle + Math.PI) * 200;
      g.lineStyle(1, 0x7744bb, 0.08);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.strokePath();
    }

    // ── Ceiling ─────────────────────────────────────────────
    g.fillStyle(0x0d0814); g.fillRect(0, 0, WORLD_W, 80);
    // Ceiling beam details
    for (let bx = 0; bx < WORLD_W; bx += 200) {
      g.fillStyle(0x1c1024); g.fillRect(bx, 0, 14, 80);
      g.fillStyle(0x2a1838, 0.5); g.fillRect(bx, 0, 6, 80);
    }

    // ── Back wall ───────────────────────────────────────────
    g.fillStyle(0x120d1e); g.fillRect(0, 80, WORLD_W, 280);
    // Stone blocks
    for (let wx = 0; wx < WORLD_W; wx += 100) {
      for (let wy = 80; wy < 360; wy += 50) {
        const shade = ((wx / 100 + wy / 50) % 2 === 0) ? 0x1a1228 : 0x1e1530;
        g.fillStyle(shade); g.fillRect(wx + 1, wy + 1, 98, 48);
        g.fillStyle(0x2d1f40, 0.4); g.fillRect(wx + 1, wy + 1, 98, 4);
        g.fillStyle(0x0a0810, 0.4); g.fillRect(wx + 1, wy + 45, 98, 4);
      }
    }

    // ── Side walls ─────────────────────────────────────────
    g.fillStyle(0x120d1e); g.fillRect(0, 80, 120, WORLD_H - 80);
    g.fillStyle(0x120d1e); g.fillRect(WORLD_W - 120, 80, 120, WORLD_H - 80);
    // Wall stone blocks
    for (let wy = 80; wy < WORLD_H; wy += 60) {
      // Left
      const shL = (wy / 60 % 2 === 0) ? 0x1a1228 : 0x1e1530;
      g.fillStyle(shL); g.fillRect(1, wy + 1, 118, 58);
      g.fillStyle(0x2d1f40, 0.3); g.fillRect(1, wy + 1, 118, 3);
      // Right
      const shR = (wy / 60 % 2 === 1) ? 0x1a1228 : 0x1e1530;
      g.fillStyle(shR); g.fillRect(WORLD_W - 119, wy + 1, 118, 58);
      g.fillStyle(0x2d1f40, 0.3); g.fillRect(WORLD_W - 119, wy + 1, 118, 3);
    }

    // ── Front wall border (depth) ────────────────────────────
    g.fillStyle(0x0d0814); g.fillRect(0, WORLD_H - 60, WORLD_W, 60);

    // ── BOOKSHELVES — back wall ───────────────────────────────
    this._drawBookshelf(g, 60,  90, 340, 230);   // left bookshelf
    this._drawBookshelf(g, 760, 90, 400, 230);   // center-left
    this._drawBookshelf(g, 1280, 90, 400, 230);  // center-right
    this._drawBookshelf(g, 1520, 90, 340, 230);  // right bookshelf

    // ── SIDE BOOKSHELVES ─────────────────────────────────────
    this._drawSideBookshelf(g, 0,   360, 120, 280, false);
    this._drawSideBookshelf(g, 0,   680, 120, 260, false);
    this._drawSideBookshelf(g, WORLD_W - 120, 360, 120, 280, true);
    this._drawSideBookshelf(g, WORLD_W - 120, 680, 120, 260, true);

    // ── MAGICAL CANDLES ──────────────────────────────────────
    this._drawCandle(g, 440, 340, 0xffcc44);
    this._drawCandle(g, 600, 340, 0xffaaee);
    this._drawCandle(g, 760, 340, 0xaaddff);
    this._drawCandle(g, 1160, 340, 0xffcc44);
    this._drawCandle(g, 1320, 340, 0xffaaee);
    this._drawCandle(g, 1480, 340, 0xaaddff);

    // ── POTION BOTTLES ──────────────────────────────────────
    this._drawPotionBottle(g, 500,  310, 0x55aaff);
    this._drawPotionBottle(g, 540,  318, 0xff55aa);
    this._drawPotionBottle(g, 1380, 310, 0x55ff88);
    this._drawPotionBottle(g, 1420, 318, 0xaa55ff);

    // ── MAGIC RUNE STONES ───────────────────────────────────
    this._drawRuneStone(g, 200, 640);
    this._drawRuneStone(g, 1720, 640);

    // ── TORCH SCONCES ───────────────────────────────────────
    this._drawTorch(g, 130, 500, 0xffbb33);
    this._drawTorch(g, 1790, 500, 0xffbb33);
    this._drawTorch(g, 130, 700, 0xff8844);
    this._drawTorch(g, 1790, 700, 0xff8844);

    // ── CARPET ─────────────────────────────────────────────
    g.fillStyle(0x2d0a3a, 0.7);
    g.fillRect(WORLD_W / 2 - 200, SPAWN_Y - 200, 400, 420);
    g.lineStyle(2, 0x6622aa, 0.5);
    g.strokeRect(WORLD_W / 2 - 200, SPAWN_Y - 200, 400, 420);
    g.lineStyle(1, 0x9944cc, 0.3);
    g.strokeRect(WORLD_W / 2 - 185, SPAWN_Y - 185, 370, 390);

    // ── AMBIENT PARTICLES (static sparkles) ─────────────────
    const rng = this._seededRand(77);
    for (let i = 0; i < 40; i++) {
      const px = 130 + rng() * (WORLD_W - 260);
      const py = 90  + rng() * (WORLD_H - 150);
      const alpha = 0.2 + rng() * 0.5;
      const col = [0xaa88ff, 0xffcc44, 0xaaddff, 0xff88cc][Math.floor(rng() * 4)];
      g.fillStyle(col, alpha);
      g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2);
    }
  }

  private _drawBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    // Frame
    g.fillStyle(0x3d2010); g.fillRect(x, y, w, h);
    g.fillStyle(0x5a3018); g.fillRect(x, y, w, 6);
    g.fillStyle(0x5a3018); g.fillRect(x, y + h - 6, w, 6);
    // Shelves
    const shelfCount = 4;
    const shelfH = Math.floor(h / shelfCount);
    for (let si = 0; si < shelfCount; si++) {
      const sy = y + si * shelfH;
      g.fillStyle(0x5a3018); g.fillRect(x, sy + shelfH - 6, w, 8);
      // Books on each shelf
      let bx = x + 8;
      const bRng = this._seededRnd2(si * 100 + x);
      while (bx < x + w - 14) {
        const bw = 12 + Math.floor(bRng() * 14);
        const bh = Math.floor(shelfH * (0.55 + bRng() * 0.35));
        const bookColors = [0x8b1a1a, 0x1a3a8b, 0x1a6b2a, 0x8b6a1a, 0x4a1a8b, 0x8b2a5a, 0x5a1a0a];
        const bc = bookColors[Math.floor(bRng() * bookColors.length)];
        if (bx + bw > x + w - 8) break;
        g.fillStyle(bc); g.fillRect(bx, sy + shelfH - 6 - bh, bw - 2, bh);
        g.fillStyle(0xffffff, 0.08); g.fillRect(bx, sy + shelfH - 6 - bh, 3, bh);
        g.fillStyle(0x000000, 0.15); g.fillRect(bx + bw - 4, sy + shelfH - 6 - bh, 2, bh);
        // Spine label
        g.fillStyle(0xddccaa, 0.3); g.fillRect(bx + 2, sy + shelfH - 6 - bh + 8, bw - 6, 4);
        bx += bw + 1;
      }
    }
    // Side borders
    g.fillStyle(0x4a2810, 0.8); g.fillRect(x, y, 8, h);
    g.fillStyle(0x4a2810, 0.8); g.fillRect(x + w - 8, y, 8, h);
  }

  private _drawSideBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, flipX: boolean) {
    const rx = flipX ? x : x;
    g.fillStyle(0x3d2010); g.fillRect(rx, y, w, h);
    const shelfCount = 3;
    const shelfH = Math.floor(h / shelfCount);
    for (let si = 0; si < shelfCount; si++) {
      const sy = y + si * shelfH;
      g.fillStyle(0x5a3018); g.fillRect(rx, sy + shelfH - 5, w, 6);
      let bx = rx + 6;
      const bRng = this._seededRnd2(si * 200 + y);
      while (bx < rx + w - 10) {
        const bw = 10 + Math.floor(bRng() * 12);
        const bh = Math.floor(shelfH * (0.5 + bRng() * 0.38));
        const bc = [0x8b1a1a, 0x1a3a8b, 0x1a6b2a, 0x8b6a1a, 0x4a1a8b][Math.floor(bRng() * 5)];
        if (bx + bw > rx + w - 8) break;
        g.fillStyle(bc); g.fillRect(bx, sy + shelfH - 5 - bh, bw - 2, bh);
        g.fillStyle(0xffffff, 0.07); g.fillRect(bx, sy + shelfH - 5 - bh, 2, bh);
        bx += bw + 1;
      }
    }
  }

  private _drawCandle(g: Phaser.GameObjects.Graphics, x: number, y: number, flameCol: number) {
    // Holder
    g.fillStyle(0x8a7020); g.fillRect(x - 8, y + 28, 16, 6);
    g.fillStyle(0xb09030); g.fillRect(x - 6, y + 28, 8, 4);
    // Wax
    g.fillStyle(0xf0e8d8); g.fillRect(x - 5, y, 10, 32);
    g.fillStyle(0xffffff, 0.3); g.fillRect(x - 5, y, 4, 32);
    g.fillStyle(0xddd0c0); g.fillRect(x + 2, y, 3, 32);
    // Wick
    g.fillStyle(0x333322); g.fillRect(x - 1, y - 6, 2, 8);
    // Flame (multi-layer for glow effect)
    g.fillStyle(flameCol, 0.15); g.fillEllipse(x, y - 16, 28, 28);
    g.fillStyle(flameCol, 0.5);  g.fillEllipse(x, y - 12, 14, 18);
    g.fillStyle(0xffee88, 0.85); g.fillEllipse(x, y - 10, 8, 14);
    g.fillStyle(0xffffff, 0.7);  g.fillEllipse(x, y - 8, 4, 8);
  }

  private _drawPotionBottle(g: Phaser.GameObjects.Graphics, x: number, y: number, col: number) {
    // Body
    g.fillStyle(col, 0.7); g.fillEllipse(x, y + 20, 20, 28);
    g.fillStyle(0x1a1020); g.fillRect(x - 5, y, 10, 15);
    g.fillStyle(col, 0.8); g.fillRect(x - 4, y + 2, 8, 11);
    // Cork
    g.fillStyle(0xc8a060); g.fillRect(x - 4, y - 4, 8, 6);
    // Highlight
    g.fillStyle(0xffffff, 0.35); g.fillEllipse(x - 4, y + 14, 7, 12);
  }

  private _drawRuneStone(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x000000, 0.14); g.fillEllipse(x + 4, y + 14, 60, 20);
    g.fillStyle(0x2d2a3e);       g.fillRect(x - 18, y - 36, 36, 50);
    g.fillStyle(0x3d3850);       g.fillRect(x - 18, y - 36, 18, 50);
    g.fillStyle(0x220044, 0.45); g.fillRect(x - 12, y - 28, 24, 34);
    g.fillStyle(0xaa88ff, 0.5);  g.fillRect(x - 6, y - 24, 12, 8);
    g.fillStyle(0xaa88ff, 0.5);  g.fillRect(x - 6, y - 12, 12, 8);
    g.fillStyle(0xcc99ff, 0.3);  g.fillRect(x - 3, y - 3, 6, 14);
    g.fillStyle(0x8866ee, 0.2);  g.fillEllipse(x, y - 14, 52, 52);
  }

  private _drawTorch(g: Phaser.GameObjects.Graphics, x: number, y: number, col: number) {
    // Bracket
    g.fillStyle(0x5a4010); g.fillRect(x - 3, y - 24, 6, 28);
    g.fillStyle(0x7a5820); g.fillRect(x - 6, y - 6, 12, 8);
    // Bowl
    g.fillStyle(0x3a2808); g.fillRect(x - 8, y - 30, 16, 10);
    g.fillStyle(0x5a3c18); g.fillRect(x - 8, y - 30, 8, 10);
    // Flame
    g.fillStyle(col, 0.18); g.fillEllipse(x, y - 44, 36, 36);
    g.fillStyle(col, 0.6);  g.fillEllipse(x, y - 38, 18, 22);
    g.fillStyle(0xffee88, 0.9); g.fillEllipse(x, y - 34, 10, 14);
    g.fillStyle(0xffffff, 0.6); g.fillEllipse(x, y - 30, 5, 8);
  }

  // ─────────────────────────────────────────────────────────
  // ── GLOWING INSPECTABLE OBJECT ───────────────────────────
  // ─────────────────────────────────────────────────────────
  private _spawnObject() {
    const container = this.add.container(OBJECT_X, OBJECT_Y).setDepth(20);

    const g = this.add.graphics();

    // Pedestal
    g.fillStyle(0x2a1a3a);  g.fillRect(-28, 40, 56, 50);
    g.fillStyle(0x3d2a50);  g.fillRect(-28, 40, 56, 8);
    g.fillStyle(0x1a0d22);  g.fillRect(-28, 82, 56, 8);
    g.fillStyle(0x4a3060);  g.fillRect(-36, 80, 72, 16);
    g.fillStyle(0x2d1e42);  g.fillRect(-36, 96, 72, 8);
    // Runes on pedestal
    g.fillStyle(0xaa88ff, 0.4); g.fillRect(-18, 50, 6, 20);
    g.fillStyle(0xaa88ff, 0.4); g.fillRect(-4,  50, 8, 20);
    g.fillStyle(0xaa88ff, 0.4); g.fillRect(12,  50, 6, 20);

    // Crystal orb base layers (outer to inner)
    g.fillStyle(0x8844cc, 0.15); g.fillEllipse(0, 10, 120, 120);
    g.fillStyle(0xaa55ee, 0.25); g.fillEllipse(0, 10, 90, 90);
    g.fillStyle(0x6622aa, 0.6);  g.fillEllipse(0, 10, 66, 66);
    g.fillStyle(0x9933ee, 0.85); g.fillEllipse(0, 10, 54, 54);
    g.fillStyle(0xcc66ff, 0.9);  g.fillEllipse(0, 10, 40, 40);
    g.fillStyle(0xeeb8ff, 1.0);  g.fillEllipse(0, 10, 24, 24);
    // Highlight
    g.fillStyle(0xffffff, 0.7);  g.fillEllipse(-8, 0, 12, 10);
    g.fillStyle(0xffffff, 0.4);  g.fillEllipse(-5, 2, 6, 5);

    container.add(g);
    this.glowOrb = container;

    // Pulsing glow rings (separate graphics for tween-ability)
    const ring1 = this.add.circle(OBJECT_X, OBJECT_Y, 50, 0xaa44ee, 0.0).setDepth(19);
    const ring2 = this.add.circle(OBJECT_X, OBJECT_Y, 70, 0x8833cc, 0.0).setDepth(18);
    const ring3 = this.add.circle(OBJECT_X, OBJECT_Y, 90, 0x6622aa, 0.0).setDepth(17);

    this.tweens.add({
      targets: ring1, fillAlpha: { from: 0.0, to: 0.35 },
      radius:  { from: 44, to: 56 },
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: ring2, fillAlpha: { from: 0.0, to: 0.22 },
      radius:  { from: 60, to: 78 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 200,
    });
    this.tweens.add({
      targets: ring3, fillAlpha: { from: 0.0, to: 0.12 },
      radius:  { from: 80, to: 100 },
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 400,
    });

    // Float animation on the orb itself
    this.tweens.add({
      targets: container, y: OBJECT_Y - 10,
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ─────────────────────────────────────────────────────────
  // ── INSPECT PROMPT ───────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _createInspectPrompt() {
    const container = this.add.container(OBJECT_X, OBJECT_Y - 100).setDepth(25).setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0814, 0.92); bg.fillRoundedRect(-70, -20, 140, 38, 8);
    bg.lineStyle(1.5, 0xc9a227, 1); bg.strokeRoundedRect(-70, -20, 140, 38, 8);

    const txt = this.add.text(0, 0, '✦  Inspect  ✦', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize:   '14px',
      color:      '#f0cd60',
    }).setOrigin(0.5);

    container.add([bg, txt]);
    this.tweens.add({
      targets: container, y: OBJECT_Y - 108,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.inspectPrompt = container;
  }

  // ─────────────────────────────────────────────────────────
  // ── COLLIDERS ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _createColliders() {
    this.staticGroup = this.physics.add.staticGroup();

    const addWall = (x: number, y: number, w: number, h: number) => {
      const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0);
      this.physics.add.existing(r, true);
      this.staticGroup.add(r);
    };

    // World boundaries
    addWall(0, 0, WORLD_W, 80);          // top wall
    addWall(0, WORLD_H - 60, WORLD_W, 60); // bottom wall
    addWall(0, 80, 120, WORLD_H - 140);  // left wall
    addWall(WORLD_W - 120, 80, 120, WORLD_H - 140); // right wall
    // Back wall with bookshelves
    addWall(0, 80, WORLD_W, 260);
    // Object pedestal
    addWall(OBJECT_X - 36, OBJECT_Y + 80, 72, 24);
  }

  // ─────────────────────────────────────────────────────────
  // ── QUEST FLOW ───────────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _startInspection() {
    if (this.phase !== 'inspect_object') return;
    this.phase = 'show_n1';
    this.isTransitioning = true;
    this.controller.setBlocked(true);
    this.inspectPrompt?.setVisible(false);
    this._showN1();
  }

  // ── N1 Image display ────────────────────────────────────
  private _showN1() {
    this.phase = 'show_n1';
    this._clearUI();

    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    // Build UI in uiLayer (scrollFactor=0 so it's fixed on screen)
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, w, h);

    // Magical panel border
    const panel = this.add.graphics();
    const pw = Math.min(w * 0.85, 900), ph = Math.min(h * 0.85, 640);
    const px = cx - pw / 2, py = cy - ph / 2;
    panel.fillStyle(0x0d0814, 0.98); panel.fillRoundedRect(px - 4, py - 4, pw + 8, ph + 8, 12);
    panel.lineStyle(3, 0xc9a227, 1);  panel.strokeRoundedRect(px - 4, py - 4, pw + 8, ph + 8, 12);
    panel.lineStyle(1, 0xaa7733, 0.5); panel.strokeRoundedRect(px - 8, py - 8, pw + 16, ph + 16, 16);
    // Corner gems
    [[px - 4, py - 4], [px + pw + 4, py - 4], [px - 4, py + ph + 4], [px + pw + 4, py + ph + 4]]
      .forEach(([gx, gy]) => {
        panel.fillStyle(0xc9a227); panel.fillCircle(gx, gy, 6);
        panel.fillStyle(0xffe080); panel.fillCircle(gx, gy, 3);
      });

    // Image
    const img = this.add.image(cx, cy - 14, 'n1_img').setScrollFactor(0).setDepth(115);
    const scale = Math.min((pw - 20) / img.width, (ph - 60) / img.height);
    img.setScale(scale);

    // Continue hint
    const hint = this.add.text(cx, py + ph - 10, '— Press ENTER to continue —', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c9a227'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(116).setAlpha(0.8);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });

    this.uiLayer!.add([overlay, panel, hint]);

    // ENTER key handler
    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const onEnter = () => {
      enterKey.off('down', onEnter);
      img.destroy();
      hint.destroy();
      this._showN2();
    };
    enterKey.on('down', onEnter);
  }

  // ── N2 Image display ────────────────────────────────────
  private _showN2() {
    this.phase = 'show_n2';
    this._clearUI();

    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85); overlay.fillRect(0, 0, w, h);

    const panel = this.add.graphics();
    const pw = Math.min(w * 0.85, 900), ph = Math.min(h * 0.85, 640);
    const px = cx - pw / 2, py = cy - ph / 2;
    panel.fillStyle(0x0d0814, 0.98); panel.fillRoundedRect(px - 4, py - 4, pw + 8, ph + 8, 12);
    panel.lineStyle(3, 0xc9a227, 1);  panel.strokeRoundedRect(px - 4, py - 4, pw + 8, ph + 8, 12);
    [[px - 4, py - 4], [px + pw + 4, py - 4], [px - 4, py + ph + 4], [px + pw + 4, py + ph + 4]]
      .forEach(([gx, gy]) => {
        panel.fillStyle(0xc9a227); panel.fillCircle(gx, gy, 6);
        panel.fillStyle(0xffe080); panel.fillCircle(gx, gy, 3);
      });

    const img = this.add.image(cx, cy - 14, 'n2_img').setScrollFactor(0).setDepth(115);
    const scale = Math.min((pw - 20) / img.width, (ph - 60) / img.height);
    img.setScale(scale);

    const hint = this.add.text(cx, py + ph - 10, '— Press ENTER to continue —', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#c9a227',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(116);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });

    this.uiLayer!.add([overlay, panel, hint]);

    const enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const onEnter = () => {
      enterKey.off('down', onEnter);
      img.destroy();
      hint.destroy();
      this._transitionToBlackScreen();
    };
    enterKey.on('down', onEnter);
  }

  // ── BLACK SCREEN TRANSITION ──────────────────────────────
  private _transitionToBlackScreen() {
    this.phase = 'spell_intro';
    this._clearUI();

    // Fade to black
    this.tweens.add({
      targets:   this.blackOverlay,
      fillAlpha: 1,
      duration:  800,
      ease:      'Power2',
      onComplete: () => this._showStartListeningMessage(),
    });
  }

  // ── MAGICAL "START LISTENING" INTRO MESSAGE ───────────────
  private _showStartListeningMessage() {
    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    // Floating magical particles (static sparkles)
    const pg = this.add.graphics().setScrollFactor(0).setDepth(115);
    const rng = this._seededRand(55);
    for (let i = 0; i < 30; i++) {
      const px = 60 + rng() * (w - 120);
      const py = 40 + rng() * (h - 80);
      const col = [0xc9a227, 0xaa88ff, 0xaaddff, 0xff88cc][Math.floor(rng() * 4)];
      pg.fillStyle(col, 0.3 + rng() * 0.5);
      pg.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
    this.uiLayer!.add(pg);

    // Decorative gold border lines
    const borderG = this.add.graphics().setScrollFactor(0).setDepth(116);
    borderG.lineStyle(1.5, 0xc9a227, 0.4);
    borderG.strokeRect(24, 24, w - 48, h - 48);
    borderG.lineStyle(1, 0xaa7733, 0.2);
    borderG.strokeRect(30, 30, w - 60, h - 60);
    // Corner ornaments
    [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]].forEach(([gx, gy]) => {
      borderG.fillStyle(0xc9a227, 0.7); borderG.fillCircle(gx, gy, 5);
      borderG.fillStyle(0xffe080, 0.9); borderG.fillCircle(gx, gy, 2.5);
    });
    this.uiLayer!.add(borderG);

    // Title
    const title = this.add.text(cx, cy - 120, '✦  A Riddle Awaits  ✦', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize:   '22px',
      color:      '#f0cd60',
      align:      'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(117).setAlpha(0);

    // Subtitle
    const sub = this.add.text(cx, cy - 72, 'Listen carefully to the words...', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#ccbbdd',
      align:      'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(117).setAlpha(0);

    // "Start Listening" button
    const btnW = 260, btnH = 60;
    const btnBg = this.add.graphics().setScrollFactor(0).setDepth(117);
    btnBg.fillStyle(0x0d0814, 0.96);
    btnBg.fillRoundedRect(cx - btnW / 2, cy + 20, btnW, btnH, 12);
    btnBg.lineStyle(2.5, 0xc9a227, 1);
    btnBg.strokeRoundedRect(cx - btnW / 2, cy + 20, btnW, btnH, 12);
    // Corner gems on button
    [[cx - btnW / 2, cy + 20], [cx + btnW / 2, cy + 20],
     [cx - btnW / 2, cy + 80], [cx + btnW / 2, cy + 80]].forEach(([gx, gy]) => {
      btnBg.fillStyle(0xc9a227); btnBg.fillCircle(gx, gy, 4);
      btnBg.fillStyle(0xffe080); btnBg.fillCircle(gx, gy, 2);
    });

    const btnTxt = this.add.text(cx, cy + 50, '♪  Start Listening', {
      fontFamily: 'Georgia, serif',
      fontSize:   '19px',
      color:      '#f0cd60',
      align:      'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(118).setAlpha(0);

    // Interactive hit area
    const hitZone = this.add.rectangle(cx, cy + 50, btnW, btnH, 0x000000, 0)
      .setScrollFactor(0).setDepth(119)
      .setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0xc9a227, 0.18);
      btnBg.fillRoundedRect(cx - btnW / 2, cy + 20, btnW, btnH, 12);
      btnBg.lineStyle(2.5, 0xf0cd60, 1);
      btnBg.strokeRoundedRect(cx - btnW / 2, cy + 20, btnW, btnH, 12);
      btnTxt.setStyle({ color: '#fff8cc' });
    });
    hitZone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x0d0814, 0.96);
      btnBg.fillRoundedRect(cx - btnW / 2, cy + 20, btnW, btnH, 12);
      btnBg.lineStyle(2.5, 0xc9a227, 1);
      btnBg.strokeRoundedRect(cx - btnW / 2, cy + 20, btnW, btnH, 12);
      btnTxt.setStyle({ color: '#f0cd60' });
    });
    hitZone.on('pointerdown', () => {
      hitZone.destroy();
      this._clearUI();
      this._showArabicMessage();
    });

    this.uiLayer!.add([title, sub, btnBg, btnTxt, hitZone]);

    // Fade-in sequence
    this.tweens.add({ targets: title, alpha: 1, y: cy - 110, duration: 900, ease: 'Back.easeOut' });
    this.time.delayedCall(400, () => {
      this.tweens.add({ targets: sub, alpha: 1, duration: 700, ease: 'Power2' });
    });
    this.time.delayedCall(800, () => {
      this.tweens.add({ targets: btnTxt, alpha: 1, duration: 600, ease: 'Power2' });
    });
  }

  // ── ARABIC MESSAGE ───────────────────────────────────────
  private _showArabicMessage() {
    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    // Arabic text — displayed on the black screen
    const arabicTxt = this.add.text(cx, cy, ARABIC_RIDDLE, {
      fontFamily: '"Segoe UI", "Arial Unicode MS", Arial, sans-serif',
      fontSize:   '22px',
      color:      '#e8d4a2',
      align:      'center',
      wordWrap:   { width: Math.min(w * 0.75, 700) },
      rtl:        true,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(120)
      .setAlpha(0);

    this.tweens.add({
      targets: arabicTxt, alpha: 1,
      duration: 1200, ease: 'Power2',
      onComplete: () => this._playJaslineAudio(arabicTxt),
    });
  }

  // ── PLAY JASLINE.M4A ─────────────────────────────────────
  private _playJaslineAudio(arabicTxt: Phaser.GameObjects.Text) {
    this.phase = 'playing_audio';
    this._clearUI();
    
    // Pause background game music
    const gameAudio = document.getElementById('bg-music-game') as HTMLAudioElement | null;
    if (gameAudio) {
      gameAudio.pause();
    }

    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    // Subtle audio indicator
    const indicator = this.add.text(cx, cy + 60, '♪  Listening...', {
      fontFamily: 'Georgia, serif',
      fontSize:   '16px',
      color:      '#8866cc',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0);

    this.tweens.add({
      targets: indicator, alpha: { from: 0.2, to: 0.9 },
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Create and play HTML audio
    const audio = new Audio('/assets/audio/jasline.m4a');
    this.jaslineAudio = audio;
    audio.volume = 1.0;

    const onEnd = () => {
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      indicator.destroy();
      arabicTxt.setVisible(false);
      this._showChoices(arabicTxt);
    };

    const onError = () => {
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      console.warn('[H2Quest] jasline.m4a failed to load. Showing choices anyway.');
      indicator.setText('⚠ Audio unavailable — click to retry');
      indicator.setStyle({ color: '#ff8844' });
      indicator.setAlpha(1);
      this.tweens.killTweensOf(indicator);

      // Retry button behaviour: click indicator
      indicator.setInteractive({ useHandCursor: true });
      indicator.once('pointerdown', () => {
        indicator.destroy();
        this._playJaslineAudio(arabicTxt);
      });
    };

    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);

    audio.play().catch(() => onError());
  }

  // ── TWO CHOICES ─────────────────────────────────────────
  private _showChoices(arabicTxt: Phaser.GameObjects.Text) {
    this.phase = 'choose_action';
    this._clearUI();

    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    // Arabic message should be hidden during choices
    arabicTxt.setVisible(false);

    const makeButton = (
      label: string, bx: number, by: number,
      accentCol: number, textCol: string,
      onClick: () => void
    ): Phaser.GameObjects.Container => {
      const cont = this.add.container(bx, by).setScrollFactor(0).setDepth(125).setInteractive(
        new Phaser.Geom.Rectangle(-110, -26, 220, 52), Phaser.Geom.Rectangle.Contains
      );

      const bg = this.add.graphics();
      bg.fillStyle(0x0d0814, 0.95); bg.fillRoundedRect(-110, -26, 220, 52, 10);
      bg.lineStyle(2, accentCol, 1); bg.strokeRoundedRect(-110, -26, 220, 52, 10);

      const txt = this.add.text(0, 0, label, {
        fontFamily: '"Segoe UI", Arial, sans-serif',
        fontSize:   '18px',
        color:      textCol,
        rtl:        true,
      }).setOrigin(0.5);

      cont.add([bg, txt]);

      cont.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(accentCol, 0.2); bg.fillRoundedRect(-110, -26, 220, 52, 10);
        bg.lineStyle(2, accentCol, 1); bg.strokeRoundedRect(-110, -26, 220, 52, 10);
      });
      cont.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x0d0814, 0.95); bg.fillRoundedRect(-110, -26, 220, 52, 10);
        bg.lineStyle(2, accentCol, 1); bg.strokeRoundedRect(-110, -26, 220, 52, 10);
      });
      cont.on('pointerdown', () => {
        this._clearUI();
        arabicTxt.destroy();
        onClick();
      });

      return cont;
    };

    const guessBtn = makeButton(
      'خمن التعويذة', cx - 130, cy + 60,
      0xc9a227, '#f0cd60',
      () => this._showSpellInput()
    );
    const listenBtn = makeButton(
      'استمع مرة أخرى', cx + 130, cy + 60,
      0x8855cc, '#cc99ff',
      () => {
        // Re-show arabic message and play audio again
        arabicTxt.setVisible(true);
        this._playJaslineAudio(arabicTxt);
      }
    );

    this.uiLayer!.add([guessBtn, listenBtn]);
  }

  // ── SPELL INPUT ─────────────────────────────────────────
  private _showSpellInput() {
    this.phase = 'guess_spell';
    this._clearUI();
    this._removeSpellInput();

    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    // Panel background
    const panel = this.add.graphics().setScrollFactor(0).setDepth(120);
    const pw = Math.min(w * 0.72, 600), ph = 260;
    const px = cx - pw / 2, py = cy - ph / 2;
    panel.fillStyle(0x060410, 0.97); panel.fillRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(2.5, 0xc9a227, 1); panel.strokeRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(1, 0xaa7733, 0.4); panel.strokeRoundedRect(px - 4, py - 4, pw + 8, ph + 8, 18);
    // Corner gems
    [[px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph]].forEach(([gx, gy]) => {
      panel.fillStyle(0xc9a227); panel.fillCircle(gx, gy, 5);
      panel.fillStyle(0xffe080); panel.fillCircle(gx, gy, 2.5);
    });

    const title = this.add.text(cx, py + 32, '✦  GUESS THE SPELL  ✦', {
      fontFamily: 'Georgia, serif', fontSize: '18px',
      color: '#f0cd60', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(121);

    const subTitle = this.add.text(cx, py + 60, 'Type the spell and press ENTER', {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#9977aa', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(121);

    // Feedback text (error / success)
    const feedback = this.add.text(cx, py + ph - 30, '', {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#ff8888', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(121);

    this.uiLayer!.add([panel, title, subTitle, feedback]);

    // Show hint if 3+ failed attempts
    if (this.failedAttempts >= 3) {
      this._showHintInPanel(px, py, pw, ph, cx);
    }

    // Calculate canvas-relative position for the DOM input
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width  / Number(this.game.config.width);
    const scaleY = canvasRect.height / Number(this.game.config.height);

    // Input field dimensions in game-space
    const inputW  = pw - 60;
    const inputH  = 44;
    const inputX  = px + 30;
    const inputY  = py + 100;

    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.placeholder = '...';
    inp.id          = 'h2-spell-input';
    inp.autocomplete = 'off';
    inp.spellcheck   = false;

    // Prevent Phaser from swallowing key events like 'E'
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    inp.addEventListener('keypress', (e) => e.stopPropagation());

    // Style the input
    Object.assign(inp.style, {
      position:        'fixed',
      left:            `${canvasRect.left + inputX * scaleX}px`,
      top:             `${canvasRect.top  + inputY * scaleY}px`,
      width:           `${inputW * scaleX}px`,
      height:          `${inputH * scaleY}px`,
      background:      '#0a0618',
      border:          '2px solid #6633aa',
      borderRadius:    '8px',
      color:           '#e8d4f0',
      fontFamily:      'Georgia, "Times New Roman", serif',
      fontSize:        `${Math.round(16 * scaleY)}px`,
      padding:         '4px 14px',
      outline:         'none',
      textAlign:       'center',
      letterSpacing:   '2px',
      boxShadow:       '0 0 18px rgba(120, 50, 220, 0.45), inset 0 0 8px rgba(80,30,160,0.3)',
      zIndex:          '9999',
      boxSizing:       'border-box',
    });

    document.body.appendChild(inp);
    this.spellInput = inp;

    // Focus slightly deferred to avoid event conflicts
    this.time.delayedCall(80, () => inp.focus());

    // Handle ENTER on DOM input
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const typed = inp.value.trim().toLowerCase();
        if (typed === CORRECT_SPELL) {
          inp.removeEventListener('keydown', onKeyDown);
          this._removeSpellInput();
          this._clearUI();
          this._startFinalCinematic();
        } else {
          this.failedAttempts++;
          this._getStore()?.incrementH2Attempts();
          feedback.setText(`✗  Wrong spell. Try again.  (${this.failedAttempts}/3 attempts)`);
          feedback.setStyle({ color: '#ff6666' });
          inp.value = '';
          inp.style.borderColor = '#ff4444';
          inp.style.boxShadow   = '0 0 18px rgba(255,60,60,0.45)';
          this.time.delayedCall(600, () => {
            if (inp && document.body.contains(inp)) {
              inp.style.borderColor = '#6633aa';
              inp.style.boxShadow   = '0 0 18px rgba(120,50,220,0.45)';
            }
          });
          if (this.failedAttempts >= 3 && this.phase === 'guess_spell') {
            this.phase = 'spell_hint';
            this._removeSpellInput();
            this._clearUI();
            this._showSpellInput(); // re-render with hint
          }
        }
      }
    };

    inp.addEventListener('keydown', onKeyDown);
  }

  // ── HINT in panel ────────────────────────────────────────
  private _showHintInPanel(px: number, py: number, pw: number, ph: number, cx: number) {
    const hintBg = this.add.graphics().setScrollFactor(0).setDepth(122);
    const hx = px + 30, hy = py + 155, hw = pw - 60, hh = 68;
    hintBg.fillStyle(0x1a0a2e, 0.95); hintBg.fillRoundedRect(hx, hy, hw, hh, 8);
    hintBg.lineStyle(1.5, 0xaa88ff, 0.8); hintBg.strokeRoundedRect(hx, hy, hw, hh, 8);

    const hintLabel = this.add.text(cx, hy + 14, '💡  Hint:', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#aabbff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(123);

    const spellHint = this.add.text(cx, hy + 38, 'expecto patronum', {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize:   '16px',
      color:      '#ccffcc',
      letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(123);

    this.uiLayer!.add([hintBg, hintLabel, spellHint]);
  }

  // ─────────────────────────────────────────────────────────
  // ── FINAL CINEMATIC ──────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _startFinalCinematic() {
    this.phase = 'final_cinematic';
    this.isTransitioning = true;
    this.controller.setBlocked(true);

    // Make sure black overlay is fully opaque (should already be)
    this.blackOverlay!.setFillStyle(0x000000).setAlpha(1);

    // Create white overlay (starts transparent)
    const whiteOverlay = this.add.rectangle(
      WORLD_W / 2, WORLD_H / 2, WORLD_W * 4, WORLD_H * 4,
      0xffffff, 0
    ).setDepth(150).setScrollFactor(0);

    const store = this._getStore();
    const isGood = store?.playerPath === 'good' || store?.playerPath !== 'evil';
    const msg = isGood
      ? 'الطالب يحل اللغز بدافع الفضول، لكنه عندما يجد شيئًا يخص هافلباف يعيده لمكانه بدل ما يأخذه لنفسه.'
      : 'الطالب يحل نفس اللغز، لكن عندما يجد الشيء يقرر أخذه لأنه يعتقد أنه قد يكون مفيدًا له.';

    const { w, h } = this._camSize();
    const cx = w / 2, cy = h / 2;

    const finalTxt = this.add.text(cx, cy, msg, {
      fontFamily: '"Segoe UI", "Arial Unicode MS", Arial, sans-serif',
      fontSize:   '26px',
      color:      '#ffd700',
      align:      'center',
      wordWrap:   { width: Math.min(w * 0.8, 800) },
      rtl:        true,
      lineSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(151).setAlpha(0);

    const startFade = () => {
      // Fade BLACK -> WHITE over 3 seconds
      this.tweens.add({
        targets:  whiteOverlay,
        fillAlpha: 1,
        duration:  3000,
        ease:      'Power2',
      });
    };

    const showEndingText = () => {
      // Cut back to black screen by hiding white overlay
      whiteOverlay.setVisible(false);
      
      this.tweens.add({
        targets: finalTxt,
        alpha: 1,
        duration: 1500,
        onComplete: () => {
          this.time.delayedCall(5000, () => {
            this.tweens.add({
              targets: finalTxt,
              alpha: 0,
              duration: 1000,
              onComplete: () => this._playEndingVideo(isGood)
            });
          });
        }
      });
    };

    // Play ex.mp4 audio
    const audioEl = document.createElement('audio');
    audioEl.src    = '/assets/audio/ex.mp4';
    audioEl.volume = 1.0;
    this.exAudio   = audioEl;
    document.body.appendChild(audioEl);

    audioEl.addEventListener('canplaythrough', () => {
      audioEl.play().then(startFade).catch(startFade);
    }, { once: true });

    audioEl.addEventListener('error', () => {
      console.warn('[H2Quest] ex.mp4 audio failed. Continuing to text.');
      startFade();
      this.time.delayedCall(3000, showEndingText);
    }, { once: true });

    // If audio loads very quickly and canplaythrough already fired
    if (audioEl.readyState >= 4) {
      audioEl.play().then(startFade).catch(startFade);
    }
    audioEl.load();

    audioEl.addEventListener('ended', showEndingText, { once: true });
  }

  private _playEndingVideo(isGood: boolean) {
    const videoSrc = isGood ? 'https://res.cloudinary.com/wjmuvpvo/video/upload/happy.mp4' : 'https://res.cloudinary.com/wjmuvpvo/video/upload/sad.mp4';
    const audioSrc = isGood ? '/assets/audio/happym.mp3' : '/assets/audio/sadm.mp3';

    // ── Preload end.mp4 immediately so it buffers while video 1 plays ──
    const endVideoPreload = document.createElement('video');
    endVideoPreload.src = 'https://res.cloudinary.com/wjmuvpvo/video/upload/end.mp4';
    endVideoPreload.preload = 'auto';
    endVideoPreload.style.display = 'none';
    document.body.appendChild(endVideoPreload);
    endVideoPreload.load();

    // ── Video 1 (happy / sad) ──
    const videoEl = document.createElement('video');
    videoEl.src = videoSrc;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    Object.assign(videoEl.style, {
      position: 'fixed',
      top: '0', left: '0',
      width: '100vw', height: '100vh',
      objectFit: 'cover',
      zIndex: '9999',
      backgroundColor: 'black'
    });

    // ── Audio companion (happym.mp3 / sadm.mp3) ──
    const audioEl = document.createElement('audio');
    audioEl.src = audioSrc;
    audioEl.volume = 0.05;

    document.body.appendChild(videoEl);
    document.body.appendChild(audioEl);

    // ── Plays end.mp4 after video 1 finishes, guaranteed ──
    let endVideoScheduled = false;
    const playEndVideo = () => {
      if (endVideoScheduled) return;
      endVideoScheduled = true;

      // Clean up video 1 and audio
      videoEl.pause();
      videoEl.remove();
      audioEl.pause();
      audioEl.remove();

      // Reuse the preloaded element — make it fullscreen
      const endVid = endVideoPreload;
      endVid.style.display = '';
      endVid.playsInline = true;
      Object.assign(endVid.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '100vw', height: '100vh',
        objectFit: 'cover',
        zIndex: '9999',
        backgroundColor: 'black'
      });

      const onEndFinish = () => {
        endVid.remove();
        this._completeQuest();
      };

      endVid.addEventListener('ended', onEndFinish, { once: true });
      endVid.addEventListener('error', onEndFinish, { once: true });

      // Play — if autoplay is blocked, force it after a tiny interaction delay
      const playPromise = endVid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Last-resort: try again once with muted then unmute
          endVid.muted = true;
          endVid.play().then(() => {
            endVid.muted = false;
          }).catch(onEndFinish);
        });
      }
    };

    // Trigger playEndVideo when video 1 ends OR errors
    videoEl.addEventListener('ended', playEndVideo, { once: true });
    videoEl.addEventListener('error', playEndVideo, { once: true });

    // Also trigger if the AUDIO ends before the video (extra safety)
    audioEl.addEventListener('ended', () => {
      // Only force-advance if the video has already ended or there's very little left
      const remaining = (videoEl.duration || 0) - (videoEl.currentTime || 0);
      if (!videoEl.duration || remaining < 1) {
        playEndVideo();
      }
    }, { once: true });

    // Play both
    videoEl.play().catch(playEndVideo);
    audioEl.play().catch(() => {});
  }

  // ─────────────────────────────────────────────────────────
  // ── QUEST COMPLETE ───────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _completeQuest() {
    this.phase = 'completed';

    // Update Zustand state
    const store = this._getStore();
    if (store) {
      store.setH2QuestState('completed');
      eventBus.emit('SPELL_CHALLENGE_WON', {});
    }

    // Clean up audio
    this._cleanupAudio();

    // Short pause on white, then return to outdoor world
    this.time.delayedCall(1200, () => {
      this.cameras.main.fadeOut(600, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this._removeSpellInput();

        // Resume background game music
        const gameAudio = document.getElementById('bg-music-game') as HTMLAudioElement | null;
        if (gameAudio) {
          gameAudio.play().catch(() => {});
        }

        this.scene.start('OutdoorWorldScene', {
          returnX: this._getBuildingDef()?.returnX,
          returnY: this._getBuildingDef()?.returnY,
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  // ── HELPERS ──────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────
  private _clearUI() {
    if (!this.uiLayer) return;
    // Destroy all current children
    this.uiLayer.each((child: Phaser.GameObjects.GameObject) => child.destroy());
    this.uiLayer.removeAll(false);
  }

  private _removeSpellInput() {
    if (this.spellInput && document.body.contains(this.spellInput)) {
      this.spellInput.remove();
    }
    this.spellInput = undefined;
    // Also remove by id as fallback
    document.getElementById('h2-spell-input')?.remove();
  }

  private _cleanupAudio() {
    if (this.jaslineAudio) {
      this.jaslineAudio.pause();
      this.jaslineAudio.src = '';
    }
    if (this.exAudio && document.body.contains(this.exAudio)) {
      this.exAudio.pause();
      this.exAudio.src = '';
      this.exAudio.remove();
    }
    this.jaslineAudio = undefined;
    this.exAudio = undefined;
  }

  private _camSize(): { w: number; h: number } {
    // Return the actual rendered size (accounting for zoom/scale)
    const cam  = this.cameras.main;
    const zoom = cam.zoom || 1;
    return {
      w: cam.width  / zoom,
      h: cam.height / zoom,
    };
  }

  private _getStore() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useGameStore } = require('../../stores/gameStore') as typeof import('../../stores/gameStore');
      return useGameStore.getState();
    } catch { return null; }
  }

  private _getBuildingDef() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BUILDING_MAP } = require('../data/buildings') as typeof import('../data/buildings');
      return BUILDING_MAP['h2Building'];
    } catch { return null; }
  }

  private _seededRand(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  private _seededRnd2(seed: number): () => number {
    return this._seededRand(seed + 91234);
  }

  // ── Scene cleanup ────────────────────────────────────────
  shutdown() {
    this._removeSpellInput();
    this._cleanupAudio();
    this.tweens.killAll();
  }
}
