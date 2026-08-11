// ============================================================
// AstronomyTowerScene — برج الفلك (Astronomy Tower)
// Interior scene for the Astronomy Tower building.
// F2 (astronomy-tower-interior.png) is the visual reference.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';

// Interior canvas size — match display size set on the background image
const WORLD_W = 1504;
const WORLD_H = 960;

// ── Exit zone — centre of the circular floor so it is always reachable ──
// Player just needs to enter this radius to see [E] EXIT
const EXIT_ZONE = {
  x: 752,    // centre X
  y: 500,    // slightly above absolute centre (door/stairs area in F2)
  halfW: 200,
  halfH: 200,
};

// Spawn point — bottom-left entry arch (stairs entry in F2)
const DEFAULT_SPAWN_X = 300;
const DEFAULT_SPAWN_Y = 820;

// ── Return position (outdoor world) ──────────────────────
// Building at tile (25,110), scaled 50×32 tiles (1000×640px):
//   doorX = 500 + 50% of 1000 = 1000
//   doorY = 2200 + 83% of 640 = 2731
const RETURN_X = 1000;
const RETURN_Y = 2841;   // doorY + 110

export class AstronomyTowerScene extends Phaser.Scene {
  private wizard!: Wizard;
  private controller!: PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private nearExit = false;
  private isTransitioning = false;
  private exitPrompt?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'AstronomyTowerScene' });
  }

  preload() {
    this.load.image('astronomyTowerInterior', '/assets/backgrounds/astronomy-tower-interior.png');
  }

  create(data?: { spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit = false;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    // Background — fill whole interior
    const interior = this.add.image(0, 0, 'astronomyTowerInterior')
      .setOrigin(0, 0)
      .setDepth(0);
    interior.setDisplaySize(WORLD_W, WORLD_H);
    this.textures.get('astronomyTowerInterior').setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Colliders
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // Permanent exit bubble at EXIT_ZONE centre
    this._createExitBubble();

    // Exit prompt text (hidden until player is in zone)
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

    // Feet-only physics body
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const feetW = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const feetH = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(feetW, feetH);
      body.setOffset(Math.round((spr.width - feetW) / 2), spr.height - feetH);
    }

    this.physics.add.collider(spr, this.staticGroup);

    // Controller
    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    // Camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) =>
      cam.setZoom(Math.min(w / 1440, h / 810) * 1.05);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) =>
      setZoom(sz.width, sz.height));

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    eventBus.emit('SCENE_READY', { scene: 'AstronomyTowerScene' });
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
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'astronomyTower' });
      this.exitPrompt?.setVisible(this.nearExit);
    }
  }

  // ── Permanent gold bubble at exit zone ────────────────────────────────────
  private _createExitBubble() {
    const cx = EXIT_ZONE.x;
    const cy = EXIT_ZONE.y;

    const glow = this.add.circle(cx, cy, 36, 0xffcc22, 0.14).setDepth(28);
    this.tweens.add({
      targets:   glow,
      fillAlpha: { from: 0.08, to: 0.32 },
      scaleX:    { from: 0.88, to: 1.18 },
      scaleY:    { from: 0.88, to: 1.18 },
      duration:  1100,
      yoyo:      true,
      repeat:    -1,
      ease:      'Sine.easeInOut',
    });

    const bubble = this.add.circle(cx, cy, 26, 0x1a1005, 0.9).setDepth(29);
    bubble.setStrokeStyle(2.5, 0xffcc55, 1);

    const icon = this.add.text(cx, cy, '🚪', { fontSize: '20px' })
      .setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets:  [glow, bubble, icon],
      y:        `-=7`,
      duration: 1100,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ── Collision layout — F2 interior at 1504x960 ──────────────────────────
  // Uses a circular wall approximation (24 segments) + furniture blocks.
  // Interior circle centre: ~(720, 500), inner radius ~400px, wall thickness ~70px.
  // Entry arch at bottom-left (~200deg–250deg) is kept OPEN.
  private _createColliders() {

    // ── 1. CIRCULAR OUTER WALL — 24 rectangular segments arranged in a ring ──
    // Each segment is a short thick rectangle placed tangent to the circle.
    const cx      = 720;   // circle centre X
    const cy      = 500;   // circle centre Y
    const radius  = 400;   // inner wall radius
    const thick   = 75;    // wall thickness
    const mid     = radius + thick / 2;  // centre of wall ring
    const segs    = 24;    // number of segments
    // Entry arch gap: degrees 195 to 245 (bottom-left, where the stairs are)
    const gapStart = 195 * (Math.PI / 180);
    const gapEnd   = 245 * (Math.PI / 180);

    for (let i = 0; i < segs; i++) {
      const angle     = (i / segs) * Math.PI * 2;
      const nextAngle = ((i + 1) / segs) * Math.PI * 2;
      const midAngle  = (angle + nextAngle) / 2;

      // Skip the entry arch gap
      const normMid = ((midAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (normMid >= gapStart && normMid <= gapEnd) continue;

      // Centre of this segment
      const sx = cx + Math.cos(midAngle) * mid;
      const sy = cy + Math.sin(midAngle) * mid;

      // Arc length of one segment
      const arcLen = (Math.PI * 2 / segs) * radius + 10;

      // Segment is a rectangle rotated to face tangent to the circle.
      // Since Phaser arcade physics only supports axis-aligned rects,
      // we decompose into a wider horizontal/vertical block depending on angle.
      // For segments mostly horizontal (top/bottom), use wide+short block.
      // For segments mostly vertical (left/right), use tall+narrow block.
      const cosA = Math.abs(Math.cos(midAngle));
      const sinA = Math.abs(Math.sin(midAngle));
      let segW: number, segH: number;
      if (cosA > sinA) {
        // More horizontal
        segW = arcLen;
        segH = thick;
      } else {
        // More vertical
        segW = thick;
        segH = arcLen;
      }

      this._block(sx, sy, segW, segH);
    }

    // ── 2. SMALL ROUND TOWER — far right ────────────────────────────────────
    this._block(1300, 270, 320, 420);

    // ── 3. LEFT ALCOVE — shelf + potions/books ──────────────────────────────
    this._block(170, 390, 260, 260);

    // ── 4. LECTERN / BOOK STAND ─────────────────────────────────────────────
    this._block(360, 420, 140, 150);

    // ── 5. ARMILLARY SPHERE PEDESTAL ────────────────────────────────────────
    this._block(575, 280, 170, 160);

    // ── 6. LARGE TELESCOPE + MOUNT ──────────────────────────────────────────
    this._block(860, 360, 380, 240);

    // ── 7. CENTRE MAP TABLE ─────────────────────────────────────────────────
    this._block(615, 510, 370, 150);

    // ── 8. RIGHT ALCOVE — bottles + gear ────────────────────────────────────
    this._block(1125, 400, 210, 250);

    // ── 9. BOTTOM-RIGHT CORNER — hourglass/lantern ──────────────────────────
    this._block(1105, 670, 90, 90);
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }

  private _handleInteract() {
    if (!this.nearExit || this.isTransitioning) return;

    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    eventBus.emit('EXIT_BUILDING', { buildingId: 'astronomyTower' });
    this.isTransitioning = true;

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('OutdoorWorldScene', {
        returnX: RETURN_X,
        returnY: RETURN_Y,
      });
    });
  }
}
