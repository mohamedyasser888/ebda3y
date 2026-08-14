// ============================================================
// CreaturesInvestigationScene — Good Path Quest 2
// Professor Maxime & Magical Creatures Investigation
//
// Quest State Machine:
//   maxim_dialogue        → Player approaches Maxime
//   maxim_talking_part1   → Pages 1–5 (image-based dialogue)
//   investigation         → Find 3 clues
//   all_clues_found       → Discovery moment shown
//   return_to_maxim       → Player must go back to Maxime
//   maxim_talking_part2   → Pages 6–11 (image-based dialogue)
//   help_phase            → Help Lucas, Roka, feed creature
//   complete              → Done
//
// IMPORTANT:
//   - Pages 1–5 play on first visit
//   - Page 6 is LOCKED until all clues found
//   - Talking to Maxime during investigation shows a hint
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }           from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { useGameStore }     from '../../stores/gameStore';

const WORLD_W = 2400;
const WORLD_H = 1200;

// ── Zones ────────────────────────────────────────────────────────────────────
const MAXIM_X      = 400;
const MAXIM_Y      = 340;
const MAXIM_RADIUS = 120;

const CREATURE_X = 560;
const CREATURE_Y = 380;

// ── Investigation area (right half) ──────────────────────────────────────────
const INV_OFFSET_X = 900;

// Clue 1: Scratch marks — bottom-left
const CLUE_SCRATCHES = { x: INV_OFFSET_X + 160, y: 920, radius: 90 };

// Clue 2: Hiding place — top-right corner behind shelf
const CLUE_HIDING = { x: INV_OFFSET_X + 1290, y: 200, radius: 90 };

// Clue 3: Metallic object — centre-top table
const CLUE_METAL = { x: INV_OFFSET_X + 600, y: 260, radius: 90 };

// Return to Maxim marker (after investigation)
const RETURN_MAXIM = { x: MAXIM_X, y: MAXIM_Y + 80, radius: 130 };

// ── Help phase NPCs ───────────────────────────────────────────────────────────
const LUCAS_X = INV_OFFSET_X + 600;
const LUCAS_Y  = 260;
const LUCAS_RADIUS = 100;

const ROKA_X = INV_OFFSET_X + 1290;
const ROKA_Y  = 200;
const ROKA_RADIUS = 100;

const FOOD_X = INV_OFFSET_X + 200;
const FOOD_Y  = 500;
const FOOD_RADIUS = 90;

const CREATURE_HELP_X = INV_OFFSET_X + 800;
const CREATURE_HELP_Y = 600;
const CREATURE_APPROACH_RADIUS = 120;

// ── Spawn ─────────────────────────────────────────────────────────────────────
const SPAWN_X = 200;
const SPAWN_Y = 600;

// ── Quest state ───────────────────────────────────────────────────────────────
type QuestPhase =
  | 'maxim_dialogue'        // player walks to Maxim
  | 'maxim_talking_part1'   // pages 1–5 in progress
  | 'investigation'         // clue hunting
  | 'all_clues_found'       // discovery moment shown
  | 'return_to_maxim'       // player must return
  | 'maxim_talking_part2'   // pages 6–11 in progress
  | 'help_phase'            // Lucas, Roka, food, creature
  | 'complete';             // done

// ── Dialogue pages ────────────────────────────────────────────────────────────
const SECTION_A_PAGES = [1, 2, 3, 4, 5];
const SECTION_B_PAGES = [6, 7, 8, 9, 10, 11];

export class CreaturesInvestigationScene extends Phaser.Scene {
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;

  private phase: QuestPhase = 'maxim_dialogue';

  // Dialogue state
  private currentPageIndex = 0;
  private currentPages: number[] = [];
  private dialoguePending = false;
  private dialogueContainer?: Phaser.GameObjects.Container;
  private enterCooldown = false; // prevents holding ENTER to skip

  // Clue tracking
  private scratchesFound  = false;
  private hidingFound     = false;
  private metalFound      = false;

  // Help phase tracking
  private noiseRemoved      = false;
  private safeAreaPrepared  = false;
  private foodCollected     = false;
  private creatureApproached = false;

  // Creature sprite
  private creatureSprite?: Phaser.GameObjects.Container;
  private creatureTween?:  Phaser.Tweens.Tween;

  // Prompt & objective
  private promptText?: Phaser.GameObjects.Text;
  private objectiveBanner?: Phaser.GameObjects.Text;
  private objectiveTween?: Phaser.Tweens.Tween;

  // Proximity state
  private nearClue: 'scratches' | 'hiding' | 'metal' | null = null;
  private nearMaxim        = false;
  private nearReturnMaxim  = false;
  private nearLucas        = false;
  private nearRoka         = false;
  private nearFood         = false;
  private nearCreature     = false;

  // NPC containers
  private maximSprite?:   Phaser.GameObjects.Image;
  private maximContainer?: Phaser.GameObjects.Container;
  private lucasContainer?:  Phaser.GameObjects.Container;
  private rokaContainer?:   Phaser.GameObjects.Container;
  private foodContainer?:   Phaser.GameObjects.Container;
  private metalContainer?:  Phaser.GameObjects.Container;

