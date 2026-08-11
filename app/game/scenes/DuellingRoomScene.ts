// ============================================================
// DuellingRoomScene — Wizard Duelling Chamber
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { DuelManager } from './duelling-room/DuelManager';
import { createArenaColliders } from './duelling-room/DuelArenaColliders';
import { DOOR_POSITION, DUEL_PLATFORM, WORLD_W, WORLD_H } from './duelling-room/DuelArenaConfig';

const DEFAULT_SPAWN_X = 700;   // left open floor — teaching area side, clearly outside arena
const DEFAULT_SPAWN_Y = 760;   // bottom half of room, below all furniture

// Return position — outside the dueling building door in the outdoor world
// Building tile(25,35), door offset tile(36,34), w:5 h:4
const RETURN_X = 500 + 36 * 20 + Math.round(5 * 20 / 2);   // 1270
const RETURN_Y = 700 + 34 * 20 + Math.round(4 * 20 / 2) + 110; // 1530

export class DuellingRoomScene extends Phaser.Scene {
  private wizard!: Wizard;
  private controller!: PlayerController;
  private duelManager!: DuelManager;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private nearExit   = false;
  private nearDuel   = false;
  private isTransitioning = false;

  // Prompts
  private exitPrompt?: Phaser.GameObjects.Text;
  private duelPrompt?: Phaser.GameObjects.Text;

  // Duel bubble pieces (so we can pulse them based on nearDuel)
  private duelBubbleGlow?: Phaser.GameObjects.Arc;
  private duelBubbleCircle?: Phaser.GameObjects.Arc;
  private duelBubbleIcon?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'DuellingRoomScene' }); }

  preload() {
    this.load.image('duellingRoomInterior', '/assets/backgrounds/duelling-room.png');
  }

  create(data?: { spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit = false;
    this.nearDuel = false;

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    const interior = this.add.image(0, 0, 'duellingRoomInterior').setOrigin(0, 0).setDepth(0);
    interior.setDisplaySize(WORLD_W, WORLD_H);
    this.textures.get('duellingRoomInterior').setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.staticGroup = createArenaColliders(this);

    // ── Exit zone — plain floating text only (no bubble) ─────────────────
    this.exitPrompt = this.add.text(
      DOOR_POSITION.x, DOOR_POSITION.y - 56, 'E  EXIT',
      {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
        color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
        padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
      },
    ).setOrigin(0.5).setDepth(30).setVisible(false);

    // ── Duel trigger bubble — inside the arena circle ─────────────────────
    this._createDuelBubble();

    // Duel prompt text (shown when player is close to arena)
    this.duelPrompt = this.add.text(
      DUEL_PLATFORM.x, DUEL_PLATFORM.y - 56, 'E  DUEL',
      {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
        color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
        padding: { x: 6, y: 3 }, backgroundColor: '#4a1a00',
      },
    ).setOrigin(0.5).setDepth(32).setVisible(false);

    // ── Wizard ────────────────────────────────────────────────────────────
    this.wizard = new Wizard(this, spawnX, spawnY);
    const wizardSprite = this.wizard.getSprite();
    wizardSprite.setDepth(spawnY + 10);

    const body = wizardSprite.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(wizardSprite.width  * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(wizardSprite.height * 0.26)));
      body.setSize(fw, fh);
      body.setOffset(Math.round((wizardSprite.width - fw) / 2), wizardSprite.height - fh);
    }

    this.physics.add.collider(wizardSprite, this.staticGroup);

    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());
    this.duelManager = new DuelManager(this, this.wizard, this.controller);
    this.duelManager.init();

    // ── Camera ────────────────────────────────────────────────────────────
    const cam = this.cameras.main;
    cam.startFollow(wizardSprite, true, 0.1, 0.1);
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    const setZoom = (w: number, h: number) => cam.setZoom(Math.min(w / 1440, h / 810) * 1.0);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) => setZoom(sz.width, sz.height));
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    eventBus.emit('SCENE_READY', { scene: 'DuellingRoomScene' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning) return;
    if (!this.wizard || !this.controller) return;

    this.controller.update(delta);
    this.duelManager.updateDepths();

    const wx = this.wizard.getSprite().x;
    const wy = this.wizard.getSprite().y;

    // ── Exit zone ─────────────────────────────────────────────────────────
    const wasNearExit = this.nearExit;
    this.nearExit = Phaser.Math.Distance.Between(wx, wy, DOOR_POSITION.x, DOOR_POSITION.y) < DOOR_POSITION.radius;
    if (this.nearExit !== wasNearExit) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'duellingRoom' });
      this.exitPrompt?.setVisible(this.nearExit);
    }

    // ── Duel zone ─────────────────────────────────────────────────────────
    const wasNearDuel = this.nearDuel;
    this.nearDuel = Phaser.Math.Distance.Between(wx, wy, DUEL_PLATFORM.x, DUEL_PLATFORM.y) < DUEL_PLATFORM.radius;
    if (this.nearDuel !== wasNearDuel) {
      eventBus.emit('PLAYER_NEAR_DUEL', { near: this.nearDuel });
      this.duelPrompt?.setVisible(this.nearDuel);
      // Brighten bubble when player is close
      if (this.duelBubbleCircle) {
        this.duelBubbleCircle.setAlpha(this.nearDuel ? 1 : 0.82);
      }
    }
  }

  // ── Duel bubble (inside arena circle) ────────────────────────────────────
  private _createDuelBubble() {
    const cx = DUEL_PLATFORM.x;
    const cy = DUEL_PLATFORM.y;

    // Outer pulsing glow ring
    this.duelBubbleGlow = this.add.circle(cx, cy, 44, 0xf0c020, 0.14).setDepth(18);
    this.tweens.add({
      targets: this.duelBubbleGlow,
      fillAlpha: { from: 0.08, to: 0.42 },
      scaleX: { from: 0.85, to: 1.22 },
      scaleY: { from: 0.85, to: 1.22 },
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Inner bubble circle
    this.duelBubbleCircle = this.add.circle(cx, cy, 30, 0x1a0600, 0.92).setDepth(19);
    this.duelBubbleCircle.setStrokeStyle(3, 0xf0c020, 1);

    // Crossed-swords icon
    this.duelBubbleIcon = this.add.text(cx, cy, '\u2694', {
      fontSize: '24px', color: '#f0c020',
    }).setOrigin(0.5).setDepth(20);

    // Bob up and down continuously
    this.tweens.add({
      targets: [this.duelBubbleGlow, this.duelBubbleCircle, this.duelBubbleIcon],
      y: '-=10',
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // ── Interactions ─────────────────────────────────────────────────────────
  private _handleInteract() {
    // Exit takes priority
    if (this.nearExit && !this.isTransitioning) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
      eventBus.emit('EXIT_BUILDING', { buildingId: 'duellingRoom' });
      this.isTransitioning = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('OutdoorWorldScene', { returnX: RETURN_X, returnY: RETURN_Y });
      });
      return;
    }

    // Duel start
    if (this.nearDuel) {
      this.duelManager.attemptStartDuel(
        this.wizard.getSprite().x,
        this.wizard.getSprite().y,
      );
    }
  }
}
