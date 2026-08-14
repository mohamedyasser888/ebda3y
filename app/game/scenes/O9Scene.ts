// ============================================================
// O9Scene — Dark Spell Challenge Room
// Entered from HogwartsLibraryScene (MM2) via the quest bubble.
//
// Flow:
//  1. Room starts DARK — intro text shown
//  2. Player types "revelio" → spell effect → quest begins
//  3. 3s LIGHT (move) / 3s DARK (freeze) cycle repeats
//  4. Moving during DARK → failure dialog → retry
//  5. Reach the Restricted Book → discovery → quest complete
//  6. Return bubble → back to HogwartsLibraryScene
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }            from '../entities/Wizard';
import { PlayerController }  from '../systems/PlayerController';

// ── World ────────────────────────────────────────────────────────────────
const WORLD_W = 1680;
const WORLD_H = 1800;

// ── Spawn (bottom-centre entrance) ───────────────────────────────────────
const SPAWN_X = 840;
const SPAWN_Y = 1680;

// ── Restricted Book position (top-centre end of room) ────────────────────
const BOOK_X = 840;
const BOOK_Y = 200;
const BOOK_RADIUS = 80;

// ── Return bubble (near book, after quest complete) ───────────────────────
const RETURN_BUBBLE = { x: 840, y: 320, radius: 80 };

// ── Light / Dark timing ───────────────────────────────────────────────────
const LIGHT_MS = 3000;
const DARK_MS  = 3000;

// ── Movement tolerance during DARK (px) ──────────────────────────────────
// Slightly generous to ignore sub-pixel physics jitter
const MOVE_TOLERANCE = 3;

// ── Room phase ───────────────────────────────────────────────────────────
type RoomPhase =
  | 'intro'       // spell input required
  | 'cycle'       // light/dark cycling, player navigating
  | 'failed'      // caught moving in dark
  | 'found'       // reached book
  | 'complete';   // quest done, return bubble active

export class O9Scene extends Phaser.Scene {
  // ── Core ────────────────────────────────────────────────
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;

  // ── Phase ───────────────────────────────────────────────
  private phase: RoomPhase = 'intro';
  private isLight = false;           // true = LIGHT, false = DARK
  private cycleTimer = 0;            // ms remaining in current half-cycle
  private darkStartX = 0;
  private darkStartY = 0;

  // ── Layers ──────────────────────────────────────────────
  private darkOverlay!:     Phaser.GameObjects.Rectangle;
  private lightIndicator!:  Phaser.GameObjects.Text;

  // ── UI objects ──────────────────────────────────────────
  // ── Spell input state (pure Phaser — no DOM) ────────────────────────────
  private typedSpell  = '';
  private spellDisplay?: Phaser.GameObjects.Text;
  private spellFeedback?: Phaser.GameObjects.Text;
  private introContainer?: Phaser.GameObjects.Container;
  private keyCapture?: Phaser.Input.Keyboard.KeyboardPlugin;
  private keyListener?: (e: KeyboardEvent) => void;
  private failureBox?:     Phaser.GameObjects.Container;
  private bookGlow?:       Phaser.GameObjects.Arc;
  private bookObj?:        Phaser.GameObjects.Text;
  private returnBubble?:   Phaser.GameObjects.Container;
  private nearReturn  = false;
  private returnPrompt?:   Phaser.GameObjects.Text;
  private nearBook    = false;

  // ── Return coords passed from MM2 ───────────────────────
  private mm2ReturnX = 1300;
  private mm2ReturnY = 750;

  constructor() { super({ key: 'O9Scene' }); }

  preload() {
    // O9 uses a programmatically drawn environment — no extra images needed
  }

  create(data?: { returnX?: number; returnY?: number }) {
    this.isTransitioning = false;
    this.phase      = 'intro';
    this.isLight    = false;
    this.cycleTimer = 0;
    this.nearReturn = false;
    this.nearBook   = false;
    // Initialize dark position to spawn so no false-positive on first tick
    this.darkStartX = SPAWN_X;
    this.darkStartY = SPAWN_Y;

    if (data?.returnX) this.mm2ReturnX = data.returnX;
    if (data?.returnY) this.mm2ReturnY = data.returnY;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // ── Draw the room ────────────────────────────────────
    this._drawRoom();

    // ── Collision ────────────────────────────────────────
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // ── Restricted Book object ───────────────────────────
    this._createBook();

    // ── Dark overlay — covers visible screen using scrollFactor 0 ──
    // Rectangle supports setScrollFactor(0) unlike containers
    this.darkOverlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width  * 3, // extra wide to cover zoom
      this.scale.height * 3,
      0x000000, 0.94,
    ).setDepth(80).setScrollFactor(0).setVisible(true);

