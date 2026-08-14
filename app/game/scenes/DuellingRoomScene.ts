  // ============================================================
// DuellingRoomScene — Wizard Duelling Chamber (t7 background)
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { DuelManager } from './duelling-room/DuelManager';
import { createArenaColliders } from './duelling-room/DuelArenaColliders';
import { DOOR_POSITION, DUEL_PLATFORM, WORLD_W, WORLD_H } from './duelling-room/DuelArenaConfig';
import { isQuestAvailable } from '../data/questPaths';

// ── Spawn: bottom entrance area, right at the exit zone ──────────────────
const DEFAULT_SPAWN_X = 1277;
const DEFAULT_SPAWN_Y = 830;

// ── Return to outdoor world ───────────────────────────────────────────────
const RETURN_X = 500 + 36 * 20 + Math.round(5 * 20 / 2);   // 1270
const RETURN_Y = 700 + 34 * 20 + Math.round(4 * 20 / 2) + 110; // 1530

export class DuellingRoomScene extends Phaser.Scene {
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private duelManager!: DuelManager;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;

  private nearExit        = false;
  private nearDuel        = false;
  private nearGoodQuest   = false;
  private isTransitioning = false;

  // UI prompts
  private exitPrompt?:      Phaser.GameObjects.Text;
  private duelPrompt?:      Phaser.GameObjects.Text;
  private goodQuestPrompt?: Phaser.GameObjects.Text;

  // Good-path quest bubble position (left teaching area, near chalkboard)
  private readonly GOOD_QUEST_POS = { x: 420, y: 450, radius: 90 };

  // Duel bubble visuals
  private duelBubbleGlow?:   Phaser.GameObjects.Arc;
  private duelBubbleCircle?: Phaser.GameObjects.Arc;
  private duelBubbleIcon?:   Phaser.GameObjects.Text;

  constructor() { super({ key: 'DuellingRoomScene' }); }

  preload() {
    this.load.image('duellingRoomInterior', '/assets/backgrounds/duelling-room.png');
  }

  create(data?: { spawnX?: number; spawnY?: number }) {
    this.isTransitioning = false;
    this.nearExit        = false;
    this.nearDuel        = false;

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    // ── Background ────────────────────────────────────────────────────────
    const interior = this.add.image(0, 0, 'duellingRoomInterior')
      .setOrigin(0, 0).setDepth(0);
    interior.setDisplaySize(WORLD_W, WORLD_H);
    this.textures.get('duellingRoomInterior')
      .setFilter(Phaser.Textures.FilterMode.NEAREST);

    // ── Colliders ─────────────────────────────────────────────────────────
    this.staticGroup = createArenaColliders(this);

    // ── Exit bubble ───────────────────────────────────────────────────────
    this._createExitBubble();

    // ── Duel bubble (evil path only) ──────────────────────────────────────
    if (isQuestAvailable('dueling')) {
      this._createDuelBubble();
    }

    // ── Good-path spell training quest bubble ─────────────────────────────
    if (isQuestAvailable('goodDuelingTraining')) {
      this._createGoodQuestBubble();
    }

    // ── Prompts ───────────────────────────────────────────────────────────
    this.exitPrompt = this.add.text(
      DOOR_POSITION.x, DOOR_POSITION.y - 58, 'E  EXIT',
      { fontFamily:'monospace', fontSize:'13px', fontStyle:'bold',
        color:'#ffe4a3', stroke:'#20150d', strokeThickness:4,
        padding:{x:6,y:3}, backgroundColor:'#4d311d' },
    ).setOrigin(0.5).setDepth(35).setVisible(false);

    this.duelPrompt = this.add.text(
      DUEL_PLATFORM.x, DUEL_PLATFORM.y - 58, 'E  DUEL',
      { fontFamily:'monospace', fontSize:'13px', fontStyle:'bold',
        color:'#ffe4a3', stroke:'#20150d', strokeThickness:4,
        padding:{x:6,y:3}, backgroundColor:'#4a1a00' },
    ).setOrigin(0.5).setDepth(35).setVisible(false);

    // ── Good-path quest prompt ────────────────────────────────────────────
    this.goodQuestPrompt = this.add.text(
      this.GOOD_QUEST_POS.x, this.GOOD_QUEST_POS.y - 62, 'E  SPELL TRAINING',
      { fontFamily:'monospace', fontSize:'11px', fontStyle:'bold',
        color:'#ffe4a3', stroke:'#10003a', strokeThickness:4,
        padding:{x:7,y:3}, backgroundColor:'#1a0040' },
    ).setOrigin(0.5).setDepth(35).setVisible(false);

    // ── Wizard ────────────────────────────────────────────────────────────
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

    this.controller = new PlayerController(
      this, this.wizard, () => this._handleInteract(),
    );
    this.duelManager = new DuelManager(this, this.wizard, this.controller);
    this.duelManager.init();

    // ── Camera ────────────────────────────────────────────────────────────
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
    eventBus.emit('SCENE_READY', { scene: 'DuellingRoomScene' });
  }

