// ============================================================
// HogwartsLibraryScene — The Restricted Section
// Interior scene for the Hogwarts Library building.
// MM2 (hogwarts-library-interior.png) is the visual reference.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';

const WORLD_W = 1680;
const WORLD_H = 960;

// Exit zone — centre of the room so it is always reachable.
const EXIT_ZONE = {
  x: 840,
  y: 500,
  halfW: 220,
  halfH: 220,
};

// Spawn point — bottom-centre, just inside the entrance
const DEFAULT_SPAWN_X = 840;
const DEFAULT_SPAWN_Y = 730;

// Return position — outside MM1 door in the outdoor world
// Library at tile(110,110), door at 48% of 1100px width, 82% of 640px height
const RETURN_X = 2200 + Math.round(1100 * 0.48);   // 2728
const RETURN_Y = 2200 + Math.round(640  * 0.82) + 110; // 2835

export class HogwartsLibraryScene extends Phaser.Scene {
  private wizard!: Wizard;
  private controller!: PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private nearExit = false;
  private isTransitioning = false;
  private exitPrompt?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'HogwartsLibraryScene' });
  }

  preload() {
    this.load.image('libraryInterior', '/assets/backgrounds/hogwarts-library-interior.png');
  }

  create(data?: { spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit = false;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    // Background
    const interior = this.add.image(0, 0, 'libraryInterior').setOrigin(0, 0).setDepth(0);
    interior.setDisplaySize(WORLD_W, WORLD_H);
    this.textures.get('libraryInterior').setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Colliders
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // Permanent exit bubble at centre
    this._createExitBubble();

    // Exit prompt
    this.exitPrompt = this.add.text(EXIT_ZONE.x, EXIT_ZONE.y - 60, 'E  EXIT', {
      fontFamily: 'monospace',
      fontSize:   '13px',
      fontStyle:  'bold',
      color:      '#ffe4a3',
      stroke:     '#20150d',
      strokeThickness: 4,
      padding: { x: 6, y: 3 },
      backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    // Wizard
    this.wizard = new Wizard(this, spawnX, spawnY);
    const spr = this.wizard.getSprite();
    spr.setDepth(spawnY + 10);

    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const feetW = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const feetH = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(feetW, feetH);
      body.setOffset(Math.round((spr.width - feetW) / 2), spr.height - feetH);
    }

    this.physics.add.collider(spr, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) => cam.setZoom(Math.min(w / 1440, h / 810) * 1.05);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) => setZoom(sz.width, sz.height));

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    eventBus.emit('SCENE_READY', { scene: 'HogwartsLibraryScene' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    if (!this.wizard || !this.controller) return;

    this.controller.update(delta);

    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);

    const wasNear = this.nearExit;
    const dx = Math.abs(spr.x - EXIT_ZONE.x);
    const dy = Math.abs(spr.y - EXIT_ZONE.y);
    this.nearExit = dx <= EXIT_ZONE.halfW && dy <= EXIT_ZONE.halfH;

    if (this.nearExit !== wasNear) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'hogwartsLibrary' });
      this.exitPrompt?.setVisible(this.nearExit);
    }
  }

  private _createExitBubble() {
    const cx = EXIT_ZONE.x, cy = EXIT_ZONE.y;
    const glow = this.add.circle(cx, cy, 36, 0xffcc22, 0.14).setDepth(28);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from: 0.08, to: 0.32 },
      scaleX: { from: 0.88, to: 1.18 }, scaleY: { from: 0.88, to: 1.18 },
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const bubble = this.add.circle(cx, cy, 26, 0x1a0a02, 0.9).setDepth(29);
    bubble.setStrokeStyle(2.5, 0xffcc55, 1);
    const icon = this.add.text(cx, cy, '\u{1F4DA}', { fontSize: '20px' }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: [glow, bubble, icon], y: '-=7', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ── Collision layout based on MM2 at 1680x960 ─────────────────────────────
  // Key rules:
  //   - Staircase (top-left): block the steps, keep floor path in FRONT open
  //   - Arch door (centre-top): block only the WALL sections left/right/above arch,
  //     NOT the floor in front — player must be able to stand there
  //   - Bookshelves left/right: solid from top to mid-height only
  //   - Tables/furniture: solid blocks
  //   - Chain barrier: decorative only, do NOT block the floor
  private _createColliders() {
    const T = 32;
    // Outer room walls
    this._block(WORLD_W / 2,     T / 2,              WORLD_W, T);   // top
    this._block(WORLD_W / 2,     WORLD_H - T / 2,    WORLD_W, T);   // bottom
    this._block(T / 2,           WORLD_H / 2,        T, WORLD_H);   // left
    this._block(WORLD_W - T / 2, WORLD_H / 2,        T, WORLD_H);   // right

    // ── STAIRCASE (top-left) ─────────────────────────────────────────────────
    // Steps themselves: x≈32–230, y≈32–360 — block the steps
    // Floor path in front of stairs (x≈32–230, y≈360–450) — keep OPEN
    this._block(130, 195, 195, 325);   // stair steps — solid

    // ── LEFT TALL BOOKSHELF ──────────────────────────────────────────────────
    // x≈235–545, y≈32–490
    // Keep the floor BELOW the shelf (y>490) open for walking
    this._block(390, 260, 310, 455);

    // ── RIGHT TALL BOOKSHELF ─────────────────────────────────────────────────
    // x≈1135–1450, y≈32–490
    this._block(1292, 260, 315, 455);

    // ── CENTRAL ARCH DOOR — only block the solid WALL, not the floor ─────────
    // The arch opening is at x≈695–985, y≈160–380
    // Wall ABOVE arch: x≈695–985, y≈32–160
    this._block(840, 96, 290, 128);
    // Wall LEFT of arch: x≈545–695, y≈32–380
    this._block(620, 206, 150, 348);
    // Wall RIGHT of arch: x≈985–1135, y≈32–380
    this._block(1060, 206, 150, 348);
    // The arch DOOR itself (chained, impassable): x≈695–985, y≈160–380
    // Block only the door panel, not the floor step in front
    this._block(840, 255, 290, 190);

    // ── SMALL READING TABLE LEFT ─────────────────────────────────────────────
    // x≈115–370, y≈480–620
    this._block(242, 550, 255, 140);

    // ── READING DESK + CHAIR RIGHT-CENTRE ────────────────────────────────────
    // x≈940–1210, y≈390–565
    this._block(1075, 477, 270, 175);

    // ── RIGHT-SIDE SKULL / GLOBE STAND ───────────────────────────────────────
    // x≈1450–1648, y≈440–680
    this._block(1549, 560, 200, 240);

    // ── BOTTOM TREASURE CHESTS LEFT ──────────────────────────────────────────
    this._block(110, 770, 185, 220);

    // ── BOTTOM TREASURE CHESTS RIGHT ─────────────────────────────────────────
    this._block(1570, 770, 185, 220);

    // NOTE: Chain barrier posts are purely decorative — no collision.
    // Player can freely walk through that area to reach the exit bubble.
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }

  private _handleInteract() {
    if (!this.nearExit || this.isTransitioning) return;
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    eventBus.emit('EXIT_BUILDING', { buildingId: 'hogwartsLibrary' });
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('OutdoorWorldScene', { returnX: RETURN_X, returnY: RETURN_Y });
    });
  }
}
