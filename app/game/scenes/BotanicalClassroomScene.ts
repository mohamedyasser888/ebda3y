// ============================================================
// BotanicalClassroomScene — Magical Botanical Classroom (Room 24)
// Photo 24 is the visual reference for the room layout.
// Contains the Rare Plant Quest bubble that leads to RarePlantQuestScene.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard } from '../entities/Wizard';
import { PlayerController } from '../systems/PlayerController';
import { isQuestAvailable } from '../data/questPaths';

const WORLD_W = 1504;
const WORLD_H = 848;

const EXIT_DOOR = {
  x: 752,
  y: 424,
  halfW: 180,
  approachMinY: -180,
  approachMaxY:  180,
};

const DEFAULT_SPAWN_X = 240;
const DEFAULT_SPAWN_Y = 380;

// Quest bubble — placed bottom-right area, away from exit door
const QUEST_BUBBLE = { x: 1100, y: 620, radius: 80 };

// Singleton quest state (persists between scene restarts within a session)
export const rarePlantQuestState = {
  completed: false,
};

export class BotanicalClassroomScene extends Phaser.Scene {
  private wizard!: Wizard;
  private controller!: PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private nearExit   = false;
  private nearQuest  = false;
  private isTransitioning = false;
  private exitPrompt?:  Phaser.GameObjects.Text;
  private questPrompt?: Phaser.GameObjects.Text;

  // Quest bubble objects so we can update on return
  private questBubbleGlow?:   Phaser.GameObjects.Arc;
  private questBubbleCircle?: Phaser.GameObjects.Arc;
  private questBubbleIcon?:   Phaser.GameObjects.Text;

  constructor() { super({ key: 'BotanicalClassroomScene' }); }

  preload() {
    this.load.image('botanicalClassroomInterior', '/assets/backgrounds/botanical-classroom-interior.jpg');
    this.load.image('conv_a1', '/a1.png');
    this.load.image('conv_a2', '/a2.png');
    this.load.image('conv_a3', '/a3.png');
    this.load.image('conv_a4', '/a4.png');
  }