  // ════════════════════════════════════════════════════════════════════
  update(_t: number, delta: number) {
    if (this.isTransitioning || !this.wizard || !this.controller) return;

    this.controller.update(delta);
    this.duelManager.updateDepths();

    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);
    const wx = spr.x, wy = spr.y;

    // ── Exit zone ─────────────────────────────────────────────────────────
    const wasNearExit = this.nearExit;
    this.nearExit = Phaser.Math.Distance.Between(
      wx, wy, DOOR_POSITION.x, DOOR_POSITION.y,
    ) < DOOR_POSITION.radius;
    if (this.nearExit !== wasNearExit) {
      eventBus.emit('PLAYER_NEAR_DOOR',
        { near: this.nearExit, target: 'duellingRoom' });
      this.exitPrompt?.setVisible(this.nearExit);
    }

    // ── Duel zone (evil path only) ────────────────────────────────────────
    if (isQuestAvailable('dueling')) {
      const wasNearDuel = this.nearDuel;
      this.nearDuel = Phaser.Math.Distance.Between(
        wx, wy, DUEL_PLATFORM.x, DUEL_PLATFORM.y,
      ) < DUEL_PLATFORM.radius;
      if (this.nearDuel !== wasNearDuel) {
        eventBus.emit('PLAYER_NEAR_DUEL', { near: this.nearDuel });
        this.duelPrompt?.setVisible(this.nearDuel);
        if (this.duelBubbleCircle) {
          this.duelBubbleCircle.setAlpha(this.nearDuel ? 1 : 0.82);
        }
      }
    } else {
      this.nearDuel = false;
    }