  // Clue count badge
  private clueCountText?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'CreaturesInvestigationScene' }); }

  // ──────────────────────────────────────────────────────────────────────────
  preload() {
    // Load maxime portrait
    this.load.image('maxime', '/assets/sprites/maxime.png');
    this.load.image('lucas', '/assets/sprites/lucas.png');
    this.load.image('rooka', '/assets/sprites/rooka.png');

    // Load all 11 dialogue page images
    for (let i = 1; i <= 11; i++) {
      this.load.image(`dialoguePage${i}`, `/assets/dialogue/page${i}.png`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  create() {
    this.isTransitioning  = false;
    this.dialoguePending  = false;
    this.enterCooldown    = false;
    this.nearClue         = null;
    this.nearMaxim        = false;
    this.nearReturnMaxim  = false;
    this.nearLucas        = false;
    this.nearRoka         = false;
    this.nearFood         = false;
    this.nearCreature     = false;

    // Restore clue & help state
    const st = useGameStore.getState();
    this.scratchesFound   = st.clueScratchesFound;
    this.hidingFound      = st.clueHidingPlaceFound;
    this.metalFound       = st.clueMetallicSoundFound;
    this.noiseRemoved     = st.noiseRemoved;
    this.safeAreaPrepared = st.safeAreaPrepared;
    this.foodCollected    = st.foodCollected;

    // Restore phase from store
    this._restorePhase(st);

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Draw environment
    this._drawMaximRoom();
    this._drawInvestigationRoom();

    // Colliders
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // NPCs
    this._createMaxim();
    this._createNervousCreature();
    this._createInvestigationClues();

    if (this.phase === 'help_phase') {
      this._createHelpPhaseNPCs();
    }

    // ── HUD prompts (camera-fixed) ─────────────────────────────────────────
    this.promptText = this.add.text(720, 748, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#1a0a00', strokeThickness: 5,
      padding: { x: 16, y: 8 },
      backgroundColor: '#1e0e00',
    }).setOrigin(0.5).setDepth(80).setScrollFactor(0).setVisible(false)
      .setPosition(720, 750);

    // Objective banner
    this.objectiveBanner = this.add.text(720, 60, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px', fontStyle: 'bold',
      color: '#ffd080', stroke: '#0a0000', strokeThickness: 5,
      padding: { x: 18, y: 9 },
      backgroundColor: '#130800',
    }).setOrigin(0.5).setDepth(90).setScrollFactor(0).setAlpha(0)
      .setPosition(720, 72);

    // Clue counter (bottom-left)
    this.clueCountText = this.add.text(40, 760, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '13px', fontStyle: 'italic',
      color: '#88ffcc', stroke: '#001a0a', strokeThickness: 4,
      padding: { x: 10, y: 6 },
      backgroundColor: '#041208',
    }).setOrigin(0, 1).setDepth(89).setScrollFactor(0).setAlpha(0);

    // ── Wizard ────────────────────────────────────────────────────────────
    this.wizard = new Wizard(this, SPAWN_X, SPAWN_Y);
    const spr   = this.wizard.getSprite();
    spr.setDepth(SPAWN_Y + 10);
    const body  = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh);
      body.setOffset(Math.round((spr.width - fw) / 2), spr.height - fh);
    }
    this.physics.add.collider(spr, this.staticGroup);
    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    // ── Camera ────────────────────────────────────────────────────────────
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) => cam.setZoom(Math.min(w / 1440, h / 810) * 0.9);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) => setZoom(sz.width, sz.height));
    cam.setRoundPixels(true);
    cam.fadeIn(700, 0, 10, 0);

    eventBus.emit('SCENE_READY', { scene: 'CreaturesInvestigationScene' as never });

    // Opening objective after fade
    this.time.delayedCall(900, () => this._restoreObjective());

    // Notify React UI
    this.time.delayedCall(1000, () => {
      eventBus.emit('QUEST_HUD_UPDATE', {
        quest: 'مهمة الأستاذ ماكسيم',
        objective: this._getObjectiveText(),
        clues: this._cluesFound(),
        totalClues: 3,
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  update(_t: number, delta: number) {
    if (this.isTransitioning || this.dialoguePending || !this.wizard || !this.controller) return;
    this.controller.update(delta);
    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);
    const wx = spr.x, wy = spr.y;

    this._updateCreatureBehaviour(wx, wy);

    switch (this.phase) {
      case 'maxim_dialogue':
        this._checkMaximProximity(wx, wy);
        break;
      case 'investigation':
        this._checkClueProximity(wx, wy);
        this._checkMaximDuringInvestigation(wx, wy);
        break;
      case 'all_clues_found':
      case 'return_to_maxim':
        this._checkReturnMaximProximity(wx, wy);
        break;
      case 'help_phase':
        this._checkHelpPhaseProximity(wx, wy);
        break;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE RESTORATION
  // ════════════════════════════════════════════════════════════════════════════

  private _restorePhase(st: ReturnType<typeof useGameStore.getState>) {
    if (st.goodCreaturesLessonCompleted) {
      this.phase = 'complete';
    } else if (st.maximInvestigationDialogueCompleted) {
      this.phase = 'help_phase';
    } else if (st.creatureFearDiscovered) {
      this.phase = 'return_to_maxim';
    } else if (st.investigationStarted || st.maximDialogueCompleted) {
      this.phase = 'investigation';
    }
    // else stays 'maxim_dialogue'
  }

  private _restoreObjective() {
    switch (this.phase) {
      case 'maxim_dialogue':     this._showObjective('تحدث مع الأستاذ ماكسيم'); break;
      case 'investigation':      this._showObjective('ابحث عن أدلة في الغرفة'); this._updateClueCounter(); break;
      case 'return_to_maxim':    this._showObjective('عُد إلى الأستاذ ماكسيم'); break;
      case 'help_phase':         this._showObjective('ساعد لوكاس في إبعاد مصدر الصوت'); break;
      case 'complete':           break;
    }
  }

  private _getObjectiveText(): string {
    switch (this.phase) {
      case 'maxim_dialogue':     return 'تحدث مع الأستاذ ماكسيم';
      case 'investigation':      return `ابحث عن أدلة (${this._cluesFound()}/3)`;
      case 'return_to_maxim':
      case 'all_clues_found':    return 'عُد إلى الأستاذ ماكسيم';
      case 'help_phase':         return 'ساعد في تهدئة المخلوق';
      case 'complete':           return 'اكتملت المهمة ✦';
      default:                   return '';
    }
  }

  private _cluesFound(): number {
    return [this.scratchesFound, this.hidingFound, this.metalFound].filter(Boolean).length;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ROOM DRAWING
  // ════════════════════════════════════════════════════════════════════════════

  private _drawMaximRoom() {
    const g = this.add.graphics().setDepth(0);

    // Floor
    g.fillStyle(0x2c1f0e, 1);
    g.fillRect(0, 0, INV_OFFSET_X - 50, WORLD_H);

    // Stone tile grid
    g.lineStyle(1, 0x3a2a14, 0.7);
    const TILE = 80;
    for (let x = 0; x < INV_OFFSET_X; x += TILE) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y < WORLD_H; y += TILE)       g.lineBetween(0, y, INV_OFFSET_X - 50, y);

    // Back wall
    g.fillStyle(0x1e1408, 1);
    g.fillRect(0, 0, INV_OFFSET_X - 50, 180);
    g.lineStyle(3, 0x7a5022, 0.8);
    g.lineBetween(0, 180, INV_OFFSET_X - 50, 180);

    // Arched windows
    this._drawArch(g, 200, 90, 70, 80, 0x4a2e0e);
    this._drawArch(g, 600, 90, 70, 80, 0x4a2e0e);

    // Fireplace
    g.fillStyle(0x0e0803, 1);
    g.fillRect(20, 300, 100, 140);
    g.lineStyle(3, 0x8b5a1a, 1);
    g.strokeRect(20, 300, 100, 140);
    for (let i = 0; i < 5; i++) {
      const flame = this.add.circle(
        70 + (i - 2) * 10,
        420 - Phaser.Math.Between(10, 35),
        6 + Phaser.Math.Between(0, 4),
        i % 2 === 0 ? 0xff6600 : 0xffcc00,
        0.85,
      ).setDepth(3);
      this.tweens.add({
        targets: flame,
        y: flame.y - Phaser.Math.Between(8, 20),
        scaleX: { from: 1, to: 0.4 },
        scaleY: { from: 1, to: 0.3 },
        alpha: { from: 0.85, to: 0 },
        duration: 600 + i * 120, repeat: -1, delay: i * 80,
        onRepeat: () => {
          flame.setPosition(70 + Phaser.Math.Between(-2, 2) * 10, 420 - Phaser.Math.Between(5, 15));
          flame.setScale(1, 1); flame.setAlpha(0.85);
        },
      });
    }

    // Bookshelf right side of Maxim room
    this._drawBookshelf(g, 760, 100, 60, 500);

    // Rug
    g.fillStyle(0x7a1a1a, 0.5);
    g.fillEllipse(400, 550, 500, 180);
    g.lineStyle(2, 0xcc4444, 0.6);
    g.strokeEllipse(400, 550, 500, 180);
    g.lineStyle(1, 0xff6666, 0.4);
    g.strokeEllipse(400, 550, 360, 120);

    // Ambient magical dust
    for (let i = 0; i < 12; i++) {
      const px = 80 + Math.random() * (INV_OFFSET_X - 180);
      const py = 200 + Math.random() * 700;
      const p  = this.add.circle(px, py, 2, 0xffd080, 0.5).setDepth(4);
      this.tweens.add({
        targets: p, y: py - 30 - Math.random() * 40, alpha: 0,
        duration: 2000 + Math.random() * 2000, delay: Math.random() * 3000, repeat: -1,
        onRepeat: () => { p.setPosition(px, py); p.setAlpha(0.5); },
      });
    }
  }

  private _drawInvestigationRoom() {
    const g  = this.add.graphics().setDepth(0);
    const ox = INV_OFFSET_X;

    // Floor
    g.fillStyle(0x0e1a22, 1);
    g.fillRect(ox, 0, WORLD_W - ox, WORLD_H);

    // Floor tiles
    g.lineStyle(1, 0x182a36, 0.8);
    const TILE = 80;
    for (let x = ox; x < WORLD_W; x += TILE) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y < WORLD_H; y += TILE)  g.lineBetween(ox, y, WORLD_W, y);

    // Back wall
    g.fillStyle(0x091014, 1);
    g.fillRect(ox, 0, WORLD_W - ox, 180);
    g.lineStyle(3, 0x224466, 0.8);
    g.lineBetween(ox, 180, WORLD_W, 180);

    // Stone courses
    g.lineStyle(1, 0x12202e, 0.6);
    for (let x = ox; x < WORLD_W; x += 120) g.lineBetween(x, 0, x, 180);
    for (let y = 45; y <= 180; y += 45)     g.lineBetween(ox, y, WORLD_W, y);

    // Windows
    this._drawArch(g, ox + 200,  90, 70, 80, 0x112244);
    this._drawArch(g, ox + 600,  90, 70, 80, 0x112244);
    this._drawArch(g, ox + 1000, 90, 70, 80, 0x112244);

    // ── Tables ───────────────────────────────────────────────────────────────
    const tables: [number, number, number, number, number][] = [
      [ox + 80,  400, 260, 80, 0x5a3a1a],
      [ox + 80,  700, 200, 70, 0x5a3a1a],
      [ox + 450, 350, 220, 80, 0x5a3a1a],   // metallic clue
      [ox + 750, 550, 300, 90, 0x5a3a1a],
      [ox + 1100, 400, 240, 80, 0x5a3a1a],
    ];
    for (const [tx, ty, tw, th, tc] of tables) {
      g.fillStyle(tc, 1);
      g.fillRect(tx, ty, tw, th);
      g.lineStyle(2, 0x7a5028, 1);
      g.strokeRect(tx, ty, tw, th);
      g.fillStyle(0x3a2008, 1);
      g.fillRect(tx + 8,       ty + th, 14, 30);
      g.fillRect(tx + tw - 22, ty + th, 14, 30);
    }

    // Shelves
    this._drawBookshelf(g, ox + 10,      80, 55, 600);
    this._drawBookshelf(g, WORLD_W - 65, 80, 55, 700);

    // Crates (bottom-left — near scratch clue)
    g.fillStyle(0x6a4020, 1);
    g.fillRect(ox + 90, 800, 70, 60);
    g.fillRect(ox + 90, 860, 70, 60);
    g.fillRect(ox + 170, 840, 70, 80);
    g.lineStyle(1, 0x8a5828, 1);
    g.strokeRect(ox + 90, 800, 70, 60);
    g.strokeRect(ox + 90, 860, 70, 60);
    g.strokeRect(ox + 170, 840, 70, 80);
    g.lineStyle(1, 0x8a5828, 0.5);
    g.lineBetween(ox + 90, 800, ox + 160, 860);
    g.lineBetween(ox + 160, 800, ox + 90, 860);

    // Barrels (far right)
    for (let i = 0; i < 3; i++) {
      const bx = WORLD_W - 140 + i * 45;
      const by = 600 + i * 30;
      g.fillStyle(0x7a4a18, 1);
      g.fillEllipse(bx, by, 55, 70);
      g.lineStyle(2, 0xaa6a28, 1);
      g.strokeEllipse(bx, by, 55, 70);
      g.lineStyle(2, 0x4a2a08, 0.8);
      g.lineBetween(bx - 27, by - 10, bx + 27, by - 10);
      g.lineBetween(bx - 27, by + 10, bx + 27, by + 10);
    }

    // Scattered books on tables
    const bookColors = [0xcc2222, 0x226688, 0x228833, 0xaa8822, 0x882288];
    const bookPositions = [
      [ox + 460, 360], [ox + 500, 360], [ox + 540, 360],
      [ox + 760, 560], [ox + 820, 560],
      [ox + 1110, 410], [ox + 1160, 410],
    ];
    bookPositions.forEach(([bx, by], i) => {
      g.fillStyle(bookColors[i % bookColors.length], 0.9);
      g.fillRect(bx, by, 30, 16);
      g.lineStyle(1, 0xffffff, 0.15);
      g.strokeRect(bx, by, 30, 16);
    });

    // Potted plants
    this._drawPot(g, ox + 350, 490);
    this._drawPot(g, ox + 1050, 500);
    this._drawPot(g, WORLD_W - 200, 700);

    // Footprints near scratch area (environmental storytelling)
    g.lineStyle(1, 0x334455, 0.4);
    for (let i = 0; i < 5; i++) {
      const fpx = CLUE_SCRATCHES.x - 60 + i * 20;
      const fpy = CLUE_SCRATCHES.y - 40 + (i % 2) * 18;
      g.fillStyle(0x334455, 0.35);
      g.fillEllipse(fpx, fpy, 12, 18);
    }

    // Knocked-over stool (near scratch clue — environmental detail)
    g.fillStyle(0x5a3a1a, 0.9);
    g.fillRect(CLUE_SCRATCHES.x - 100, CLUE_SCRATCHES.y + 20, 30, 12);
    g.fillRect(CLUE_SCRATCHES.x - 115, CLUE_SCRATCHES.y + 22, 40, 6);
    g.lineStyle(2, 0x5a3a1a, 0.9);
    g.lineBetween(CLUE_SCRATCHES.x - 108, CLUE_SCRATCHES.y + 32, CLUE_SCRATCHES.x - 130, CLUE_SCRATCHES.y + 55);
    g.lineBetween(CLUE_SCRATCHES.x - 88,  CLUE_SCRATCHES.y + 32, CLUE_SCRATCHES.x - 70,  CLUE_SCRATCHES.y + 55);

    // Hay pile visible near hiding spot (already suggests something was there)
    const hg2 = this.add.graphics().setDepth(2);
    hg2.fillStyle(0x6a5010, 0.5);
    hg2.fillEllipse(CLUE_HIDING.x + 40, CLUE_HIDING.y + 60, 60, 20);

    // Ambient particles
    for (let i = 0; i < 18; i++) {
      const px = ox + 60 + Math.random() * (WORLD_W - ox - 120);
      const py = 200 + Math.random() * 800;
      const colors2 = [0x44aaff, 0x88ffdd, 0xaaaaff];
      const p = this.add.circle(px, py, 2, colors2[Math.floor(Math.random() * 3)], 0.4).setDepth(4);
      this.tweens.add({
        targets: p, y: py - 25 - Math.random() * 30, alpha: 0,
        duration: 2200 + Math.random() * 2000, delay: Math.random() * 4000, repeat: -1,
        onRepeat: () => { p.setPosition(px, py); p.setAlpha(0.4); },
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NPC CREATION
  // ════════════════════════════════════════════════════════════════════════════

  private _createMaxim() {
    // Use the actual maxime.png image asset
    const portraitH = 160;
    const portraitW = portraitH * 0.65; // maintain rough aspect
    this.maximSprite = this.add.image(MAXIM_X, MAXIM_Y, 'maxime')
      .setOrigin(0.5, 1)
      .setDisplaySize(portraitW, portraitH)
      .setDepth(MAXIM_Y + 5);

    // Magical glow beneath feet
    const glow = this.add.circle(MAXIM_X, MAXIM_Y, 38, 0xffcc44, 0.08).setDepth(MAXIM_Y + 1);
    this.tweens.add({
      targets: glow, fillAlpha: { from: 0.04, to: 0.22 }, scaleX: { from: 0.9, to: 1.2 }, scaleY: { from: 0.9, to: 1.2 },
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Name tag
    const nameTag = this.add.text(MAXIM_X, MAXIM_Y - portraitH - 14, 'الأستاذ ماكسيم', {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
      color: '#ffd080', stroke: '#0a0520', strokeThickness: 3,
      padding: { x: 6, y: 3 }, backgroundColor: '#0a0a2a',
    }).setOrigin(0.5).setDepth(MAXIM_Y + 12);

    // Subtle idle float animation
    this.tweens.add({
      targets: [this.maximSprite, nameTag],
      y: '-=6',
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Orbiting sparkle (magical presence)
    for (let i = 0; i < 2; i++) {
      const angle0 = (i / 2) * Math.PI * 2;
      const spark  = this.add.circle(
        MAXIM_X + Math.cos(angle0) * 44,
        MAXIM_Y - 60 + Math.sin(angle0) * 30,
        3, 0xffd080, 0.7,
      ).setDepth(MAXIM_Y + 20);
      this.tweens.add({
        targets: spark, angle: 360,
        duration: 3000 + i * 600, repeat: -1, ease: 'Linear',
        onUpdate: (tw) => {
          const a = angle0 + tw.progress * Math.PI * 2;
          spark.setPosition(MAXIM_X + Math.cos(a) * 44, MAXIM_Y - 60 + Math.sin(a) * 30);
        },
      });
    }
  }

  private _createNervousCreature() {
    const c = this.add.container(CREATURE_X, CREATURE_Y).setDepth(CREATURE_Y + 5);
    this.creatureSprite = c;

    const g = this.add.graphics();
    // Body
    g.fillStyle(0xe8a060, 1);
    g.fillEllipse(0, 0, 50, 35);
    // Head
    g.fillStyle(0xe8a060, 1);
    g.fillCircle(20, -18, 16);
    // Ears
    g.fillStyle(0xe8a060, 1);
    g.fillTriangle(12, -30, 18, -50, 24, -30);
    g.fillTriangle(24, -30, 32, -48, 36, -28);
    g.fillStyle(0xf0a0a0, 0.7);
    g.fillTriangle(14, -30, 18, -44, 22, -30);
    // Eyes (scared wide)
    g.fillStyle(0x1a0533, 1);
    g.fillCircle(14, -18, 4);
    g.fillCircle(26, -18, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, -20, 2);
    g.fillCircle(24, -20, 2);
    // Tail (curled tight)
    g.fillStyle(0xc87030, 0.8);
    g.fillEllipse(-22, 8, 28, 16);
    // Paws
    g.fillStyle(0xd09050, 1);
    g.fillCircle(-18, 16, 7);
    g.fillCircle(18, 16, 7);
    // Mouth (frown)
    g.lineStyle(1.5, 0x8b4513, 1);
    g.beginPath();
    g.arc(20, -12, 4, 0.3, Math.PI - 0.3, false);
    g.strokePath();
    c.add(g);

    this._startNervousAnimation();
  }

  private _startNervousAnimation() {
    if (!this.creatureSprite) return;
    const c = this.creatureSprite;

    const jitter = this.tweens.add({
      targets: c,
      x: { from: CREATURE_X - 3, to: CREATURE_X + 3 },
      duration: 120, yoyo: true, repeat: -1, ease: 'Linear',
    });
    this.creatureTween = jitter;

    // Periodic look-around
    this.time.addEvent({
      delay: 2200, repeat: -1,
      callback: () => {
        if (!this.creatureSprite || this.phase === 'complete') return;
        const spr = this.creatureSprite;
        this.tweens.add({ targets: spr, scaleX: -1, duration: 200, yoyo: true, onComplete: () => spr.setScale(1, 1) });
      },
    });

    // Shy away from player
    this.time.addEvent({
      delay: 3500, repeat: -1,
      callback: () => {
        if (!this.creatureSprite || (this.phase !== 'maxim_dialogue' && this.phase !== 'investigation')) return;
        const spr = this.wizard?.getSprite();
        if (!spr) return;
        const dx   = CREATURE_X - spr.x;
        const dy   = CREATURE_Y - spr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          const awayX = CREATURE_X + (dx / dist) * 60;
          const awayY = CREATURE_Y + (dy / dist) * 40;
          this.tweens.add({
            targets: this.creatureSprite,
            x: Phaser.Math.Clamp(awayX, INV_OFFSET_X - 200, INV_OFFSET_X - 80),
            y: Phaser.Math.Clamp(awayY, 250, 700),
            duration: 400, ease: 'Power2',
          });
        }
      },
    });
  }

  private _createInvestigationClues() {
    const g = this.add.graphics().setDepth(5);

    // ── CLUE 1: Scratch marks ─────────────────────────────────────────────
    if (!this.scratchesFound) {
      g.lineStyle(2, 0x556677, 0.55);
      for (let i = 0; i < 5; i++) {
        const sx = CLUE_SCRATCHES.x - 30 + i * 12;
        const sy = CLUE_SCRATCHES.y - 20;
        g.lineBetween(sx, sy, sx + Phaser.Math.Between(-8, 8), sy + 38);
      }
      // Very faint glow
      const sg = this.add.circle(CLUE_SCRATCHES.x, CLUE_SCRATCHES.y, 28, 0x8899aa, 0.0).setDepth(4);
      this.tweens.add({
        targets: sg, fillAlpha: { from: 0.0, to: 0.18 },
        duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── CLUE 2: Hiding place ──────────────────────────────────────────────
    if (!this.hidingFound) {
      const hg = this.add.graphics().setDepth(5);
      hg.fillStyle(0x8a7030, 0.85);
      hg.fillEllipse(CLUE_HIDING.x, CLUE_HIDING.y + 20, 90, 30);
      hg.lineStyle(2, 0xc0a040, 0.7);
      for (let i = 0; i < 8; i++) {
        hg.lineBetween(
          CLUE_HIDING.x - 40 + i * 10, CLUE_HIDING.y + 10,
          CLUE_HIDING.x - 44 + i * 12, CLUE_HIDING.y + 35,
        );
      }
      const hGlow = this.add.circle(CLUE_HIDING.x, CLUE_HIDING.y + 20, 30, 0xaaaa44, 0.0).setDepth(4);
      this.tweens.add({
        targets: hGlow, fillAlpha: { from: 0.0, to: 0.15 },
        duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    // ── CLUE 3: Metallic object (bell / gong) ─────────────────────────────
    if (!this.metalFound) {
      this.metalContainer = this.add.container(CLUE_METAL.x, CLUE_METAL.y).setDepth(6);
      const mg = this.add.graphics();
      mg.fillStyle(0xaaaaaa, 1);
      mg.fillEllipse(0, -8, 28, 20);
      mg.fillStyle(0x888888, 1);
      mg.fillRect(-4, 0, 8, 14);
      mg.fillStyle(0xcccccc, 1);
      mg.fillEllipse(0, -10, 14, 10);
      mg.fillStyle(0x666666, 1);
      mg.fillRect(-2, -20, 4, 12);
      mg.lineStyle(1.5, 0xffffff, 0.6);
      mg.lineBetween(-6, -12, -2, -16);
      this.metalContainer.add(mg);

      // Shimmer
      this.tweens.add({
        targets: this.metalContainer,
        scaleX: { from: 1, to: 1.05 }, scaleY: { from: 1, to: 1.05 },
        duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });

      // Occasional metallic ping — creature reacts
      this.time.addEvent({
        delay: 5000 + Math.random() * 4000, repeat: -1,
        callback: () => {
          if (this.phase !== 'investigation' || this.metalFound) return;
          this._playPassiveMetalPing();
        },
      });
    }
  }

  private _createHelpPhaseNPCs() {
    // Lucas
    this.lucasContainer = this.add.container(LUCAS_X, LUCAS_Y).setDepth(LUCAS_Y + 5);
    const lucasImg = this.add.image(0, 0, 'lucas').setOrigin(0.5, 1).setDisplaySize(75, 130);
    this.lucasContainer.add(lucasImg);
    this.add.text(LUCAS_X, LUCAS_Y - 140, 'لوكاس', {
      fontFamily: 'Georgia, serif', fontSize: '11px', fontStyle: 'bold', color: '#ffeeaa',
      stroke: '#0a0520', strokeThickness: 3, padding: { x: 4, y: 2 }, backgroundColor: '#0a0a20',
    }).setOrigin(0.5).setDepth(LUCAS_Y + 10);

    // Roka
    this.rokaContainer = this.add.container(ROKA_X, ROKA_Y).setDepth(ROKA_Y + 5);
    const rokaImg = this.add.image(0, 0, 'rooka').setOrigin(0.5, 1).setDisplaySize(75, 130);
    this.rokaContainer.add(rokaImg);
    this.add.text(ROKA_X, ROKA_Y - 140, 'روكا', {
      fontFamily: 'Georgia, serif', fontSize: '11px', fontStyle: 'bold', color: '#ffeeaa',
      stroke: '#0a0520', strokeThickness: 3, padding: { x: 4, y: 2 }, backgroundColor: '#0a0a20',
    }).setOrigin(0.5).setDepth(ROKA_Y + 10);

    // Food bowl
    this.foodContainer = this.add.container(FOOD_X, FOOD_Y).setDepth(FOOD_Y + 5);
    const fg = this.add.graphics();
    fg.fillStyle(0x5a3a1a, 1);
    fg.fillEllipse(0, 5, 50, 16);
    fg.fillStyle(0xd4a832, 1);
    fg.fillEllipse(0, 0, 46, 14);
    fg.fillStyle(0xff9944, 0.9);
    fg.fillCircle(-8, -4, 5); fg.fillCircle(4, -5, 4); fg.fillCircle(12, -3, 5);
    this.foodContainer.add(fg);

    const foodGlow = this.add.circle(FOOD_X, FOOD_Y, 25, 0xff9944, 0.15).setDepth(FOOD_Y + 4);
    this.tweens.add({ targets: foodGlow, fillAlpha: { from: 0.08, to: 0.3 }, duration: 1200, yoyo: true, repeat: -1 });

    this.add.text(FOOD_X, FOOD_Y - 40, 'طعام المخلوق', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffcc66',
      stroke: '#1a0a00', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(FOOD_Y + 10);

    // Creature in help phase
    if (!this.creatureSprite) {
      this.creatureSprite = this.add.container(CREATURE_HELP_X, CREATURE_HELP_Y).setDepth(CREATURE_HELP_Y + 5);
      const cg = this.add.graphics();
      cg.fillStyle(0xe8a060, 1);
      cg.fillEllipse(0, 0, 50, 35);
      cg.fillCircle(20, -18, 16);
      cg.fillTriangle(12, -30, 18, -50, 24, -30);
      cg.fillTriangle(24, -30, 32, -48, 36, -28);
      cg.fillStyle(0xf0a0a0, 0.7);
      cg.fillTriangle(14, -30, 18, -44, 22, -30);
      cg.fillStyle(0x1a0533, 1);
      cg.fillCircle(14, -18, 4);
      cg.fillCircle(26, -18, 4);
      this.creatureSprite.add(cg);
    }
  }

  private _drawSimpleWizard(container: Phaser.GameObjects.Container, robeColor: number, name: string) {
    const g = this.add.graphics();
    g.fillStyle(robeColor, 1);
    g.fillTriangle(-12, 28, 12, 28, 8, -20);
    g.fillTriangle(-12, 28, -8, -20, 12, 28);
    g.fillStyle(0xc9a227, 1);
    g.fillRect(-8, 0, 16, 3);
    g.fillStyle(0xf4c58a, 1);
    g.fillCircle(0, -26, 10);
    g.fillStyle(0x0a0a1a, 1);
    g.fillTriangle(0, -52, -10, -34, 10, -34);
    g.fillRect(-13, -36, 26, 5);
    container.add(g);
    this.add.text(container.x, container.y - 70, name, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ffeeaa',
      stroke: '#0a0520', strokeThickness: 3, padding: { x: 3, y: 2 }, backgroundColor: '#0a0a20',
    }).setOrigin(0.5).setDepth(container.depth + 5);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROXIMITY CHECKS
  // ════════════════════════════════════════════════════════════════════════════

  private _checkMaximProximity(wx: number, wy: number) {
    const d      = Phaser.Math.Distance.Between(wx, wy, MAXIM_X, MAXIM_Y);
    const wasNear = this.nearMaxim;
    this.nearMaxim = d < MAXIM_RADIUS;
    if (this.nearMaxim !== wasNear) {
      this._setPrompt(this.nearMaxim ? '✦  E  —  تحدث مع ماكسيم' : '');
    }
  }

  private _checkMaximDuringInvestigation(wx: number, wy: number) {
    const d = Phaser.Math.Distance.Between(wx, wy, MAXIM_X, MAXIM_Y);
    const wasNear = this.nearMaxim;
    this.nearMaxim = d < MAXIM_RADIUS;
    if (this.nearMaxim !== wasNear) {
      this._setPrompt(this.nearMaxim ? '🔒  E  —  ماكسيم ينتظر منك الاستكشاف' : '');
    }
  }

  private _checkClueProximity(wx: number, wy: number) {
    let newClue: 'scratches' | 'hiding' | 'metal' | null = null;

    if (!this.scratchesFound && Phaser.Math.Distance.Between(wx, wy, CLUE_SCRATCHES.x, CLUE_SCRATCHES.y) < CLUE_SCRATCHES.radius) {
      newClue = 'scratches';
    } else if (!this.hidingFound && Phaser.Math.Distance.Between(wx, wy, CLUE_HIDING.x, CLUE_HIDING.y) < CLUE_HIDING.radius) {
      newClue = 'hiding';
    } else if (!this.metalFound && Phaser.Math.Distance.Between(wx, wy, CLUE_METAL.x, CLUE_METAL.y) < CLUE_METAL.radius) {
      newClue = 'metal';
    }

    if (newClue !== this.nearClue) {
      this.nearClue = newClue;
      this._setPrompt(newClue ? '🔍  E  —  افحص' : '');
    }
  }

  private _checkReturnMaximProximity(wx: number, wy: number) {
    const d       = Phaser.Math.Distance.Between(wx, wy, RETURN_MAXIM.x, RETURN_MAXIM.y);
    const wasNear  = this.nearReturnMaxim;
    this.nearReturnMaxim = d < RETURN_MAXIM.radius;
    if (this.nearReturnMaxim !== wasNear) {
      this._setPrompt(this.nearReturnMaxim ? '✦  E  —  تحدث مع ماكسيم' : '');
    }
  }

  private _checkHelpPhaseProximity(wx: number, wy: number) {
    const st = useGameStore.getState();

    if (!st.noiseRemoved) {
      const wasNear = this.nearLucas;
      this.nearLucas = Phaser.Math.Distance.Between(wx, wy, LUCAS_X, LUCAS_Y) < LUCAS_RADIUS;
      if (this.nearLucas !== wasNear) this._setPrompt(this.nearLucas ? 'E  —  ساعد لوكاس' : '');
      if (this.nearLucas) return;
    }
    if (st.noiseRemoved && !st.safeAreaPrepared) {
      const wasNear = this.nearRoka;
      this.nearRoka = Phaser.Math.Distance.Between(wx, wy, ROKA_X, ROKA_Y) < ROKA_RADIUS;
      if (this.nearRoka !== wasNear) this._setPrompt(this.nearRoka ? 'E  —  ساعد روكا' : '');
      if (this.nearRoka) return;
    }
    if (st.safeAreaPrepared && !st.foodCollected) {
      const wasNear = this.nearFood;
      this.nearFood = Phaser.Math.Distance.Between(wx, wy, FOOD_X, FOOD_Y) < FOOD_RADIUS;
      if (this.nearFood !== wasNear) this._setPrompt(this.nearFood ? 'E  —  خذ الطعام' : '');
      if (this.nearFood) return;
    }
    if (st.foodCollected) {
      const wasNear = this.nearCreature;
      const cx      = this.creatureSprite?.x ?? CREATURE_HELP_X;
      const cy      = this.creatureSprite?.y ?? CREATURE_HELP_Y;
      this.nearCreature = Phaser.Math.Distance.Between(wx, wy, cx, cy) < CREATURE_APPROACH_RADIUS;
      if (this.nearCreature !== wasNear) {
        const st2   = useGameStore.getState();
        const prompt = st2.creatureFed ? '' : (this.creatureApproached ? 'E  —  قدم الطعام' : 'E  —  اقترب ببطء');
        this._setPrompt(this.nearCreature ? prompt : '');
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INTERACTION HANDLER
  // ════════════════════════════════════════════════════════════════════════════

  private _handleInteract() {
    if (this.dialoguePending || this.isTransitioning || this.enterCooldown) return;

    switch (this.phase) {
      case 'maxim_dialogue':
        if (this.nearMaxim) this._startSection_A();
        break;

      case 'investigation':
        if (this.nearMaxim) {
          // ── LOCKED: Player tried to talk to Maxim during investigation ──
          this._showLockedMaximHint();
        } else if (this.nearClue === 'scratches') {
          this._inspectScratches();
        } else if (this.nearClue === 'hiding') {
          this._inspectHiding();
        } else if (this.nearClue === 'metal') {
          this._inspectMetal();
        }
        break;

      case 'all_clues_found':
      case 'return_to_maxim':
        if (this.nearReturnMaxim) this._startSection_B();
        break;

      case 'help_phase':
        this._handleHelpInteract();
        break;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION A — PAGES 1–5 (image-based dialogue)
  // ════════════════════════════════════════════════════════════════════════════

  private _startSection_A() {
    this.phase            = 'maxim_talking_part1';
    this.currentPages     = SECTION_A_PAGES;
    this.currentPageIndex = 0;
    this.controller.setBlocked(true);
    this._setPrompt('');
    useGameStore.getState().setGoodCreaturesLessonStarted();
    this.cameras.main.stopFollow();

    // Smooth camera pan to Maxim
    this.cameras.main.pan(MAXIM_X, MAXIM_Y - 50, 800, 'Power2', false, (_cam, prog) => {
      if (prog === 1) this._showDialoguePage();
    });
  }

  private _startSection_B() {
    this.phase            = 'maxim_talking_part2';
    this.currentPages     = SECTION_B_PAGES;
    this.currentPageIndex = 0;
    this.controller.setBlocked(true);
    this._setPrompt('');
    useGameStore.getState().setMaximPages6To11Started();
    this.cameras.main.stopFollow();

    this.cameras.main.pan(MAXIM_X, MAXIM_Y - 50, 600, 'Power2', false, (_cam, prog) => {
      if (prog === 1) this._showDialoguePage();
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // IMAGE DIALOGUE DISPLAY
  // ════════════════════════════════════════════════════════════════════════════

  private _showDialoguePage() {
    if (this.currentPageIndex >= this.currentPages.length) {
      this._onDialogueSectionComplete();
      return;
    }

    this.dialoguePending = true;

    // Destroy previous page
    this.dialogueContainer?.destroy();
    this.dialogueContainer = undefined;

    const pageNum    = this.currentPages[this.currentPageIndex];
    const textureKey = `dialoguePage${pageNum}`;
    const camW       = this.scale.width;
    const camH       = this.scale.height;
    const cx         = camW / 2;
    const cy         = camH / 2;

    // Dark overlay behind page
    const overlay = this.add.rectangle(cx, cy, camW, camH, 0x000000, 0.88)
      .setDepth(2000).setScrollFactor(0);

    // Page image (full-screen, preserves aspect ratio)
    const pageImg = this.add.image(cx, cy, textureKey)
      .setScrollFactor(0).setDepth(2001).setAlpha(0)
      .setOrigin(0.5);

    // Fit image to screen while preserving aspect ratio
    const imgW = this.textures.get(textureKey).getSourceImage().width;
    const imgH = this.textures.get(textureKey).getSourceImage().height;
    const scaleX = (camW * 0.92) / imgW;
    const scaleY = (camH * 0.92) / imgH;
    pageImg.setScale(Math.min(scaleX, scaleY));

    // Decorative frame border
    const border = this.add.rectangle(cx, cy, camW * 0.94 + 6, camH * 0.94 + 6, 0x000000, 0)
      .setScrollFactor(0).setDepth(2000).setStrokeStyle(3, 0xc9a227, 0.8);

    // Page indicator
    const total       = this.currentPages.length;
    const pageDisplay = `${this.currentPageIndex + 1} / ${total}`;
    const pageLabel   = this.add.text(cx, camH * 0.96, pageDisplay, {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#c9a227', stroke: '#000000', strokeThickness: 3,
      padding: { x: 8, y: 4 }, backgroundColor: '#0a0520',
    }).setOrigin(0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);

    // Advance hint
    const hint = this.add.text(cx + camW * 0.42, camH * 0.95, 'اضغط Enter للتقليب ↵', {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#ffdd88', stroke: '#221100', strokeThickness: 4,
      padding: { x: 10, y: 5 }, backgroundColor: 'rgba(0,0,0,0.5)'
    }).setOrigin(1, 0.5).setDepth(2002).setScrollFactor(0).setAlpha(0);

    this.dialogueContainer = this.add.container(0, 0, [overlay, pageImg, border, pageLabel, hint]).setDepth(2000);

    // Fade in
    this.tweens.add({
      targets: [pageImg, pageLabel, hint], alpha: 1,
      duration: 350, ease: 'Power2',
      onComplete: () => {
        // Pulse hint
        this.tweens.add({
          targets: hint,
          alpha: 0.6,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });

        // Arm enter key — with 200ms cooldown guard
        this.enterCooldown = true;
        this.time.delayedCall(220, () => {
          this.enterCooldown = false;
          const advanceFn = () => {
            if (this.enterCooldown) return;
            this.enterCooldown = true;
            this.input.keyboard?.off('keydown-ENTER', advanceFn);
            this.input.keyboard?.off('keydown-E', advanceFn);
            this._advanceDialoguePage();
          };
          this.input.keyboard?.on('keydown-ENTER', advanceFn);
          this.input.keyboard?.on('keydown-E',     advanceFn);
        });
      },
    });
  }

  private _advanceDialoguePage() {
    // Fade out current page then show next
    if (!this.dialogueContainer) {
      this._showDialoguePage();
      return;
    }
    this.tweens.add({
      targets: this.dialogueContainer,
      alpha: 0, duration: 200, ease: 'Power2',
      onComplete: () => {
        this.dialogueContainer?.destroy();
        this.dialogueContainer = undefined;
        this.currentPageIndex++;
        this.time.delayedCall(80, () => {
          this.enterCooldown = false;
          this._showDialoguePage();
        });
      },
    });
  }

  private _onDialogueSectionComplete() {
    this.dialoguePending = false;
    this.dialogueContainer?.destroy();
    this.dialogueContainer = undefined;
    this.enterCooldown = false;

    if (this.phase === 'maxim_talking_part1') {
      // ── Section A complete (Pages 1–5) ─────────────────────────────────
      useGameStore.getState().setMaximDialogueCompleted();
      useGameStore.getState().setInvestigationStarted();

      this.phase = 'investigation';
      this.controller.setBlocked(false);

      // Resume camera follow
      this.cameras.main.startFollow(this.wizard.getSprite(), true, 0.1, 0.1);

      this._showObjective('استكشف الغرفة وابحث عن أدلة');
      this._updateClueCounter();

      // Emit to React UI
      eventBus.emit('QUEST_HUD_UPDATE', {
        quest: 'مهمة الأستاذ ماكسيم',
        objective: 'ابحث عن أدلة (0/3)',
        clues: 0, totalClues: 3,
      });

      // Pan camera toward investigation room to draw attention
      this.time.delayedCall(600, () => {
        this.cameras.main.stopFollow();
        this.cameras.main.pan(INV_OFFSET_X + 600, 600, 1800, 'Power2', false, (_cam, prog) => {
          if (prog === 1) {
            this.cameras.main.startFollow(this.wizard.getSprite(), true, 0.1, 0.1);
          }
        });
      });

    } else if (this.phase === 'maxim_talking_part2') {
      // ── Section B complete (Pages 6–11) — Quest Complete ───────────────
      useGameStore.getState().setGoodCreaturesLessonCompleted();
      useGameStore.getState().setMaximInvestigationDialogueCompleted();

      this.phase = 'help_phase';
      this.controller.setBlocked(false);
      this.cameras.main.startFollow(this.wizard.getSprite(), true, 0.1, 0.1);

      this._showObjective('ساعد لوكاس في إبعاد مصدر الصوت');
      this._createHelpPhaseNPCs();
      this.metalContainer?.destroy();
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INVESTIGATION: LOCKED MAXIM HINT
  // ════════════════════════════════════════════════════════════════════════════

  private _showLockedMaximHint() {
    if (this.dialoguePending) return;
    this.dialoguePending = true;
    this.controller.setBlocked(true);
    this._setPrompt('');

    const camW = this.scale.width;
    const camH = this.scale.height;
    const cx   = camW / 2;
    const cy   = camH * 0.78;

    const bg = this.add.rectangle(cx, cy, 560, 80, 0x0a0a20, 0.95)
      .setDepth(110).setScrollFactor(0).setStrokeStyle(2, 0x4466aa, 0.8);

    const found   = this._cluesFound();
    const remain  = 3 - found;
    const msgText = remain > 0
      ? `الأستاذ ماكسيم: "أكمل تحقيقك أولاً... (${found}/3 أدلة)"`
      : '';

    const msg = this.add.text(cx, cy, msgText, {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: '#aaccff', stroke: '#000000', strokeThickness: 3,
      wordWrap: { width: 520 }, align: 'center',
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setAlpha(0);

    this.tweens.add({ targets: [bg, msg], alpha: 1, duration: 300 });

    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: [bg, msg], alpha: 0, duration: 300,
        onComplete: () => {
          bg.destroy(); msg.destroy();
          this.dialoguePending = false;
          this.controller.setBlocked(false);
        },
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLUE INSPECTION
  // ════════════════════════════════════════════════════════════════════════════

  private _inspectScratches() {
    if (this.dialoguePending) return;
    this.scratchesFound = true;
    useGameStore.getState().setClueScratchesFound();

    this._showMagnifyingGlass(CLUE_SCRATCHES.x, CLUE_SCRATCHES.y);
    this._playDiscoverySound(320);
    this._showClueInspection(
      'خدوش على الأرض...',
      'تبدو أنها من مخلوق يحاول الهرب بسرعة. شيء ما أخافه.',
      () => {
        this._showClueFoundNotification('آثار الهروب', '✦ دليل 1 من 3 ✦');
        this.nearClue = null;
        this._checkAllClues();
      },
    );
  }

  private _inspectHiding() {
    if (this.dialoguePending) return;
    this.hidingFound = true;
    useGameStore.getState().setClueHidingPlaceFound();

    this._showMagnifyingGlass(CLUE_HIDING.x, CLUE_HIDING.y);
    this._playDiscoverySound(360);
    this._showClueInspection(
      'مكان اختباء...',
      'عش صغير من القش. يبدو أن المخلوق يختبئ هنا عندما يخاف.',
      () => {
        this._showClueFoundNotification('مكان الاختباء', '✦ دليل 2 من 3 ✦');
        this.nearClue = null;
        this._checkAllClues();
      },
    );
  }

  private _inspectMetal() {
    if (this.dialoguePending) return;
    this.metalFound = true;
    useGameStore.getState().setClueMetallicSoundFound();

    this._showMagnifyingGlass(CLUE_METAL.x, CLUE_METAL.y);
    this._playMetalClangEffect();
    this._creatureReactToSound();

    this._showClueInspection(
      'جسم معدني...',
      'جرس صغير على الطاولة. عند لمسه، أحدث صوتاً عالياً — فجأة انطلق المخلوق نحو مكان اختبائه!',
      () => {
        this._showClueFoundNotification('الجسم المعدني', '✦ دليل 3 من 3 ✦');
        this.nearClue = null;
        this._checkAllClues();
      },
    );
  }

  private _showClueInspection(title: string, body: string, onComplete: () => void) {
    this.dialoguePending = true;
    this.controller.setBlocked(true);
    this._setPrompt('');

    const camW = this.scale.width;
    const camH = this.scale.height;
    const cx   = camW / 2;
    const cy   = camH * 0.78;

    const bg = this.add.rectangle(cx, cy, 680, 100, 0x091a0e, 0.96)
      .setDepth(110).setScrollFactor(0).setStrokeStyle(2, 0x44aa88, 0.9);

    const titleTxt = this.add.text(cx, cy - 24, `🔍  ${title}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: '#88ffcc', stroke: '#001a0a', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setAlpha(0);

    const bodyTxt = this.add.text(cx, cy + 10, body, {
      fontFamily: 'Georgia, serif', fontSize: '13px',
      color: '#d0eed8', stroke: '#001a0a', strokeThickness: 3,
      wordWrap: { width: 640 }, align: 'center',
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setAlpha(0);

    const hint = this.add.text(cx, cy + 38, 'اضغط E للمتابعة', {
      fontFamily: 'monospace', fontSize: '11px', color: '#558877',
    }).setOrigin(0.5).setDepth(111).setScrollFactor(0).setAlpha(0);

    this.tweens.add({ targets: [bg, titleTxt, bodyTxt, hint], alpha: 1, duration: 350 });

    // Advance on E with 200ms guard
    this.enterCooldown = true;
    this.time.delayedCall(250, () => {
      this.enterCooldown = false;
      const advFn = () => {
        if (this.enterCooldown) return;
        this.enterCooldown = true;
        this.input.keyboard?.off('keydown-E', advFn);
        this.tweens.add({
          targets: [bg, titleTxt, bodyTxt, hint], alpha: 0, duration: 250,
          onComplete: () => {
            bg.destroy(); titleTxt.destroy(); bodyTxt.destroy(); hint.destroy();
            this.dialoguePending = false;
            this.controller.setBlocked(false);
            this.enterCooldown = false;
            onComplete();
          },
        });
      };
      this.input.keyboard?.on('keydown-E', advFn);
    });
  }

  private _checkAllClues() {
    if (this.scratchesFound && this.hidingFound && this.metalFound) {
      useGameStore.getState().setCreatureFearDiscovered();
      this.time.delayedCall(1500, () => this._showFinalDiscovery());
    } else {
      const found    = this._cluesFound();
      const remaining = 3 - found;
      this._showObjective(`ابحث عن المزيد من الأدلة (${remaining} متبقٍ)`);
      this._updateClueCounter();
      eventBus.emit('QUEST_HUD_UPDATE', {
        quest: 'مهمة الأستاذ ماكسيم',
        objective: `ابحث عن أدلة (${found}/3)`,
        clues: found, totalClues: 3,
      });
    }
  }

  private _showFinalDiscovery() {
    this.phase = 'all_clues_found';
    this.controller.setBlocked(true);

    const camW = this.scale.width;
    const camH = this.scale.height;
    const cx   = camW / 2;
    const cy   = camH / 2;

    // Dark overlay
    const overlay = this.add.rectangle(cx, cy, camW, camH, 0x000000, 0)
      .setDepth(95).setScrollFactor(0);
    this.tweens.add({ targets: overlay, fillAlpha: 0.75, duration: 1000 });

    const l1 = this.add.text(cx, cy - 90, '✦  اكتشفت شيئاً مهماً...  ✦', {
      fontFamily: 'Georgia, serif', fontSize: '24px', fontStyle: 'bold',
      color: '#ffe080', stroke: '#1a0a00', strokeThickness: 6,
      padding: { x: 22, y: 12 }, backgroundColor: '#1a0d00',
    }).setOrigin(0.5).setDepth(99).setScrollFactor(0).setAlpha(0);

    const l2 = this.add.text(cx, cy - 10, 'المخلوق لا يخاف من الناس...', {
      fontFamily: 'Georgia, serif', fontSize: '18px',
      color: '#f0e8d0', stroke: '#0a0000', strokeThickness: 5,
      padding: { x: 14, y: 8 }, backgroundColor: '#140800',
    }).setOrigin(0.5).setDepth(99).setScrollFactor(0).setAlpha(0);

    const l3 = this.add.text(cx, cy + 55, 'بل يخاف من الصوت المعدني المرتفع.', {
      fontFamily: 'Georgia, serif', fontSize: '18px',
      color: '#f0e8d0', stroke: '#0a0000', strokeThickness: 5,
      padding: { x: 14, y: 8 }, backgroundColor: '#140800',
    }).setOrigin(0.5).setDepth(99).setScrollFactor(0).setAlpha(0);

    // Golden sparkles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const spark = this.add.circle(
        cx + Math.cos(angle) * 180, cy + Math.sin(angle) * 110,
        3, 0xffd700, 0.9,
      ).setDepth(97).setScrollFactor(0);
      this.tweens.add({
        targets: spark, alpha: 0,
        x: cx + Math.cos(angle) * 280, y: cy + Math.sin(angle) * 170,
        duration: 1400, delay: 600 + i * 60, ease: 'Power2',
      });
    }

    this.tweens.add({ targets: l1, alpha: 1, y: cy - 100, duration: 700, delay: 400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: l2, alpha: 1, duration: 600, delay: 1200 });
    this.tweens.add({ targets: l3, alpha: 1, duration: 600, delay: 1900, onComplete: () => {
      this.time.delayedCall(1800, () => {
        this.tweens.add({ targets: [overlay, l1, l2, l3], alpha: 0, duration: 600, onComplete: () => {
          overlay.destroy(); l1.destroy(); l2.destroy(); l3.destroy();
          this.phase = 'return_to_maxim';
          this.controller.setBlocked(false);
          this._showObjective('عُد إلى الأستاذ ماكسيم وأخبره بما اكتشفته');
          this._updateClueCounter();
          eventBus.emit('QUEST_HUD_UPDATE', {
            quest: 'مهمة الأستاذ ماكسيم',
            objective: 'عُد إلى الأستاذ ماكسيم',
            clues: 3, totalClues: 3,
          });
        }});
      });
    }});
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HELP PHASE
  // ════════════════════════════════════════════════════════════════════════════

  private _handleHelpInteract() {
    const st = useGameStore.getState();

    if (!st.noiseRemoved && this.nearLucas) {
      this._lucasRemovesNoise();
    } else if (st.noiseRemoved && !st.safeAreaPrepared && this.nearRoka) {
      this._rokaPreparesSafeArea();
    } else if (st.safeAreaPrepared && !st.foodCollected && this.nearFood) {
      this._collectFood();
    } else if (st.foodCollected && this.nearCreature) {
      if (!this.creatureApproached) this._approachCreature();
      else if (!st.creatureFed)    this._feedCreature();
    }
  }

  private _lucasRemovesNoise() {
    this.controller.setBlocked(true);
    this._setPrompt('');

    const camW = this.scale.width;
    const lucsText = this.add.text(camW / 2, this.scale.height * 0.82,
      '"حسنًا! سأزيله الآن."',
      {
        fontFamily: 'Georgia, serif', fontSize: '15px',
        color: '#88ccff', stroke: '#0a0000', strokeThickness: 4,
        padding: { x: 10, y: 6 }, backgroundColor: '#0a0a20',
      }
    ).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    this.time.delayedCall(1400, () => {
      lucsText.destroy();
      if (this.lucasContainer) {
        this.tweens.add({
          targets: this.lucasContainer, x: CLUE_METAL.x, y: CLUE_METAL.y + 30,
          duration: 800, ease: 'Power2', onComplete: () => {
            this.metalContainer?.destroy();
          },
        });
      }
      this.time.delayedCall(2200, () => {
        useGameStore.getState().setNoiseRemoved();
        this.noiseRemoved = true;
        this.controller.setBlocked(false);
        this._showObjective('ساعد روكا في تجهيز مكان آمن');
        this._showBannerFeedback('✓ تم إزالة مصدر الصوت!', 0x44aaff);
      });
    });
  }

  private _rokaPreparesSafeArea() {
    this.controller.setBlocked(true);
    this._setPrompt('');

    const rokaText = this.add.text(this.scale.width / 2, this.scale.height * 0.82,
      '"سأجهّز له مكانًا هادئًا."',
      {
        fontFamily: 'Georgia, serif', fontSize: '15px',
        color: '#ffaacc', stroke: '#0a0000', strokeThickness: 4,
        padding: { x: 10, y: 6 }, backgroundColor: '#1a001a',
      }
    ).setOrigin(0.5).setDepth(100).setScrollFactor(0);

    this.time.delayedCall(800, () => {
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const sp = this.add.circle(
          CLUE_HIDING.x + Math.cos(angle) * 40, CLUE_HIDING.y + Math.sin(angle) * 30,
          3, 0xff88cc, 0.9,
        ).setDepth(10);
        this.tweens.add({ targets: sp, alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 800, delay: i * 40, ease: 'Power2', onComplete: () => sp.destroy() });
      }
    });

    this.time.delayedCall(2000, () => {
      rokaText.destroy();
      useGameStore.getState().setSafeAreaPrepared();
      this.safeAreaPrepared = true;
      this.controller.setBlocked(false);
      this._showObjective('أحضر الطعام للمخلوق');
      this._showBannerFeedback('✓ المكان الآمن جاهز!', 0xffaacc);
    });
  }

  private _collectFood() {
    this._setPrompt('');
    this.foodContainer?.destroy();
    useGameStore.getState().setFoodCollected();
    this.foodCollected = true;
    this._showObjective('اقترب من المخلوق ببطء');
    this._showBannerFeedback('✓ حملت الطعام!', 0xff9944);

    if (this.creatureSprite) {
      this.tweens.add({ targets: this.creatureSprite, x: CREATURE_HELP_X, y: CREATURE_HELP_Y, duration: 1200, ease: 'Power2' });
    }
  }

  private _approachCreature() {
    this.creatureApproached = true;
    this._setPrompt('');
    this.creatureTween?.stop();
    if (this.creatureSprite) {
      this.tweens.add({ targets: this.creatureSprite, scaleX: 1.08, scaleY: 1.08, duration: 500, yoyo: true, repeat: 1 });
    }
    this._showObjective('قدم الطعام للمخلوق');
    this._showBannerFeedback('المخلوق فضولي...', 0xffcc88);
  }

  private _feedCreature() {
    this.controller.setBlocked(true);
    this._setPrompt('');

    if (this.creatureSprite) {
      this.tweens.add({ targets: this.creatureSprite, y: (this.creatureSprite.y ?? CREATURE_HELP_Y) - 10, duration: 200, yoyo: true, repeat: 5 });
    }

    useGameStore.getState().setCreatureFed();
    this.time.delayedCall(1400, () => {
      this.controller.setBlocked(false);
      this._questFinalComplete();
    });
  }

  private _questFinalComplete() {
    useGameStore.getState().setGoodCreaturesLessonCompleted();
    this.phase = 'complete';
    this.controller.setBlocked(true);

    const camW = this.scale.width;
    const camH = this.scale.height;
    const cx   = camW / 2;
    const cy   = camH / 2;

    // Golden burst particles
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const dist  = 80 + Math.random() * 120;
      const spark = this.add.circle(
        cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.6,
        4 + Math.random() * 4, 0xffd700, 1,
      ).setDepth(98).setScrollFactor(0);
      this.tweens.add({ targets: spark, alpha: 0, scaleX: 0.1, scaleY: 0.1, duration: 1200 + Math.random() * 600, delay: Math.random() * 400, ease: 'Power2', onComplete: () => spark.destroy() });
    }

    if (this.creatureSprite) {
      this.tweens.add({ targets: this.creatureSprite, y: (this.creatureSprite.y ?? CREATURE_HELP_Y) - 30, duration: 300, yoyo: true, repeat: 4, ease: 'Bounce.easeOut' });
    }

    const ct = this.add.text(cx, cy - 70, '✦  تم إكمال المهمة!  ✦', {
      fontFamily: 'Georgia, serif', fontSize: '28px', fontStyle: 'bold',
      color: '#ffd700', stroke: '#1a0a00', strokeThickness: 7,
      padding: { x: 22, y: 12 }, backgroundColor: '#1a0d00',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: ct, alpha: 1, y: cy - 80, duration: 700, ease: 'Back.easeOut' });

    const sub = this.add.text(cx, cy, 'مهمة الأستاذ ماكسيم والمخلوقات السحرية', {
      fontFamily: 'Georgia, serif', fontSize: '16px',
      color: '#f0e8a0', stroke: '#1a0a00', strokeThickness: 4,
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 600 });

    eventBus.emit('QUEST_CREATURES_COMPLETE', { quest: 'goodCreaturesLesson' });

    this.time.delayedCall(4500, () => {
      this.isTransitioning = true;
      this.cameras.main.fadeOut(800, 20, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CreaturesClassScene', { spawnX: SPAWN_X, spawnY: 860 });
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VISUAL FEEDBACK HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private _showMagnifyingGlass(wx: number, wy: number) {
    const circle = this.add.circle(wx, wy, 40, 0xffffff, 0).setDepth(20);
    circle.setStrokeStyle(4, 0xffffff, 0.8);
    const handle = this.add.rectangle(wx + 30, wy + 30, 5, 22, 0xffffff, 0.7).setDepth(20).setRotation(Math.PI / 4);
    const mg = this.add.container(wx, wy, [circle, handle]).setDepth(20);
    this.tweens.add({
      targets: mg, scaleX: { from: 0.3, to: 1 }, scaleY: { from: 0.3, to: 1 }, alpha: { from: 0, to: 1 },
      duration: 300, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(700, () => {
          this.tweens.add({ targets: mg, alpha: 0, duration: 300, onComplete: () => mg.destroy() });
        });
      },
    });
  }

  private _showClueFoundNotification(clueName: string, badge: string) {
    // Emit to React layer for polished notification
    eventBus.emit('CLUE_FOUND', { name: clueName, badge, total: this._cluesFound() });

    // Also show in-Phaser banner
    const camW = this.scale.width;
    const banner = this.add.text(camW / 2, 180, `${badge}\n${clueName}`, {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold',
      color: '#88ffcc', stroke: '#001a0a', strokeThickness: 5,
      padding: { x: 18, y: 10 }, backgroundColor: '#041208', align: 'center',
    }).setOrigin(0.5).setDepth(95).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, y: 170, duration: 500, ease: 'Back.easeOut' });
    this.time.delayedCall(2500, () => {
      this.tweens.add({ targets: banner, alpha: 0, duration: 400, onComplete: () => banner.destroy() });
    });

    // Sparkle ring at clue position
    const cluePos = this.nearClue === 'scratches' ? CLUE_SCRATCHES :
                    this.nearClue === 'hiding'    ? CLUE_HIDING    : CLUE_METAL;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const sp = this.add.circle(
        cluePos.x + Math.cos(angle) * 35,
        cluePos.y + Math.sin(angle) * 25,
        3, 0x88ffcc, 0.9,
      ).setDepth(15);
      this.tweens.add({ targets: sp, alpha: 0, scaleX: 0.2, scaleY: 0.2, x: cluePos.x + Math.cos(angle) * 60, y: cluePos.y + Math.sin(angle) * 45, duration: 700, delay: i * 40, ease: 'Power2', onComplete: () => sp.destroy() });
    }
  }

  private _showBannerFeedback(text: string, color: number) {
    const hex    = '#' + color.toString(16).padStart(6, '0');
    const camW   = this.scale.width;
    const camH   = this.scale.height;
    const banner = this.add.text(camW / 2, camH * 0.82, text, {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: hex, stroke: '#000000', strokeThickness: 4,
      padding: { x: 12, y: 6 }, backgroundColor: '#0a0a18',
    }).setOrigin(0.5).setDepth(92).setScrollFactor(0).setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, duration: 400 });
    this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: banner, alpha: 0, duration: 400, onComplete: () => banner.destroy() });
    });
  }

  private _updateClueCounter() {
    if (!this.clueCountText) return;
    const found = this._cluesFound();
    if (this.phase === 'investigation') {
      const stars = '★'.repeat(found) + '☆'.repeat(3 - found);
      this.clueCountText.setText(`أدلة: ${stars}  (${found}/3)`).setAlpha(0);
      this.tweens.add({ targets: this.clueCountText, alpha: 1, duration: 400 });
      if (found === 3) {
        this.time.delayedCall(3000, () => {
          this.tweens.add({ targets: this.clueCountText!, alpha: 0, duration: 600 });
        });
      }
    } else {
      this.tweens.add({ targets: this.clueCountText, alpha: 0, duration: 300 });
    }
  }

  private _showObjective(text: string) {
    if (!this.objectiveBanner) return;
    this.objectiveTween?.stop();
    this.objectiveBanner.setText(`◆  ${text}`).setAlpha(0);
    const tw = this.tweens.add({ targets: this.objectiveBanner, alpha: 1, duration: 500 });
    this.objectiveTween = tw;
    this.time.delayedCall(5000, () => {
      this.tweens.add({ targets: this.objectiveBanner!, alpha: 0, duration: 500 });
    });

    // Update the persistent React HUD
    eventBus.emit('QUEST_HUD_UPDATE', {
      quest: 'مهمة الأستاذ ماكسيم',
      objective: text
    });
  }

  private _setPrompt(text: string) {
    if (!this.promptText) return;
    if (!text) { this.promptText.setVisible(false); return; }
    this.promptText.setText(text).setVisible(true);
  }

  private _playMetalClangEffect() {
    for (let i = 0; i < 4; i++) {
      const ring = this.add.circle(CLUE_METAL.x, CLUE_METAL.y, 20, 0xcccccc, 0).setDepth(15);
      ring.setStrokeStyle(2, 0xffffff, 0.8);
      this.tweens.add({
        targets: ring,
        scaleX: { from: 0.5, to: 3 }, scaleY: { from: 0.5, to: 3 },
        alpha: { from: 0.7, to: 0 },
        duration: 900, delay: i * 180, ease: 'Power2',
        onComplete: () => ring.destroy(),
      });
    }
    // Screen flash
    const camW  = this.scale.width;
    const camH  = this.scale.height;
    const flash = this.add.rectangle(camW / 2, camH / 2, camW, camH, 0xffffff, 0).setDepth(98).setScrollFactor(0);
    this.tweens.add({ targets: flash, fillAlpha: { from: 0.25, to: 0 }, duration: 200, ease: 'Power2', onComplete: () => flash.destroy() });

    this._playDiscoverySound(440);
  }

  private _playPassiveMetalPing() {
    // Creature reacts to occasional metallic ping even before player inspects
    for (let i = 0; i < 2; i++) {
      const ring = this.add.circle(CLUE_METAL.x, CLUE_METAL.y, 15, 0xdddddd, 0).setDepth(12);
      ring.setStrokeStyle(1.5, 0xeeeeee, 0.5);
      this.tweens.add({
        targets: ring, scaleX: { from: 0.5, to: 2.5 }, scaleY: { from: 0.5, to: 2.5 }, alpha: { from: 0.5, to: 0 },
        duration: 700, delay: i * 160, ease: 'Power2', onComplete: () => ring.destroy(),
      });
    }
    // Creature nervously looks toward sound
    if (this.creatureSprite) {
      this.tweens.add({ targets: this.creatureSprite, scaleX: -1, duration: 150, yoyo: true });
      this.time.delayedCall(200, () => {
        if (!this.creatureSprite) return;
        const cx = this.creatureSprite.x;
        const cy = this.creatureSprite.y;
        this.tweens.add({ targets: this.creatureSprite, x: cx - 15, y: cy - 8, duration: 200, yoyo: true, ease: 'Power2' });
      });
    }
  }

  private _creatureReactToSound() {
    if (!this.creatureSprite) return;
    const c = this.creatureSprite;
    this.tweens.add({
      targets: c,
      x: { from: c.x - 10, to: c.x + 10 },
      duration: 60, yoyo: true, repeat: 8, ease: 'Linear',
      onComplete: () => {
        this.tweens.add({
          targets: c, x: CLUE_HIDING.x, y: CLUE_HIDING.y,
          duration: 800, ease: 'Power3',
          onComplete: () => {
            this.tweens.add({ targets: c, x: { from: CLUE_HIDING.x - 5, to: CLUE_HIDING.x + 5 }, duration: 80, yoyo: true, repeat: 5 });
            this.time.delayedCall(700, () => {
              this.tweens.add({ targets: c, scaleX: -1, duration: 150, yoyo: true });
            });
          },
        });
      },
    });
  }

  private _playDiscoverySound(freq: number) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.2);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(); osc.stop(ctx.currentTime + 0.6);
      osc.onended = () => ctx.close();
    } catch { /* silence */ }
  }

  private _updateCreatureBehaviour(_wx: number, _wy: number) {
    if (!this.creatureSprite) return;
    if (this.phase === 'help_phase' || this.phase === 'complete') return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DRAWING HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  private _drawArch(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number) {
    g.fillStyle(color, 0.7);
    g.fillRect(x - w / 2, y - h / 2 + h / 3, w, (h * 2) / 3);
    g.fillStyle(color, 0.5);
    g.fillEllipse(x, y - h / 2 + h / 3, w, h / 1.5);
    g.fillStyle(0x7799cc, 0.1);
    g.fillEllipse(x, y, w - 10, h - 10);
  }

  private _drawBookshelf(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.fillStyle(0x4a2e0e, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x7a5a2e, 0.8);
    g.strokeRect(x, y, w, h);
    const shelfCount = Math.floor(h / 80);
    const bookColors = [0xaa2222, 0x226688, 0x228833, 0xaa8822, 0x882288, 0x885522];
    for (let s = 0; s < shelfCount; s++) {
      const sy = y + 10 + s * 80;
      g.lineStyle(2, 0x7a5a2e, 0.6);
      g.lineBetween(x, sy + 70, x + w, sy + 70);
      let bx = x + 4, bIdx = 0;
      while (bx < x + w - 8) {
        const bw = 8 + Math.round(Math.random() * 8);
        const bh = 35 + Math.round(Math.random() * 25);
        g.fillStyle(bookColors[(bIdx + s * 3) % bookColors.length], 0.85);
        g.fillRect(bx, sy + 70 - bh, bw, bh);
        bx += bw + 1; bIdx++;
      }
    }
  }

  private _drawPot(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x8b4513, 1);
    g.fillEllipse(x, y + 10, 30, 20);
    g.fillRect(x - 14, y - 10, 28, 22);
    g.lineStyle(1, 0x5a2e0a, 0.7);
    g.strokeRect(x - 14, y - 10, 28, 22);
    g.fillStyle(0x226633, 0.9);
    g.fillEllipse(x - 8, y - 20, 20, 28);
    g.fillEllipse(x + 8, y - 22, 20, 28);
    g.fillStyle(0x339944, 0.7);
    g.fillEllipse(x, y - 28, 18, 26);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COLLIDERS
  // ════════════════════════════════════════════════════════════════════════════

  private _createColliders() {
    const T = 32;
    this._block(WORLD_W / 2,     T / 2,           WORLD_W, T);
    this._block(WORLD_W / 2,     WORLD_H - T / 2, WORLD_W, T);
    this._block(T / 2,           WORLD_H / 2,     T,       WORLD_H);
    this._block(WORLD_W - T / 2, WORLD_H / 2,     T,       WORLD_H);

    // Maxim room
    this._block(70, 370, 100, 140);   // fireplace
    this._block(790, 400, 60, 600);   // bookshelf

    // Dividing passage
    this._block(INV_OFFSET_X - 25, 200, 50, 300);
    this._block(INV_OFFSET_X - 25, 700, 50, 400);

    // Investigation room shelves
    this._block(INV_OFFSET_X + 35, 400, 55, 600);
    this._block(WORLD_W - 65, 400, 55, 650);

    // Tables
    this._block(INV_OFFSET_X + 210, 440, 260, 80);
    this._block(INV_OFFSET_X + 210, 735, 200, 70);
    this._block(INV_OFFSET_X + 560, 390, 220, 80);
    this._block(INV_OFFSET_X + 900, 595, 300, 90);
    this._block(INV_OFFSET_X + 1220, 440, 240, 80);

    // Crates
    this._block(INV_OFFSET_X + 175, 870, 180, 120);
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }
}
