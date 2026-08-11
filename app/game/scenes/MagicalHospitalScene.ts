// ============================================================
// MagicalHospitalScene — المستشفى السحري
// Interior scene. H2 (magical-hospital-interior.png) is the
// visual reference: ornate healing beds with curtains, potion
// shelves, reception desk, magical monitoring devices.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';

const WORLD_W = 1680;
const WORLD_H = 960;

// Exit zone — bottom-centre open corridor between benches, in front of the entrance arch
const EXIT_ZONE = { x: 840, y: 830, halfW: 220, halfH: 70 };

// Spawn — just inside the entrance arch at bottom-centre
const DEFAULT_SPAWN_X = 840;
const DEFAULT_SPAWN_Y = 820;

// Return position — outside H1 door in the outdoor world
// Building at tile(110,8): world x=2200, world y=160
// Door at 48% of 1100px width, 83% of 640px height, +110 below door
const RETURN_X = 2200 + Math.round(1100 * 0.48);        // 2728
const RETURN_Y = 160  + Math.round(640  * 0.83) + 110;  // 801

export class MagicalHospitalScene extends Phaser.Scene {
  private wizard!: Wizard;
  private controller!: PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private nearExit = false;
  private isTransitioning = false;
  private exitPrompt?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'MagicalHospitalScene' }); }

  preload() {
    this.load.image('hospitalInterior', '/assets/backgrounds/magical-hospital-interior.png');
  }

  create(data?: { spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit = false;
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    // Background
    const bg = this.add.image(0, 0, 'hospitalInterior').setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(WORLD_W, WORLD_H);

    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();
    this._createExitBubble();

    // Exit prompt
    this.exitPrompt = this.add.text(EXIT_ZONE.x, EXIT_ZONE.y - 60, 'E  EXIT', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    // Wizard
    this.wizard = new Wizard(this, spawnX, spawnY);
    const spr = this.wizard.getSprite();
    spr.setDepth(spawnY + 10);

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

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    eventBus.emit('SCENE_READY', { scene: 'MagicalHospitalScene' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning || !this.wizard || !this.controller) return;
    this.controller.update(delta);
    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);

    const wasNear = this.nearExit;
    const dx = Math.abs(spr.x - EXIT_ZONE.x);
    const dy = Math.abs(spr.y - EXIT_ZONE.y);
    this.nearExit = dx <= EXIT_ZONE.halfW && dy <= EXIT_ZONE.halfH;

    if (this.nearExit !== wasNear) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'magicalHospital' });
      this.exitPrompt?.setVisible(this.nearExit);
    }
  }

  // ── Exit bubble (red-cross / healing motif) ──────────────────────────────
  private _createExitBubble() {
    const cx = EXIT_ZONE.x, cy = EXIT_ZONE.y;
    const glow = this.add.circle(cx, cy, 36, 0xff4444, 0.14).setDepth(28);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from: 0.08, to: 0.32 },
      scaleX: { from: 0.88, to: 1.18 }, scaleY: { from: 0.88, to: 1.18 },
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const bubble = this.add.circle(cx, cy, 26, 0x1a0002, 0.9).setDepth(29);
    bubble.setStrokeStyle(2.5, 0xff6666, 1);
    const icon = this.add.text(cx, cy, '\u2764', { fontSize: '20px', color: '#ff4444' }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: [glow, bubble, icon],
      y: '-=7', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ── Collision layout (based on H2 at 1680×960) ──────────────────────────
  // Analysed from screenshot:
  //   Top wall shelves + arch entrance
  //   Left green wooden stall partitions
  //   Right green wooden stall partitions
  //   Central water pool — SOLID (no walking through water)
  //   Bottom benches, tables, barrel
  private _createColliders() {
    const T = 32;

    // ── Outer walls ────────────────────────────────────────────────────────
    this._block(WORLD_W / 2,      T / 2,            WORLD_W, T);       // top
    this._block(T / 2,            WORLD_H / 2,      T,       WORLD_H); // left
    this._block(WORLD_W - T / 2,  WORLD_H / 2,      T,       WORLD_H); // right
    // Bottom wall — split around entrance arch (x: 500–980 open)
    this._block(266,              WORLD_H - T / 2,  500,     T);       // bottom-left of arch
    this._block(1330,             WORLD_H - T / 2,  660,     T);       // bottom-right of arch

    // ── Top shelf row — left cluster (x:32–260, y:32–220) ─────────────────
    this._block(146,  130, 228, 195);

    // ── Top shelf row — centre-left (x:260–540, y:32–220) ─────────────────
    this._block(400,  130, 280, 195);

    // ── Top entrance arch stone frame ─────────────────────────────────────
    // Arch sides: left pillar x:540–630, right pillar x:820–910, top header y:32–130
    this._block(585,   82, 90, 100);   // left arch pillar
    this._block(865,   82, 90, 100);   // right arch pillar
    this._block(730,   58, 360, 52);   // header above arch opening

    // ── Top shelf row — centre-right (x:830–1120, y:32–220) ───────────────
    this._block(975,  130, 290, 195);

    // ── Top shelf row — right cluster (x:1130–1420, y:32–220) ─────────────
    this._block(1275, 130, 290, 195);

    // ── Top far-right shelves + sink (x:1420–1648, y:32–220) ──────────────
    this._block(1534, 130, 228, 195);

    // ── LEFT green wooden stall partitions (x:32–148, y:220–760) ─────────
    // These are the tall fenced changing stalls on the far left
    this._block(90,   490, 115, 540);

    // ── RIGHT green wooden stall partitions (x:1532–1648, y:220–760) ──────
    this._block(1590, 490, 115, 540);

    // ── WATER POOL — central rectangular pool ─────────────────────────────
    // Pool outer stone rim: x:340–1340, y:250–430
    // Interior water:       x:390–1290, y:280–400
    // Block the whole pool footprint so player can't walk through
    this._block(840,  340, 1000, 200);

    // ── Pool side buckets / taps (small items beside pool) ────────────────
    // Left tap cluster: x:270–360, y:290–400
    this._block(315,  345, 90, 110);
    // Right tap cluster: x:1320–1410, y:290–400
    this._block(1365, 345, 90, 110);

    // ── Bottom-left bench + basket (x:32–320, y:400–540) ──────────────────
    this._block(176,  470, 288, 140);

    // ── Bottom centre-left bench/table (x:340–590, y:390–530) ────────────
    this._block(465,  460, 250, 140);

    // ── Bottom centre-right table + items (x:1090–1340, y:390–530) ────────
    this._block(1215, 460, 250, 140);

    // ── Bottom-right table + potions (x:1360–1648, y:390–570) ────────────
    this._block(1504, 480, 288, 180);

    // ── Bottom barrel (x:660–790, y:510–640) ──────────────────────────────
    this._block(725,  575, 130, 130);
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }

  private _handleInteract() {
    if (!this.nearExit || this.isTransitioning) return;
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    eventBus.emit('EXIT_BUILDING', { buildingId: 'magicalHospital' });
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('OutdoorWorldScene', { returnX: RETURN_X, returnY: RETURN_Y });
    });
  }
}