    // ── Good-path quest zone ──────────────────────────────────────────────
    if (isQuestAvailable('goodDuelingTraining')) {
      const wasNearGood = this.nearGoodQuest;
      this.nearGoodQuest = Phaser.Math.Distance.Between(
        wx, wy, this.GOOD_QUEST_POS.x, this.GOOD_QUEST_POS.y,
      ) < this.GOOD_QUEST_POS.radius;
      if (this.nearGoodQuest !== wasNearGood) {
        this.goodQuestPrompt?.setVisible(this.nearGoodQuest);
      }
    } else {
      this.nearGoodQuest = false;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // EXIT BUBBLE — golden book icon, same style as other scenes
  private _createExitBubble() {
    const cx = DOOR_POSITION.x, cy = DOOR_POSITION.y;

    const glow = this.add.circle(cx, cy, 38, 0xffcc22, 0.15).setDepth(28);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from:0.08, to:0.34 },
      scaleX: { from:0.88, to:1.18 },
      scaleY: { from:0.88, to:1.18 },
      duration: 1100, yoyo:true, repeat:-1, ease:'Sine.easeInOut',
    });

    const bubble = this.add.circle(cx, cy, 26, 0x1a0a02, 0.92)
      .setStrokeStyle(2.5, 0xffcc55, 1).setDepth(29);

    const icon = this.add.text(cx, cy, '🚪', { fontSize:'20px' })
      .setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: [glow, bubble, icon],
      y:'-=7', duration:1100, yoyo:true, repeat:-1, ease:'Sine.easeInOut',
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // DUEL BUBBLE — golden ⚔ swords, inside arena
  private _createDuelBubble() {
    const cx = DUEL_PLATFORM.x, cy = DUEL_PLATFORM.y;

    this.duelBubbleGlow = this.add.circle(cx, cy, 44, 0xf0c020, 0.14)
      .setDepth(18);
    this.tweens.add({
      targets: this.duelBubbleGlow,
      fillAlpha: { from:0.08, to:0.42 },
      scaleX: { from:0.85, to:1.22 },
      scaleY: { from:0.85, to:1.22 },
      duration: 1100, yoyo:true, repeat:-1, ease:'Sine.easeInOut',
    });

    this.duelBubbleCircle = this.add.circle(cx, cy, 30, 0x1a0600, 0.92)
      .setDepth(19);
    this.duelBubbleCircle.setStrokeStyle(3, 0xf0c020, 1);

    this.duelBubbleIcon = this.add.text(cx, cy, '\u2694',
      { fontSize:'24px', color:'#f0c020' })
      .setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: [this.duelBubbleGlow, this.duelBubbleCircle, this.duelBubbleIcon],
      y:'-=10', duration:1100, yoyo:true, repeat:-1, ease:'Sine.easeInOut',
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // INTERACTIONS
  private _handleInteract() {
    if (this.isTransitioning) return;

    // Exit — priority
    if (this.nearExit) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near:false });
      eventBus.emit('EXIT_BUILDING', { buildingId:'duellingRoom' });
      this.isTransitioning = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('OutdoorWorldScene',
          { returnX: RETURN_X, returnY: RETURN_Y });
      });
      return;
    }

    // Duel start — evil path only
    if (this.nearDuel && isQuestAvailable('dueling')) {
      this.duelManager.attemptStartDuel(
        this.wizard.getSprite().x,
        this.wizard.getSprite().y,
      );
    }

    // Good-path spell training quest
    if (this.nearGoodQuest && isQuestAvailable('goodDuelingTraining')) {
      this.isTransitioning = true;
      eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
      this.cameras.main.fadeOut(700, 10, 0, 40);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('SpellTrainingScene', { fromDueling: true });
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // GOOD-PATH QUEST BUBBLE — purple ✨ sparkle icon, near chalkboard
  private _createGoodQuestBubble() {
    const cx = this.GOOD_QUEST_POS.x, cy = this.GOOD_QUEST_POS.y;

    const glow = this.add.circle(cx, cy, 42, 0xaa44ff, 0.18).setDepth(28);
    this.tweens.add({
      targets: glow,
      fillAlpha: { from:0.10, to:0.42 },
      scaleX: { from:0.82, to:1.24 },
      scaleY: { from:0.82, to:1.24 },
      duration: 1300, yoyo:true, repeat:-1, ease:'Sine.easeInOut',
    });
    const bubble = this.add.circle(cx, cy, 28, 0x0d0020, 0.94)
      .setStrokeStyle(2.5, 0xcc88ff, 1).setDepth(29);
    const icon = this.add.text(cx, cy, '✨',
      { fontSize:'22px' }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: [glow, bubble, icon],
      y:'-=9', duration:1300, yoyo:true, repeat:-1, ease:'Sine.easeInOut',
    });
    this.add.text(cx, cy + 46, 'SPELL\nTRAINING', {
      fontFamily:'monospace', fontSize:'8px', color:'#cc88ff',
      stroke:'#10003a', strokeThickness:3, align:'center',
    }).setOrigin(0.5).setDepth(30);
  }
}