    // ── Light / dark indicator — fixed to top of screen ──
    this.lightIndicator = this.add.text(this.scale.width / 2, 36, '', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      padding: { x: 12, y: 5 },
    }).setOrigin(0.5).setDepth(95).setScrollFactor(0).setVisible(false);

    // ── Wizard ───────────────────────────────────────────
    this.wizard = new Wizard(this, SPAWN_X, SPAWN_Y);
    const spr = this.wizard.getSprite();
    spr.setDepth(50);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh);
      body.setOffset(Math.round((spr.width - fw) / 2), spr.height - fh);
    }
    this.physics.add.collider(spr, this.staticGroup);
    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());
    this.controller.setBlocked(true); // blocked until revelio is typed

    // ── Camera ───────────────────────────────────────────
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) => cam.setZoom(Math.min(w / 1440, h / 810) * 1.05);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) => setZoom(sz.width, sz.height));
    this.cameras.main.setRoundPixels(true);

    // ── Fade in dark ─────────────────────────────────────
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // ── Show tutorial first, then spell input ────────────
    this.time.delayedCall(900, () => this._showTutorial());

    eventBus.emit('SCENE_READY', { scene: 'O9Scene' as any });
  }

  // ═══════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════
  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    if (!this.wizard || !this.controller) return;

    const spr = this.wizard.getSprite();

    if (this.phase === 'cycle') {
      this.controller.update(delta);
      spr.setDepth(spr.y + 10);
      this._tickCycle(delta, spr);
      this._checkBook(spr);
    } else if (this.phase === 'complete') {
      this.controller.update(delta);
      spr.setDepth(spr.y + 10);
      this._checkReturnBubble(spr);
    }
  }

  // ═══════════════════════════════════════════════════════
  // CYCLE TICK
  // ═══════════════════════════════════════════════════════
  private _tickCycle(delta: number, spr: Phaser.GameObjects.Sprite) {
    this.cycleTimer -= delta;

    // ── Countdown display (3 → 2 → 1) ────────────────────
    const secondsLeft = Math.ceil(this.cycleTimer / 1000);
    const clampedSecs = Math.max(1, Math.min(3, secondsLeft));
    if (this.isLight) {
      this.lightIndicator.setText(`💡  LIGHT — Move!  ${clampedSecs}`);
    } else {
      this.lightIndicator.setText(`🌑  DARK — Freeze!  ${clampedSecs}`);
    }

    if (this.isLight) {
      if (this.cycleTimer <= 0) {
        this._startDark(spr);
      }
    } else {
      // ── DARK — detect movement ────────────────────────────
      const dx = Math.abs(spr.x - this.darkStartX);
      const dy = Math.abs(spr.y - this.darkStartY);
      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
        this._triggerFailure();
        return;
      }
      if (this.cycleTimer <= 0) {
        this._startLight();
      }
    }
  }

  private _startLight() {
    this.isLight    = true;
    this.cycleTimer = LIGHT_MS;
    this.controller.setBlocked(false);
    this.tweens.add({ targets: this.darkOverlay, fillAlpha: 0.0, duration: 400, ease: 'Power2' });
    this.lightIndicator.setText('💡  LIGHT — Move!  3').setColor('#ffe4a3').setBackgroundColor('#4d3000').setVisible(true);
  }

  private _startDark(spr: Phaser.GameObjects.Sprite) {
    this.isLight    = false;
    this.cycleTimer = DARK_MS;
    // Player is NOT blocked — they can move but will lose if they do
    this.controller.setBlocked(false);
    // Store position for detection
    this.darkStartX = spr.x;
    this.darkStartY = spr.y;
    this.tweens.add({ targets: this.darkOverlay, fillAlpha: 0.88, duration: 400, ease: 'Power2' });
    this.lightIndicator.setText('🌑  DARK — Freeze!  3').setColor('#ff8888').setBackgroundColor('#2a0000').setVisible(true);
  }

  // ═══════════════════════════════════════════════════════
  // FAILURE
  // ═══════════════════════════════════════════════════════
  private _triggerFailure() {
    if (this.phase === 'failed') return;
    this.phase = 'failed';
    this.controller.setBlocked(true);
    const spr = this.wizard.getSprite();
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) body.setVelocity(0, 0);

    this.lightIndicator.setVisible(false);

    // Full bright flash then dark
    this.tweens.add({
      targets: this.darkOverlay, fillAlpha: 0.95,
      duration: 200, ease: 'Power3',
    });

    // Short delay then show failure dialog
    this.time.delayedCall(350, () => this._showFailureDialog());
  }

  private _showFailureDialog() {
    const { cx, cy } = this._uiCentre();
    const container = this.add.container(cx, cy).setDepth(110);

    // Background panel
    const panel = this.add.rectangle(0, 0, 560, 240, 0x12001a, 1)
      .setStrokeStyle(3, 0xff4444);
    container.add(panel);

    // Failure text
    const title = this.add.text(0, -68, '💀  You moved in the dark!', {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#ff6666', stroke: '#1a0000', strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(title);

    const msg = this.add.text(0, -22, 'You lost. Try again.', {
      fontFamily: 'monospace', fontSize: '12px',
      color: '#f5e6c8', stroke: '#1a0000', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(msg);

    // OK button
    const btnBg = this.add.rectangle(0, 52, 160, 44, 0x3a0000, 1)
      .setStrokeStyle(2, 0xff6633)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(0, 52, 'OK — Retry', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
      color: '#ffcc88', stroke: '#1a0000', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(btnBg);
    container.add(btnTxt);

    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x660000));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x3a0000));
    btnBg.on('pointerdown',  () => {
      container.destroy();
      this._resetChallenge();
    });

    this.failureBox = container;

    // Scale-in animation
    container.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: container, scale: 1, alpha: 1,
      duration: 300, ease: 'Back.easeOut',
    });
  }

  private _resetChallenge() {
    const spr = this.wizard.getSprite();

    // ── Teleport to spawn ─────────────────────────────────
    spr.setPosition(SPAWN_X, SPAWN_Y);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) { body.reset(SPAWN_X, SPAWN_Y); body.setVelocity(0, 0); }

    // ── Snapshot position NOW so dark detection won't fire ─
    this.darkStartX = SPAWN_X;
    this.darkStartY = SPAWN_Y;

    // ── Block movement briefly while camera pans back ──────
    this.controller.setBlocked(true);
    this.lightIndicator.setVisible(false);
    this.nearBook = false;

    // ── Start as LIGHT immediately after a short fade-in ───
    this.darkOverlay.setAlpha(0.94);
    this.phase      = 'cycle';
    this.isLight    = true;        // already light — no dark check will run
    this.cycleTimer = 99999;       // large — overwritten by _startLight below

    this.time.delayedCall(600, () => {
      this.controller.setBlocked(false);
      this._startLight();          // begins the real 3-second light phase
    });
  }

  // ═══════════════════════════════════════════════════════
  // BOOK DETECTION
  // ═══════════════════════════════════════════════════════
  private _checkBook(spr: Phaser.GameObjects.Sprite) {
    if (!this.isLight) return; // can only find book in light
    if (this.nearBook) return;
    const d = Phaser.Math.Distance.Between(spr.x, spr.y, BOOK_X, BOOK_Y);
    if (d < BOOK_RADIUS) {
      this.nearBook = true;
      this._triggerBookFound();
    }
  }

  private _triggerBookFound() {
    this.phase = 'found';
    this.controller.setBlocked(true);
    this.lightIndicator.setVisible(false);

    // Bring book to foreground, stop dark cycle
    this.tweens.killTweensOf(this.darkOverlay);
    this.tweens.add({
      targets: this.darkOverlay, fillAlpha: 0.0,
      duration: 600, ease: 'Power2',
    });

    // Book glow burst
    if (this.bookGlow) {
      this.tweens.add({
        targets: this.bookGlow,
        fillAlpha: { from: 0, to: 0.9 },
        scaleX: { from: 0.5, to: 2.8 }, scaleY: { from: 0.5, to: 2.8 },
        duration: 800, ease: 'Power2',
      });
    }

    // Sparkle particles around book
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist  = 50 + Math.random() * 60;
      const px = BOOK_X + Math.cos(angle) * dist;
      const py = BOOK_Y + Math.sin(angle) * dist;
      const p = this.add.circle(px, py, 3 + Math.random() * 3, 0xf9e79f, 0.9).setDepth(90);
      this.tweens.add({
        targets: p,
        x: BOOK_X + Math.cos(angle) * (dist + 80),
        y: BOOK_Y + Math.sin(angle) * (dist + 80),
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 1000 + Math.random() * 600,
        delay: Math.random() * 400,
        ease: 'Power2',
      });
    }

    // Light rays
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ray = this.add.rectangle(
        BOOK_X + Math.cos(a) * 70, BOOK_Y + Math.sin(a) * 70,
        5, 100, 0xf9e79f, 0,
      ).setRotation(a + Math.PI / 2).setDepth(89);
      this.tweens.add({
        targets: ray,
        fillAlpha: { from: 0, to: 0.4 },
        scaleY: { from: 0.3, to: 1.6 },
        duration: 800, yoyo: true, repeat: 2,
        delay: i * 70, ease: 'Sine.easeInOut',
      });
    }

    // "Restricted Book found!" message
    this.time.delayedCall(900, () => {
      const { cx, cy } = this._uiCentre();
      const line1 = this.add.text(cx, cy - 50, 'Restricted Book found!', {
        fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold',
        color: '#f9e79f', stroke: '#1a0a00', strokeThickness: 6,
        padding: { x: 18, y: 10 }, backgroundColor: '#1a0a00',
      }).setOrigin(0.5).setDepth(100).setAlpha(0);

      const line2 = this.add.text(cx, cy + 10, 'Quest Completed!', {
        fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold',
        color: '#88ffbb', stroke: '#001a00', strokeThickness: 5,
        padding: { x: 14, y: 8 }, backgroundColor: '#001a00',
      }).setOrigin(0.5).setDepth(100).setAlpha(0);

      this.tweens.add({ targets: line1, alpha: 1, y: cy - 60, duration: 600, ease: 'Back.easeOut' });
      this.tweens.add({ targets: line2, alpha: 1, y: cy,      duration: 600, delay: 300, ease: 'Back.easeOut' });

      // After message, show return bubble
      this.time.delayedCall(2600, () => {
        this.phase = 'complete';
        this.controller.setBlocked(false);
        this._createReturnBubble();
        // Notify evil guidance system that restricted book was found
        eventBus.emit('RESTRICTED_BOOK_FOUND');
        // Fade messages out
        this.tweens.add({ targets: [line1, line2], alpha: 0, duration: 500, delay: 800 });
      });
    });
  }

  // ═══════════════════════════════════════════════════════
  // RETURN BUBBLE
  // ═══════════════════════════════════════════════════════
  private _createReturnBubble() {
    const cx = RETURN_BUBBLE.x, cy = RETURN_BUBBLE.y;
    const container = this.add.container(cx, cy).setDepth(85);

    const glow = this.add.circle(0, 0, 42, 0x22cc44, 0.18).setDepth(0);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from: 0.10, to: 0.45 },
      scaleX: { from: 0.82, to: 1.24 }, scaleY: { from: 0.82, to: 1.24 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const bubble = this.add.circle(0, 0, 28, 0x001a08, 0.94).setStrokeStyle(2.5, 0x55ee88, 1).setDepth(1);
    const icon   = this.add.text(0, 0, '✓', { fontSize: '20px', color: '#55ee88' }).setOrigin(0.5).setDepth(2);

    container.add([glow, bubble, icon]);
    this.tweens.add({ targets: container, y: '-=9', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.returnBubble = container;

    this.returnPrompt = this.add.text(cx, cy - 62, 'E  RETURN TO MM2', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
      color: '#55ee88', stroke: '#001a00', strokeThickness: 4,
      padding: { x: 7, y: 3 }, backgroundColor: '#001a00',
    }).setOrigin(0.5).setDepth(86).setVisible(false);

    this.add.text(cx, cy + 46, 'Quest Completed\nReturn to MM2', {
      fontFamily: 'monospace', fontSize: '8px', color: '#55ee88',
      stroke: '#001a00', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5).setDepth(86);
  }

  private _checkReturnBubble(spr: Phaser.GameObjects.Sprite) {
    if (!this.returnBubble) return;
    const wasNear = this.nearReturn;
    const d = Phaser.Math.Distance.Between(spr.x, spr.y, RETURN_BUBBLE.x, RETURN_BUBBLE.y);
    this.nearReturn = d < RETURN_BUBBLE.radius;
    if (this.nearReturn !== wasNear) {
      this.returnPrompt?.setVisible(this.nearReturn);
    }
  }

  // ═══════════════════════════════════════════════════════
  // INTERACT (E key)
  // ═══════════════════════════════════════════════════════
  private _handleInteract() {
    if (this.isTransitioning) return;

    if (this.phase === 'complete' && this.nearReturn) {
      this.isTransitioning = true;
      eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('HogwartsLibraryScene', {
          spawnX: this.mm2ReturnX,
          spawnY: this.mm2ReturnY,
          fromO9: true,
        });
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // INTRO — spell input
  // ═══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════
  // TUTORIAL — shown before the spell input
  // ═══════════════════════════════════════════════════════
  private _showTutorial() {
    const { cx, cy } = this._uiCentre();
    const container = this.add.container(cx, cy).setDepth(102);

    // Panel
    const panel = this.add.rectangle(0, 0, 720, 420, 0x0d0020, 0.98)
      .setStrokeStyle(3, 0x8833cc);
    container.add(panel);

    // Corner rune decorations
    for (const [rx, ry] of [[-340,-195],[ 340,-195],[-340,195],[ 340,195]]) {
      container.add(this.add.text(rx, ry, '✦', { fontSize: '12px', color: '#4422aa' }).setOrigin(0.5).setAlpha(0.5));
    }

    // Title
    container.add(this.add.text(0, -180, '⚡  DARK SPELL CHALLENGE', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold',
      color: '#cc88ff', stroke: '#0d0020', strokeThickness: 4,
    }).setOrigin(0.5));

    // Divider
    container.add(this.add.rectangle(0, -152, 640, 2, 0x4422aa, 0.6));

    // Rules
    const rules: [string, string][] = [
      ['📖', 'Find the Restricted Book at the far end of the room.'],
      ['💡', 'LIGHT phase (3 sec) — you CAN move freely.'],
      ['🌑', 'DARK phase (3 sec) — you must STOP completely.'],
      ['💀', 'If you move even slightly in the DARK, you lose.'],
      ['🔄', 'After failing, you restart from the entrance.'],
      ['⬆️', 'The room is long — plan your path carefully each light!'],
    ];

    rules.forEach(([icon, text], i) => {
      const y = -110 + i * 46;
      container.add(this.add.text(-310, y, icon, { fontSize: '18px' }).setOrigin(0, 0.5));
      container.add(this.add.text(-272, y, text, {
        fontFamily: 'monospace', fontSize: '9px',
        color: '#e2d9f3', stroke: '#0d0020', strokeThickness: 2,
        wordWrap: { width: 560 },
      }).setOrigin(0, 0.5));
    });

    // Tip line
    container.add(this.add.text(0, 148, 'Tip: memorise your path during LIGHT — then freeze in DARK.', {
      fontFamily: 'monospace', fontSize: '8px', color: '#a78bfa',
      stroke: '#0d0020', strokeThickness: 2,
    }).setOrigin(0.5));

    // START button
    const btnBg = this.add.rectangle(0, 186, 240, 44, 0x2a0066, 1)
      .setStrokeStyle(2, 0xcc88ff)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(0, 186, '▶  Start Challenge', {
      fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold',
      color: '#cc88ff', stroke: '#0d0020', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(btnBg);
    container.add(btnTxt);

    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x440099));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x2a0066));
    btnBg.on('pointerdown',  () => {
      this.tweens.add({
        targets: container, scale: 0.7, alpha: 0, duration: 320, ease: 'Back.easeIn',
        onComplete: () => {
          container.destroy();
          this._showIntro();
        },
      });
    });

    // Scale-in
    container.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 400, ease: 'Back.easeOut' });
  }

  // ═══════════════════════════════════════════════════════
  // INTRO — spell input (revelio)
  // ═══════════════════════════════════════════════════════
  private _showIntro() {
    const { cx, cy } = this._uiCentre();
    this.typedSpell = '';
    const container = this.add.container(cx, cy).setDepth(102);
    this.introContainer = container;

    // Panel background
    const panel = this.add.rectangle(0, 0, 660, 340, 0x0d0020, 0.97)
      .setStrokeStyle(3, 0x8833cc);
    container.add(panel);

    // Decorative stars
    for (let i = 0; i < 14; i++) {
      const s = this.add.text(
        -310 + Math.random() * 620, -155 + Math.random() * 310,
        '✦', { fontSize: '9px', color: '#4422aa' },
      ).setAlpha(0.35);
      container.add(s);
    }

    // Title
    const title = this.add.text(0, -130, '⚡  DARK SPELL CHALLENGE', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold',
      color: '#cc88ff', stroke: '#0d0020', strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(title);

    // Instruction line 1
    const instr = this.add.text(0, -82, 'Enter the spell that reveals hidden objects.', {
      fontFamily: 'monospace', fontSize: '10px',
      color: '#e2d9f3', stroke: '#0d0020', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(instr);

    // Instruction line 2
    const hint = this.add.text(0, -54, 'Type below and press  ENTER', {
      fontFamily: 'monospace', fontSize: '9px', color: '#a78bfa',
      stroke: '#0d0020', strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(hint);

    // Input box background (fixed in container space)
    const inputBg = this.add.rectangle(0, -8, 320, 44, 0x1a0040, 1)
      .setStrokeStyle(2, 0x8833cc);
    container.add(inputBg);

    // Typed text display — shows what the player types
    this.spellDisplay = this.add.text(0, -8, '|', {
      fontFamily: 'monospace', fontSize: '18px',
      color: '#cc88ff', stroke: '#0d0020', strokeThickness: 2,
      letterSpacing: 4,
    }).setOrigin(0.5);
    container.add(this.spellDisplay);

    // Blinking cursor tween on the display
    this.tweens.add({
      targets: this.spellDisplay,
      alpha: { from: 1, to: 0.3 },
      duration: 500, yoyo: true, repeat: -1, ease: 'Linear',
    });

    // Feedback text
    this.spellFeedback = this.add.text(0, 54, '', {
      fontFamily: 'monospace', fontSize: '10px',
      color: '#ff8888', stroke: '#1a0000', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(this.spellFeedback);

    // "Cast Spell" button
    const btnBg = this.add.rectangle(0, 110, 220, 44, 0x2a0066, 1)
      .setStrokeStyle(2, 0xcc88ff)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(0, 110, 'Cast Spell  ⚡  [ ENTER ]', {
      fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold',
      color: '#cc88ff', stroke: '#0d0020', strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(btnBg);
    container.add(btnTxt);

    btnBg.on('pointerover',  () => btnBg.setFillStyle(0x440099));
    btnBg.on('pointerout',   () => btnBg.setFillStyle(0x2a0066));
    btnBg.on('pointerdown',  () => this._submitSpell());

    // Scale-in animation
    container.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 400, ease: 'Back.easeOut' });

    // ── Keyboard capture ─────────────────────────────────
    // We capture raw keydown on the window so every key works regardless
    // of Phaser's key-blocking rules during the intro phase.
    this.keyListener = (e: KeyboardEvent) => {
      if (this.phase !== 'intro') return;

      if (e.key === 'Enter') {
        this._submitSpell();
        return;
      }
      if (e.key === 'Backspace') {
        this.typedSpell = this.typedSpell.slice(0, -1);
      } else if (e.key.length === 1 && this.typedSpell.length < 20) {
        // Only allow letters
        if (/[a-zA-Z]/.test(e.key)) {
          this.typedSpell += e.key.toLowerCase();
        }
      }
      this._updateSpellDisplay();
    };
    window.addEventListener('keydown', this.keyListener);
  }

  private _updateSpellDisplay() {
    if (!this.spellDisplay) return;
    // Show typed text with blinking cursor character
    const display = this.typedSpell.length > 0
      ? this.typedSpell.toUpperCase() + '_'
      : '_';
    this.spellDisplay.setText(display);
  }

  private _submitSpell() {
    if (this.typedSpell.trim().toLowerCase() !== 'revelio') {
      // Wrong — shake and show error
      if (this.spellFeedback) {
        this.spellFeedback.setText('Incorrect spell. Try again.').setColor('#ff8888');
        this.tweens.add({
          targets: this.spellFeedback,
          x: { from: -8, to: 8 },
          duration: 55, yoyo: true, repeat: 5, ease: 'Linear',
          onComplete: () => this.spellFeedback?.setX(0),
        });
      }
      // Flash input box red
      if (this.introContainer) {
        const flash = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 660, 340, 0xff2200, 0)
          .setDepth(103);
        this.tweens.add({
          targets: flash, fillAlpha: { from: 0, to: 0.25 },
          duration: 120, yoyo: true,
          onComplete: () => flash.destroy(),
        });
      }
      return;
    }

    // ── Correct! ──────────────────────────────────────────
    // Remove keyboard listener
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = undefined;
    }
    // Stop cursor blink
    if (this.spellDisplay) this.tweens.killTweensOf(this.spellDisplay);

    if (this.spellFeedback) this.spellFeedback.setText('✨  Revelio!').setColor('#88ffbb');

    // Purple flash
    const flash = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x8833cc, 0)
      .setDepth(105);
    this.tweens.add({
      targets: flash, fillAlpha: { from: 0, to: 0.6 },
      duration: 280, yoyo: true,
      onComplete: () => flash.destroy(),
    });

    // Dismiss intro panel
    this.time.delayedCall(700, () => {
      if (this.introContainer) {
        this.tweens.add({
          targets: this.introContainer, scale: 0.7, alpha: 0, duration: 350, ease: 'Back.easeIn',
          onComplete: () => {
            this.introContainer?.destroy();
            this.introContainer = undefined;
            this._showQuestBanner();
          },
        });
      } else {
        this._showQuestBanner();
      }
    });
  }

  private _showQuestBanner() {
    const { cx, cy } = this._uiCentre();

    const banner = this.add.text(cx, cy, 'Quest: Restricted Book — Find it.', {
      fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold',
      color: '#f9e79f', stroke: '#1a0a00', strokeThickness: 5,
      padding: { x: 18, y: 10 }, backgroundColor: '#1a0a00',
    }).setOrigin(0.5).setDepth(102).setAlpha(0);

    this.tweens.add({ targets: banner, alpha: 1, y: cy - 10, duration: 500, ease: 'Back.easeOut' });

    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: banner, alpha: 0, duration: 400,
        onComplete: () => {
          banner.destroy();
          this._beginCycle();
        },
      });
    });
  }

  private _beginCycle() {
    // Snapshot the player's actual spawn position BEFORE starting
    const spr = this.wizard?.getSprite();
    this.darkStartX = spr?.x ?? SPAWN_X;
    this.darkStartY = spr?.y ?? SPAWN_Y;

    this.phase      = 'cycle';
    this.isLight    = false;
    this.cycleTimer = 99999;
    // Start immediately with normal 3-second light
    this._startLight();
  }

  // normal _startLight handles both first and subsequent light phases

  // ═══════════════════════════════════════════════════════
  // ROOM DRAWING
  // ═══════════════════════════════════════════════════════
  private _drawRoom() {
    const g = this.add.graphics().setDepth(1);

    // Stone floor — full 1800px height
    g.fillStyle(0x2a2438);
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Floor tile grid
    g.lineStyle(1, 0x1a1628, 0.5);
    const TILE = 80;
    for (let x = 0; x < WORLD_W; x += TILE) g.lineBetween(x, 0, x, WORLD_H);
    for (let y = 0; y < WORLD_H; y += TILE) g.lineBetween(0, y, WORLD_W, y);

    // Centre path (worn lighter stone)
    g.fillStyle(0x32293e);
    g.fillRect(600, 0, 480, WORLD_H);

    // ── Back wall (top) ──────────────────────────────────
    g.fillStyle(0x1c1428);
    g.fillRect(0, 0, WORLD_W, 140);
    g.lineStyle(1, 0x2a1e3a, 0.8);
    for (let y = 20; y < 140; y += 30)
      for (let x = 0; x < WORLD_W; x += 100) {
        const ox = (Math.floor(y / 30) % 2) * 50;
        g.strokeRect(x + ox, y, 100, 30);
      }

    // ── Side walls ───────────────────────────────────────
    g.fillStyle(0x1c1428);
    g.fillRect(0,            0, 80, WORLD_H);
    g.fillRect(WORLD_W - 80, 0, 80, WORLD_H);

    // ── Bottom wall with entrance arch ───────────────────
    g.fillStyle(0x1c1428);
    g.fillRect(0, WORLD_H - 120, WORLD_W, 120);
    g.fillStyle(0x2a2438);
    g.fillRect(620, WORLD_H - 120, 440, 120);
    g.lineStyle(4, 0x6b4f31);
    g.strokeRect(620, WORLD_H - 120, 440, 120);

    // ── Full-height LEFT bookshelves ─────────────────────
    this._drawShelf(g, 85,   140,  340, 600, 0x3e2a14);
    this._drawShelf(g, 85,   760,  340, 600, 0x3e2a14);
    this._drawShelf(g, 85,  1380,  340, 300, 0x3a2810);

    // ── Full-height RIGHT bookshelves ────────────────────
    this._drawShelf(g, WORLD_W - 425, 140,  340, 600, 0x3e2a14);
    this._drawShelf(g, WORLD_W - 425, 760,  340, 600, 0x3e2a14);
    this._drawShelf(g, WORLD_W - 425, 1380, 340, 300, 0x3a2810);

    // ── Flanking inner shelves (create corridor) ─────────
    this._drawShelf(g, 440,  200, 150, 480, 0x4a3420);
    this._drawShelf(g, 440,  900, 150, 420, 0x4a3420);
    this._drawShelf(g, 440, 1400, 150, 280, 0x4a3420);
    this._drawShelf(g, WORLD_W - 590,  200, 150, 480, 0x4a3420);
    this._drawShelf(g, WORLD_W - 590,  900, 150, 420, 0x4a3420);
    this._drawShelf(g, WORLD_W - 590, 1400, 150, 280, 0x4a3420);

    // ── Reading tables spread down the room ──────────────
    const tables: [number, number][] = [
      [185, 700], [185, 1100], [185, 1500],
      [WORLD_W - 445, 700], [WORLD_W - 445, 1100], [WORLD_W - 445, 1500],
    ];
    for (const [tx, ty] of tables) {
      g.fillStyle(0x5d3a1a);  g.fillRect(tx, ty, 250, 100);
      g.lineStyle(2, 0x3d2010); g.strokeRect(tx, ty, 250, 100);
      g.fillStyle(0x8b6914);  g.fillRect(tx + 10, ty + 10, 36, 50);
      g.fillStyle(0x2e86c1);  g.fillRect(tx + 55, ty + 12, 12, 46);
      g.fillStyle(0x9b59b6);  g.fillRect(tx + 75, ty + 12, 12, 46);
    }

    // ── Candle pairs every 400px down both sides ──────────
    for (let cy = 600; cy < WORLD_H - 200; cy += 400) {
      for (const cx of [160, WORLD_W - 160]) {
        g.fillStyle(0x6b4f31); g.fillRect(cx - 5, cy + 30, 10, 70);
        g.fillStyle(0xf5e6c8); g.fillRect(cx - 4, cy + 16, 8, 18);
        g.fillStyle(0xff8c00, 0.9); g.fillEllipse(cx, cy + 12, 10, 16);
        g.fillStyle(0xffdd00, 0.8); g.fillEllipse(cx, cy + 9,   6, 10);
      }
    }

    // ── Runic circles at ⅓ and ⅔ of room height ─────────
    for (const ry of [WORLD_H * 0.33, WORLD_H * 0.66]) {
      g.lineStyle(2, 0x5522aa, 0.38);
      g.strokeCircle(WORLD_W / 2, ry, 240);
      g.lineStyle(1, 0x5522aa, 0.22);
      g.strokeCircle(WORLD_W / 2, ry, 200);
      g.strokeCircle(WORLD_W / 2, ry, 280);
    }

    // ── Clutter scattered down corridor ──────────────────
    const clutter: [number, number, number][] = [
      [130,  840, 0xf0e6c8], [175,  870, 0x2e86c1], [200,  872, 0x9b59b6],
      [130, 1240, 0xf0e6c8], [175, 1270, 0xc0392b], [200, 1272, 0x27ae60],
      [WORLD_W - 160,  840, 0xf0e6c8], [WORLD_W - 200,  870, 0x2e86c1],
      [WORLD_W - 160, 1240, 0xf0e6c8], [WORLD_W - 200, 1270, 0xc0392b],
    ];
    for (const [cx, cy, col] of clutter) {
      g.fillStyle(col, 0.85);
      g.fillRect(cx - 12, cy - 18, 24, 36);
    }

    // ── Torch sconces on inner walls ─────────────────────
    for (let ty = 450; ty < WORLD_H - 300; ty += 500) {
      for (const tx of [600, WORLD_W - 600]) {
        g.fillStyle(0x6b4f31); g.fillRect(tx - 4, ty, 8, 50);
        g.fillStyle(0xff8c00, 0.9); g.fillEllipse(tx, ty - 8, 14, 20);
        g.fillStyle(0xffdd00, 0.8); g.fillEllipse(tx, ty - 14, 8, 12);
      }
    }
  }

  private _drawShelf(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    color: number,
  ) {
    g.fillStyle(color);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, 0x2a1e0a);
    g.strokeRect(x, y, w, h);
    // Horizontal shelf boards
    const numShelves = 5;
    const gap = h / numShelves;
    for (let i = 1; i <= numShelves; i++) {
      const sy = y + i * gap;
      g.fillStyle(0x2a1e0a); g.fillRect(x, sy - 5, w, 8);
    }
    // Book spines on each shelf
    const bookColors = [0xc0392b, 0x2471a3, 0x1e8449, 0x7d3c98, 0xb7950b, 0x784212, 0x117a65];
    for (let shelf = 0; shelf < numShelves; shelf++) {
      const shelfY = y + shelf * gap + 8;
      const shelfH = gap - 16;
      let bx = x + 6;
      let bi = shelf * 3;
      while (bx < x + w - 12) {
        const bw = 10 + Math.floor(Math.random() * 8);
        g.fillStyle(bookColors[bi % bookColors.length]);
        g.fillRect(bx, shelfY, bw, shelfH);
        g.lineStyle(1, 0x1a1010, 0.5);
        g.strokeRect(bx, shelfY, bw, shelfH);
        bx += bw + 2;
        bi++;
      }
    }
  }

  // ── Restricted Book ──────────────────────────────────────────────────────
  private _createBook() {
    // Niche in back wall where the book lives
    const bg = this.add.rectangle(BOOK_X, BOOK_Y, 140, 120, 0x12001a, 1)
      .setStrokeStyle(2, 0x6b4f31).setDepth(5);

    // The book itself
    this.bookObj = this.add.text(BOOK_X, BOOK_Y + 8, '📖', { fontSize: '32px' })
      .setOrigin(0.5).setDepth(10);

    // Glow — invisible until discovery
    this.bookGlow = this.add.circle(BOOK_X, BOOK_Y, 60, 0xf9e79f, 0).setDepth(9);

    // Subtle idle pulse so player can notice it on close approach
    this.tweens.add({
      targets: this.bookObj,
      y: BOOK_Y + 4,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Small "Restricted" sign
    this.add.text(BOOK_X, BOOK_Y + 46, 'RESTRICTED', {
      fontFamily: 'monospace', fontSize: '7px',
      color: '#aa3322', stroke: '#0a0000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    // Atmospheric objects around book niche
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0xf5e6c8); g.fillRect(BOOK_X - 60, BOOK_Y - 20, 18, 30); // small book
    g.fillStyle(0x9b59b6, 0.85); g.fillEllipse(BOOK_X + 52, BOOK_Y + 5, 16, 26); // potion
    g.fillStyle(0xff8c00); g.fillEllipse(BOOK_X + 52, BOOK_Y - 14, 8, 13); // candle flame
  }

  // ═══════════════════════════════════════════════════════
  // COLLISION
  // ═══════════════════════════════════════════════════════
  private _createColliders() {
    // Outer walls
    const T = 40;
    this._block(WORLD_W / 2,     T / 2,             WORLD_W, T);
    this._block(WORLD_W / 2,     WORLD_H - T / 2,   WORLD_W, T);
    this._block(T / 2,           WORLD_H / 2,       T, WORLD_H);
    this._block(WORLD_W - T / 2, WORLD_H / 2,       T, WORLD_H);

    // ── LEFT outer shelves (3 sections) ──────────────────
    this._block(255,  440,  340, 600);
    this._block(255, 1060,  340, 600);
    this._block(255, 1530,  340, 300);

    // ── RIGHT outer shelves (3 sections) ─────────────────
    this._block(WORLD_W - 255,  440,  340, 600);
    this._block(WORLD_W - 255, 1060,  340, 600);
    this._block(WORLD_W - 255, 1530,  340, 300);

    // ── LEFT inner shelves ────────────────────────────────
    this._block(515,  440,  150, 480);
    this._block(515, 1110,  150, 420);
    this._block(515, 1540,  150, 280);

    // ── RIGHT inner shelves ───────────────────────────────
    this._block(WORLD_W - 515,  440,  150, 480);
    this._block(WORLD_W - 515, 1110,  150, 420);
    this._block(WORLD_W - 515, 1540,  150, 280);

    // ── Reading tables (left + right, 3 rows each) ────────
    this._block(310,   750,  250, 100);
    this._block(310,  1150,  250, 100);
    this._block(310,  1550,  250, 100);
    this._block(WORLD_W - 310,   750,  250, 100);
    this._block(WORLD_W - 310,  1150,  250, 100);
    this._block(WORLD_W - 310,  1550,  250, 100);

    // ── Book niche sides (top of room near the book) ──────
    this._block(BOOK_X - 90, BOOK_Y + 20, 20, 120);
    this._block(BOOK_X + 90, BOOK_Y + 20, 20, 120);

    // ── Bottom entrance — keep 620–1060 open ─────────────
    this._block(310,           WORLD_H - 60,  620, 120);
    this._block(WORLD_W - 310, WORLD_H - 60,  620, 120);
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }

  // ── Camera-space centre — use for all UI panels ──────────────────────────
  private _uiCentre(): { cx: number; cy: number } {
    const cam  = this.cameras.main;
    const zoom = cam.zoom || 1;
    return {
      cx: cam.scrollX + (cam.width  / zoom) / 2,
      cy: cam.scrollY + (cam.height / zoom) / 2,
    };
  }

  // ── Cleanup — remove window key listener when scene stops ───────────────
  shutdown() {
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = undefined;
    }
  }
}