  create(data?: { spawnX?: number; spawnY?: number; fromQuest?: boolean }) {
    this.isTransitioning = false;
    this.nearExit  = false;
    this.nearQuest = false;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    const spawnX = data?.spawnX ?? DEFAULT_SPAWN_X;
    const spawnY = data?.spawnY ?? DEFAULT_SPAWN_Y;

    // Background
    const interior = this.add.image(0, 0, 'botanicalClassroomInterior')
      .setOrigin(0, 0).setDepth(0);
    interior.setDisplaySize(WORLD_W, WORLD_H);
    this.textures.get('botanicalClassroomInterior').setFilter(Phaser.Textures.FilterMode.NEAREST);

    // Colliders
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // ── Exit bubble ────────────────────────────────────────────────────────
    const bx = EXIT_DOOR.x, by = EXIT_DOOR.y;
    const exitGlow = this.add.circle(bx, by, 36, 0xffaa22, 0.15).setDepth(28);
    this.tweens.add({ targets: exitGlow, fillAlpha: { from:0.08, to:0.32 }, scaleX:{from:0.88,to:1.18}, scaleY:{from:0.88,to:1.18}, duration:1000, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
    const exitBubble = this.add.circle(bx, by, 26, 0x2a1a06, 0.92).setStrokeStyle(2.5, 0xffcc55, 1).setDepth(29);
    const exitIcon = this.add.text(bx, by, '🚪', { fontSize:'20px' }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets:[exitGlow, exitBubble, exitIcon], y:'-=7', duration:1100, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
    this.exitPrompt = this.add.text(bx, by - 55, 'E  EXIT', { fontFamily:'monospace', fontSize:'13px', fontStyle:'bold', color:'#ffe4a3', stroke:'#20150d', strokeThickness:4, padding:{x:6,y:3}, backgroundColor:'#4d311d' }).setOrigin(0.5).setDepth(30).setVisible(false);

    // ── Quest bubble — evil path only ─────────────────────────────────────
    if (isQuestAvailable('rarePlant')) {
      this._createQuestBubble();
    }

    this.questPrompt = this.add.text(
      QUEST_BUBBLE.x, QUEST_BUBBLE.y - 58,
      rarePlantQuestState.completed ? '✓ Rare Plant Found' : 'E  START QUEST',
      { fontFamily:'monospace', fontSize:'11px', fontStyle:'bold', color: rarePlantQuestState.completed ? '#4ade80' : '#ffe4a3', stroke:'#20150d', strokeThickness:4, padding:{x:6,y:3}, backgroundColor: rarePlantQuestState.completed ? '#0a2a0a' : '#1a2a0a' }
    ).setOrigin(0.5).setDepth(32).setVisible(false);

    // ── Wizard ────────────────────────────────────────────────────────────
    this.wizard = new Wizard(this, spawnX, spawnY);
    const spr = this.wizard.getSprite();
    spr.setDepth(spawnY + 10);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh); body.setOffset(Math.round((spr.width-fw)/2), spr.height-fh);
    }
    this.physics.add.collider(spr, this.staticGroup);
    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    // ── Camera ────────────────────────────────────────────────────────────
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w:number, h:number) => cam.setZoom(Math.min(w/1440, h/810) * 1.1);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz:{width:number;height:number}) => setZoom(sz.width, sz.height));
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    eventBus.emit('SCENE_READY', { scene: 'BotanicalClassroomScene' as any });

    if (data?.fromQuest) {
      this._startConversation();
    }
  }

  private _startConversation() {
    this.isTransitioning = true;
    this.controller.setBlocked(true);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    
    // Dark background
    const bg = this.add.rectangle(cx, cy, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.95)
      .setDepth(2000)
      .setScrollFactor(0)
      .setInteractive();

    const pages = ['conv_a1', 'conv_a2', 'conv_a3', 'conv_a4'];
    let pageIndex = 0;

    const img = this.add.image(cx, cy, pages[pageIndex])
      .setDepth(2001)
      .setScrollFactor(0);
      
    const setImgScale = () => {
      if (!img.active) return;
      const sw = this.scale.width;
      const sh = this.scale.height;
      bg.setPosition(sw / 2, sh / 2);
      bg.setSize(sw * 2, sh * 2);
      img.setPosition(sw / 2, sh / 2);
      const scale = Math.min((sw * 0.8) / Math.max(1, img.width), (sh * 0.8) / Math.max(1, img.height));
      img.setScale(scale);
    };
    
    // Add a slight delay to ensure texture dimensions are loaded
    this.time.delayedCall(50, setImgScale);
    this.scale.on('resize', setImgScale);

    const advancePage = () => {
      pageIndex++;
      if (pageIndex < pages.length) {
        img.setTexture(pages[pageIndex]);
        this.time.delayedCall(50, setImgScale);
      } else {
        bg.destroy();
        img.destroy();
        this.scale.off('resize', setImgScale);
        this.isTransitioning = false;
        this.controller.setBlocked(false);
      }
    };

    bg.on('pointerdown', advancePage);
    img.setInteractive().on('pointerdown', advancePage);
  }

  private _createQuestBubble() {
    const cx = QUEST_BUBBLE.x, cy = QUEST_BUBBLE.y;
    const color = rarePlantQuestState.completed ? 0x22cc44 : 0x22cc88;
    const stroke = rarePlantQuestState.completed ? 0x4ade80 : 0x88ffbb;

    this.questBubbleGlow = this.add.circle(cx, cy, 40, color, 0.15).setDepth(28);
    this.tweens.add({ targets: this.questBubbleGlow, fillAlpha:{from:0.08,to:0.38}, scaleX:{from:0.85,to:1.2}, scaleY:{from:0.85,to:1.2}, duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });

    this.questBubbleCircle = this.add.circle(cx, cy, 28, 0x0a1a0a, 0.92).setStrokeStyle(2.5, stroke, 1).setDepth(29);

    const icon = rarePlantQuestState.completed ? '✓' : '🌿';
    this.questBubbleIcon = this.add.text(cx, cy, icon, { fontSize:'22px', color: rarePlantQuestState.completed ? '#4ade80' : '#88ffbb' }).setOrigin(0.5).setDepth(30);

    this.tweens.add({ targets:[this.questBubbleGlow, this.questBubbleCircle, this.questBubbleIcon], y:'-=8', duration:1200, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning || !this.wizard || !this.controller) return;
    this.controller.update(delta);
    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);

    // ── Exit zone ─────────────────────────────────────────────────────────
    const wasNearExit = this.nearExit;
    const dx = Math.abs(spr.x - EXIT_DOOR.x), dy = Math.abs(spr.y - EXIT_DOOR.y);
    this.nearExit = dx <= EXIT_DOOR.halfW && dy <= EXIT_DOOR.approachMaxY;
    if (this.nearExit !== wasNearExit) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: this.nearExit, target: 'botanicalClassroom' });
      this.exitPrompt?.setVisible(this.nearExit);
    }

    // ── Quest zone — evil path only ───────────────────────────────────────
    if (isQuestAvailable('rarePlant')) {
      const wasNearQuest = this.nearQuest;
      const qDist = Phaser.Math.Distance.Between(spr.x, spr.y, QUEST_BUBBLE.x, QUEST_BUBBLE.y);
      this.nearQuest = qDist < QUEST_BUBBLE.radius;
      if (this.nearQuest !== wasNearQuest) {
        this.questPrompt?.setVisible(this.nearQuest);
      }
    } else {
      this.nearQuest = false;
    }
  }

  private _handleInteract() {
    if (this.isTransitioning) return;

    // Quest takes priority if near quest bubble — evil path only
    // Transition directly into T9 (RarePlantQuestScene)
    if (this.nearQuest && !rarePlantQuestState.completed && isQuestAvailable('rarePlant')) {
      this.isTransitioning = true;
      eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
      this.controller.setBlocked(true);
      this.cameras.main.fadeOut(700, 0, 18, 4);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('RarePlantQuestScene');
      });
      return;
    }

    // Exit
    if (this.nearExit) {
      eventBus.emit('PLAYER_NEAR_DOOR', { near: false });
      eventBus.emit('EXIT_BUILDING', { buildingId: 'botanicalClassroom' });
      this.isTransitioning = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('OutdoorWorldScene', {
          returnX: 110*20 + 30*20 + (4*20)/2,
          returnY: 50*20  + 28*20 + (4*20)/2 + 80,
        });
      });
    }
  }

  private _createColliders() {
    const T = 32;
    this._block(WORLD_W/2, T/2,            WORLD_W, T);
    this._block(WORLD_W/2, WORLD_H-T/2,    WORLD_W, T);
    this._block(T/2,       WORLD_H/2,      T, WORLD_H);
    this._block(WORLD_W-T/2, WORLD_H/2,    T, WORLD_H);
    this._block(80,  100, 130, 80);
    this._block(410, 100, 130, 80);
    this._block(500, 185, 140, 250);
    this._block(750, 185, 340, 250);
    this._block(995, 185, 130, 250);
    this._block(1145, 185, 170, 250);
    this._block(1350, 310, 240, 500);
    this._block(60,   600, 90,  380);
    this._block(310,  370, 280, 130);
    this._block(310,  530, 280, 130);
    this._block(1020, 370, 280, 130);
    this._block(1020, 530, 280, 130);
    this._block(WORLD_W/2, 770, 800, 70);
    this._block(90,  760, 110, 80);
    this._block(1380, 740, 180, 90);
  }

  private _block(cx:number, cy:number, w:number, h:number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }
}
