// ============================================================
// CreaturesClassScene — Magical Creatures Classroom
// Interior scene for the Magical Creatures Class building.
// S2 (creatures-class-interior.png) is the visual reference.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { isQuestAvailable } from '../data/questPaths';
import { useGameStore } from '../../stores/gameStore';

const WORLD_W = 1680;
const WORLD_H = 960;

// Exit zone — bottom-centre open corridor (empty area between desks and south wall)
const EXIT_ZONE = { x: 840, y: 870, halfW: 200, halfH: 60 };

// Spawn — enter from bottom-centre (just above south wall, clear of furniture)
const DEFAULT_SPAWN_X = 840;
const DEFAULT_SPAWN_Y = 860;

// Return position — outside S1 door
// Building at tile(50,150): x=1000+48%*1000=1480, y=3000+84%*560=3471
const RETURN_X = 1000 + Math.round(1000 * 0.48);   // 1480
const RETURN_Y = 3000 + Math.round(560  * 0.84) + 110; // 3581

// Quest bubble position — near the creature arena
const QUEST_BUBBLE = { x: 910, y: 450, radius: 70 };

export class CreaturesClassScene extends Phaser.Scene {
  private wizard!: Wizard;
  private controller!: PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private nearExit = false;
  private nearQuestBubble = false;
  private isTransitioning = false;
  private exitPrompt?: Phaser.GameObjects.Text;
  private questPrompt?: Phaser.GameObjects.Text;
  private questBubbleVisible = false;

  constructor() { super({ key: 'CreaturesClassScene' }); }

  preload() {
    this.load.image('creaturesInterior', '/assets/backgrounds/creatures-class-interior.png');
  }

  create(data?: { spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit = false;
    this.nearQuestBubble = false;
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    const bg = this.add.image(0, 0, 'creaturesInterior').setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(WORLD_W, WORLD_H);
    this.textures.get('creaturesInterior').setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();
    this._createExitBubble();

    // ── Quest bubble (Good path only, quest not yet started) ──
    const state = useGameStore.getState();
    this.questBubbleVisible = (
      isQuestAvailable('goodCreaturesLesson') &&
      !state.goodCreaturesLessonStarted
    );
    if (this.questBubbleVisible) {
      this._createQuestBubble();
    }

    this.exitPrompt = this.add.text(EXIT_ZONE.x, EXIT_ZONE.y - 60, 'E  EXIT', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 6, y: 3 }, backgroundColor: '#4d311d',
    }).setOrigin(0.5).setDepth(30).setVisible(false);

    this.questPrompt = this.add.text(
      QUEST_BUBBLE.x, QUEST_BUBBLE.y - 60,
      '✦  E  —  بدء المهمة  ✦',
      {
        fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
        color: '#ffe4a3', stroke: '#13200d', strokeThickness: 5,
        padding: { x: 8, y: 4 }, backgroundColor: '#102a0a',
      }
    ).setOrigin(0.5).setDepth(30).setVisible(false);

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

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w: number, h: number) => cam.setZoom(Math.min(w / 1440, h / 810) * 1.05);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz: { width: number; height: number }) => setZoom(sz.width, sz.height));

    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    eventBus.emit('SCENE_READY', { scene: 'CreaturesClassScene' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning || !this.wizard || !this.controller) return;
    this.controller.update(delta);
    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);

    // Exit zone
    const wasNear = this.nearExit;
    const dx = Math.abs(spr.x - EXIT_ZONE.x);
    const dy = Math.abs(spr.y - EXIT_ZONE.y);
    this.nearExit = dx <= EXIT_ZONE.halfW && dy <= EXIT_ZONE.halfH;
    if (this.nearExit !== wasNear) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'creaturesClass' });
      this.exitPrompt?.setVisible(this.nearExit);
    }

    // Quest bubble zone
    if (this.questBubbleVisible) {
      const wasNearQuest = this.nearQuestBubble;
      const qd = Phaser.Math.Distance.Between(spr.x, spr.y, QUEST_BUBBLE.x, QUEST_BUBBLE.y);
      this.nearQuestBubble = qd < QUEST_BUBBLE.radius;
      if (this.nearQuestBubble !== wasNearQuest) {
        this.questPrompt?.setVisible(this.nearQuestBubble);
      }
    }
  }

  private _createQuestBubble() {
    const cx = QUEST_BUBBLE.x, cy = QUEST_BUBBLE.y;

    // Outer pulsing glow
    const glow = this.add.circle(cx, cy, 44, 0x22ff88, 0.14).setDepth(28);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from: 0.08, to: 0.38 },
      scaleX: { from: 0.85, to: 1.25 },
      scaleY: { from: 0.85, to: 1.25 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Bubble body
    const bubble = this.add.circle(cx, cy, 28, 0x0a2a12, 0.9).setDepth(29);
    bubble.setStrokeStyle(2.5, 0x44ff88, 1);

    // '?' icon
    const icon = this.add.text(cx, cy, '?', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold', color: '#88ffaa',
    }).setOrigin(0.5).setDepth(30);

    // Float animation
    this.tweens.add({
      targets: [glow, bubble, icon],
      y: '-=8',
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Orbiting sparkle particles
    for (let i = 0; i < 3; i++) {
      const angle0 = (i / 3) * Math.PI * 2;
      const spark = this.add.circle(
        cx + Math.cos(angle0) * 36,
        cy + Math.sin(angle0) * 36,
        3, 0x88ffcc, 0.8,
      ).setDepth(30);
      this.tweens.add({
        targets: spark,
        angle: 360,
        duration: 2200 + i * 400,
        repeat: -1,
        ease: 'Linear',
        onUpdate: (tw) => {
          const a = angle0 + (tw.progress * Math.PI * 2);
          spark.setPosition(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36 - 4);
        },
      });
    }
  }

  private _createExitBubble() {
    const cx = EXIT_ZONE.x, cy = EXIT_ZONE.y;
    const glow = this.add.circle(cx, cy, 36, 0xffcc22, 0.14).setDepth(28);
    this.tweens.add({ targets: glow, fillAlpha: { from: 0.08, to: 0.32 }, scaleX: { from: 0.88, to: 1.18 }, scaleY: { from: 0.88, to: 1.18 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const bubble = this.add.circle(cx, cy, 26, 0x1a0a02, 0.9).setDepth(29);
    bubble.setStrokeStyle(2.5, 0xffcc55, 1);
    const icon = this.add.text(cx, cy, '\u{1F43E}', { fontSize: '20px' }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: [glow, bubble, icon], y: '-=7', duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ── Collision based on S2 at 1680×960 ───────────────────────────────────
  private _createColliders() {
    const T = 32;
    // Outer walls
    this._block(WORLD_W / 2,     T / 2,           WORLD_W, T);
    this._block(WORLD_W / 2,     WORLD_H - T / 2, WORLD_W, T);
    this._block(T / 2,           WORLD_H / 2,     T, WORLD_H);
    this._block(WORLD_W - T / 2, WORLD_H / 2,     T, WORLD_H);

    // Chalkboard + teacher desk (top-left)  x:32-420, y:32-300
    this._block(225, 165, 390, 265);

    // Specimen shelf left of centre (top)   x:420-640, y:32-280
    this._block(530, 155, 220, 245);

    // Double shelf centre (top)             x:640-920, y:32-295
    this._block(780, 160, 280, 260);

    // Specimen shelf right of centre (top)  x:920-1120, y:32-280
    this._block(1020, 155, 200, 245);

    // Arch door top-right — only the stone frame above the arch opening.
    this._block(1215, 96, 190, 128);

    // Right shelf unit (top-right)           x:1310-1648, y:32-280
    this._block(1480, 155, 340, 245);

    // Large animal cage LEFT               x:32-200, y:300-580
    this._block(116, 440, 168, 280);

    // Octagonal teacher table (left-centre) x:160-560, y:280-460
    this._block(360, 370, 400, 180);

    // Aquarium tank top                     x:465-660, y:290-430
    this._block(562, 360, 195, 140);

    // Aquarium tank bottom                  x:465-660, y:440-570
    this._block(562, 505, 195, 130);

    // Circular creature arena (right)       x:620-1200, y:290-700
    this._block(910, 295, 560, 60);
    this._block(630, 490, 60, 390);
    this._block(1190, 490, 60, 390);
    this._block(760, 700, 200, 60);
    this._block(1070, 700, 200, 60);

    // Student desks row 1 (bottom-left)     x:115-525, y:490-570
    this._block(320, 530, 410, 80);
    // Student desks row 2                   x:115-525, y:590-670
    this._block(320, 630, 410, 80);

    // Bottom-left barrels                   x:32-185, y:680-880
    this._block(108, 780, 152, 200);

    // Bottom-centre table                   x:115-400, y:700-800
    this._block(257, 750, 285, 100);

    // Bottom-right: large cage x:1310-1648, y:600-780 (blocked)
    this._block(1480, 690, 340, 180);   // cage body
    this._block(1480, 840, 340, 120);   // stair treads
  }

  private _block(cx: number, cy: number, w: number, h: number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }

  private _handleInteract() {
    if (this.isTransitioning) return;

    // Quest bubble interaction
    if (this.nearQuestBubble && this.questBubbleVisible) {
      const state = useGameStore.getState();
      state.setGoodCreaturesLessonStarted();
      this.questBubbleVisible = false;
      this.questPrompt?.setVisible(false);
      this.isTransitioning = true;
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('CreaturesInvestigationScene');
      });
      return;
    }

    // Exit interaction
    if (!this.nearExit) return;
    eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
    eventBus.emit('EXIT_BUILDING', { buildingId: 'creaturesClass' });
    this.isTransitioning = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('OutdoorWorldScene', { returnX: RETURN_X, returnY: RETURN_Y });
    });
  }
}
