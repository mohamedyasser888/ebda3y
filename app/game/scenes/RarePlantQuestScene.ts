// ============================================================
// RarePlantQuestScene — Hidden-Object Quest Room
// Entered from BotanicalClassroomScene via the quest bubble.
// Find the rare plant (p3) hidden among decoys and wrong objects.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { Wizard }            from '../entities/Wizard';
import { PlayerController }  from '../systems/PlayerController';
import { rarePlantQuestState } from './BotanicalClassroomScene';

const WORLD_W = 1680;
const WORLD_H = 960;

const DEFAULT_SPAWN_X = 840;
const DEFAULT_SPAWN_Y = 820;

// ── Plant & object hitbox radius ─────────────────────────
const INTERACT_RADIUS = 72;

interface Interactable {
  id:    string;
  x:     number;
  y:     number;
  kind:  'p1' | 'p2' | 'p3' | 'wrong';
  found: boolean;
  sprite?: Phaser.GameObjects.Image;
  glow?:   Phaser.GameObjects.Arc;
}

// ── Hidden locations (spread across room, naturally placed) ──────────────
// p1 — shelf area top-right, blending with bottles
// p2 — bottom-left corner near barrels, partially behind crates
// p3 — mid-right table area, tucked beside books
// wrong objects — scattered to mislead
const INTERACTABLES: Omit<Interactable, 'found' | 'sprite' | 'glow'>[] = [
  { id:'p1',     x:1310, y:240,  kind:'p1'    },  // top-right shelf, behind bottles
  { id:'p2',     x:210,  y:710,  kind:'p2'    },  // bottom-left near barrels
  { id:'p3',     x:1050, y:480,  kind:'p3'    },  // mid-right table beside books
  { id:'book1',  x:540,  y:290,  kind:'wrong' },  // top shelf area
  { id:'bottle1',x:890,  y:260,  kind:'wrong' },  // shelf centre-top
  { id:'jar1',   x:380,  y:480,  kind:'wrong' },  // left worktable
  { id:'box1',   x:1420, y:620,  kind:'wrong' },  // right corner
];

export class RarePlantQuestScene extends Phaser.Scene {
  private wizard!:      Wizard;
  private controller!:  PlayerController;
  private staticGroup!: Phaser.Physics.Arcade.StaticGroup;
  private isTransitioning = false;
  private discoveryDone   = false;

  private objects: Interactable[] = [];
  private nearObject: Interactable | null = null;

  private inspectPrompt?: Phaser.GameObjects.Text;
  private feedbackText?:  Phaser.GameObjects.Text;
  private feedbackTimer?: Phaser.Time.TimerEvent;
  private introText?:     Phaser.GameObjects.Container;

  constructor() { super({ key: 'RarePlantQuestScene' }); }

  preload() {
    this.load.image('questRoomBg',  '/assets/backgrounds/botanical-classroom-interior.jpg');
    this.load.image('questPlantP1', '/assets/quest/p1.jpg');
    this.load.image('questPlantP2', '/assets/quest/p2.jpg');
    this.load.image('questPlantP3', '/assets/quest/p3.jpg');
  }

  create() {
    this.isTransitioning = false;
    this.discoveryDone   = false;
    this.nearObject      = null;

    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Background — use botanical interior with magic tint overlay
    const bg = this.add.image(0, 0, 'questRoomBg').setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(WORLD_W, WORLD_H);

    // Subtle magical tint overlay
    this.add.rectangle(WORLD_W/2, WORLD_H/2, WORLD_W, WORLD_H, 0x001a0a, 0.22).setDepth(1);

    // Ambient floating particles
    this._spawnAmbientParticles();

    // Colliders
    this.staticGroup = this.physics.add.staticGroup();
    this._createColliders();

    // Place interactive objects
    this.objects = INTERACTABLES.map(def => ({ ...def, found: false }));
    this._placeObjects();

    // Inspect prompt (hidden until near object)
    this.inspectPrompt = this.add.text(WORLD_W/2, WORLD_H - 80, 'E  INSPECT', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ffe4a3', stroke: '#20150d', strokeThickness: 4,
      padding: { x: 8, y: 4 }, backgroundColor: '#2a1a00',
    }).setOrigin(0.5).setDepth(50).setVisible(false);

    // Feedback text (for wrong items)
    this.feedbackText = this.add.text(WORLD_W/2, WORLD_H/2 - 120, '', {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold',
      color: '#ff8888', stroke: '#1a0000', strokeThickness: 5,
      padding: { x: 14, y: 8 }, backgroundColor: '#2a0000',
    }).setOrigin(0.5).setDepth(60).setAlpha(0);

    // Wizard
    this.wizard = new Wizard(this, DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y);
    const spr = this.wizard.getSprite();
    spr.setDepth(DEFAULT_SPAWN_Y + 10);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (body) {
      const fw = Math.min(32, Math.max(16, Math.round(spr.width  * 0.5)));
      const fh = Math.min(32, Math.max(12, Math.round(spr.height * 0.26)));
      body.setSize(fw, fh); body.setOffset(Math.round((spr.width-fw)/2), spr.height-fh);
    }
    this.physics.add.collider(spr, this.staticGroup);
    this.controller = new PlayerController(this, this.wizard, () => this._handleInteract());

    // Camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(spr, true, 0.1, 0.1);
    const setZoom = (w:number, h:number) => cam.setZoom(Math.min(w/1440, h/810) * 1.05);
    setZoom(this.scale.width, this.scale.height);
    this.scale.on('resize', (sz:{width:number;height:number}) => setZoom(sz.width, sz.height));
    this.cameras.main.setRoundPixels(true);

    // Fade in with green tint
    this.cameras.main.fadeIn(800, 0, 20, 0);

    eventBus.emit('SCENE_READY', { scene: 'RarePlantQuestScene' as any });

    // Show intro message after fade
    this.time.delayedCall(900, () => this._showIntro());
  }

  // ── Place plant/object sprites hidden among room elements ────────────────
  private _placeObjects() {
    const wrongEmojis: Record<string, string> = {
      book1: '📚', bottle1: '🧪', jar1: '🫙', box1: '📦',
    };

    for (const obj of this.objects) {
      if (obj.kind === 'p1' || obj.kind === 'p2' || obj.kind === 'p3') {
        const key = obj.kind === 'p1' ? 'questPlantP1' : obj.kind === 'p2' ? 'questPlantP2' : 'questPlantP3';
        const img = this.add.image(obj.x, obj.y, key)
          .setDisplaySize(52, 52)
          .setAlpha(0.88)   // slightly blended — not glowing
          .setDepth(obj.y + 5);
        obj.sprite = img;

        // Very faint proximity glow — only visible up close
        const g = this.add.circle(obj.x, obj.y, 30, 0x44ff88, 0.0).setDepth(obj.y + 4);
        obj.glow = g;
      } else {
        // Wrong object — draw as emoji text (looks like room decor)
        this.add.text(obj.x, obj.y, wrongEmojis[obj.id] ?? '❓', {
          fontSize: '28px',
        }).setOrigin(0.5).setDepth(obj.y + 5).setAlpha(0.85);
      }
    }
  }

  update(_t: number, delta: number) {
    if (this.isTransitioning || this.discoveryDone || !this.wizard || !this.controller) return;
    this.controller.update(delta);
    const spr = this.wizard.getSprite();
    spr.setDepth(spr.y + 10);

    // Find nearest interactable
    let closest: Interactable | null = null;
    let closestDist = INTERACT_RADIUS + 1;
    for (const obj of this.objects) {
      if (obj.found && obj.kind !== 'p3') continue; // already resolved non-p3
      const d = Phaser.Math.Distance.Between(spr.x, spr.y, obj.x, obj.y);
      if (d < closestDist) { closestDist = d; closest = obj; }
    }

    if (closest !== this.nearObject) {
      this.nearObject = closest;
      this.inspectPrompt?.setVisible(!!closest);
      // Show subtle glow only on plants when nearby
      for (const obj of this.objects) {
        if (obj.glow) obj.glow.fillAlpha = 0;
      }
      if (closest?.glow) {
        this.tweens.add({ targets: closest.glow, fillAlpha: 0.22, duration: 300 });
      }
    }
  }

  // ── Interaction ──────────────────────────────────────────────────────────
  private _handleInteract() {
    if (!this.nearObject || this.isTransitioning || this.discoveryDone) return;
    const obj = this.nearObject;

    if (obj.kind === 'wrong') {
      this._showFeedback('Wrong item. Search again.');
      return;
    }
    if (obj.kind === 'p1' || obj.kind === 'p2') {
      this._showFeedback('Wrong plant. Search again.');
      obj.found = true;
      // Dim the wrong plant slightly
      obj.sprite?.setTint(0x888888);
      return;
    }
    if (obj.kind === 'p3') {
      this._startDiscovery(obj);
    }
  }

  // ── Feedback for wrong items ─────────────────────────────────────────────
  private _showFeedback(msg: string) {
    if (!this.feedbackText) return;
    this.feedbackText.setText(msg).setAlpha(1);
    if (this.feedbackTimer) this.feedbackTimer.remove();
    this.feedbackTimer = this.time.delayedCall(2200, () => {
      this.tweens.add({ targets: this.feedbackText!, alpha: 0, duration: 500 });
    });
  }

  // ── Intro message ────────────────────────────────────────────────────────
  private _showIntro() {
    const line1 = this.add.text(WORLD_W/2, WORLD_H/2 - 40, 'Something rare is hidden in this room...', {
      fontFamily: 'monospace', fontSize: '15px', color: '#e2ffd6',
      stroke: '#001a00', strokeThickness: 4, padding: { x: 14, y: 8 }, backgroundColor: '#0a2a0a',
    }).setOrigin(0.5).setDepth(80).setAlpha(0);
    const line2 = this.add.text(WORLD_W/2, WORLD_H/2 + 18, 'Find the rare plant.', {
      fontFamily: 'monospace', fontSize: '14px', color: '#88ffbb',
      stroke: '#001a00', strokeThickness: 4, padding: { x: 14, y: 8 }, backgroundColor: '#0a2a0a',
    }).setOrigin(0.5).setDepth(80).setAlpha(0);

    this.tweens.add({ targets: [line1, line2], alpha: 1, duration: 600, ease: 'Power2' });
    this.time.delayedCall(3200, () => {
      this.tweens.add({ targets: [line1, line2], alpha: 0, duration: 600, onComplete: () => { line1.destroy(); line2.destroy(); } });
    });
  }

  // ── p3 Discovery sequence ────────────────────────────────────────────────
  private _startDiscovery(obj: Interactable) {
    this.discoveryDone = true;
    this.inspectPrompt?.setVisible(false);
    this.controller.setBlocked(true);

    // Step 1-4: darken room
    const darkOverlay = this.add.rectangle(WORLD_W/2, WORLD_H/2, WORLD_W, WORLD_H, 0x000000, 0)
      .setDepth(90);
    this.tweens.add({ targets: darkOverlay, fillAlpha: 0.78, duration: 1400, ease: 'Power2' });

    // Step 5-8: p3 glows brightly
    const plantX = obj.x, plantY = obj.y;
    if (obj.sprite) {
      obj.sprite.setDepth(95);
      this.tweens.add({ targets: obj.sprite, alpha: 1, scaleX: 1.35, scaleY: 1.35, duration: 1200, ease: 'Power2' });
    }

    // Glow rings expanding
    for (let i = 0; i < 4; i++) {
      const ring = this.add.circle(plantX, plantY, 30 + i*18, 0x44ff88, 0).setDepth(93);
      this.tweens.add({ targets: ring, fillAlpha: { from:0.28, to:0 }, scaleX: { from:0.6, to:2.2 }, scaleY: { from:0.6, to:2.2 }, duration: 1600, delay: i*220, repeat: 3, ease: 'Power2' });
    }

    // Bright core glow
    const coreGlow = this.add.circle(plantX, plantY, 44, 0x88ffaa, 0.0).setDepth(94);
    this.tweens.add({ targets: coreGlow, fillAlpha: { from:0, to:0.55 }, scaleX:{from:0.5,to:1.6}, scaleY:{from:0.5,to:1.6}, duration: 900, yoyo:true, repeat:4, ease:'Sine.easeInOut' });

    // Step 9: sparkle particles
    this._spawnDiscoveryParticles(plantX, plantY);

    // Step 10-12: light rays
    this._spawnLightRays(plantX, plantY);

    // Camera zoom toward p3
    this.time.delayedCall(600, () => {
      this.cameras.main.pan(plantX, plantY, 1000, 'Power2');
      this.cameras.main.zoomTo(1.4, 1200, 'Power2');
    });

    // Step 13: discovery text
    this.time.delayedCall(2000, () => {
      const discoveryText = this.add.text(plantX, plantY - 120, 'You have found a rare plant!', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold',
        color: '#88ffbb', stroke: '#001a00', strokeThickness: 6,
        padding: { x: 18, y: 10 }, backgroundColor: '#0a2a12',
      }).setOrigin(0.5).setDepth(100).setAlpha(0);
      this.tweens.add({ targets: discoveryText, alpha: 1, y: plantY - 140, duration: 700, ease: 'Back.easeOut' });

      // Subtext
      const sub = this.add.text(plantX, plantY - 80, '✨ Quest Complete ✨', {
        fontFamily: 'monospace', fontSize: '13px', color: '#f0c040',
        stroke: '#1a0a00', strokeThickness: 4, padding: { x: 10, y: 6 }, backgroundColor: '#1a1000',
      }).setOrigin(0.5).setDepth(100).setAlpha(0);
      this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 400, ease: 'Power2' });
    });

    // Complete quest and return to Room 24
    this.time.delayedCall(5200, () => {
      rarePlantQuestState.completed = true;
      this.isTransitioning = true;
      this.cameras.main.fadeOut(800, 0, 20, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Return player near the quest bubble in BotanicalClassroomScene
        this.scene.start('BotanicalClassroomScene', {
          spawnX: 1000,
          spawnY: 620,
          fromQuest: true,
        });
      });
    });
  }

  // ── Discovery particles ─────────────────────────────────────────────────
  private _spawnDiscoveryParticles(cx: number, cy: number) {
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const dist  = 60 + Math.random() * 80;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      const p = this.add.circle(px, py, 3 + Math.random()*4, 0x88ffaa, 0.9).setDepth(96);
      this.tweens.add({
        targets: p,
        x: cx + Math.cos(angle) * (dist + 80 + Math.random()*60),
        y: cy + Math.sin(angle) * (dist + 80 + Math.random()*60),
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 1200 + Math.random()*800,
        delay: Math.random()*600,
        ease: 'Power2',
      });
    }
  }

  // ── Light rays ─────────────────────────────────────────────────────────
  private _spawnLightRays(cx: number, cy: number) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const ray = this.add.rectangle(
        cx + Math.cos(angle)*80, cy + Math.sin(angle)*80,
        6, 120, 0xaaffcc, 0.0
      ).setRotation(angle + Math.PI/2).setDepth(92);
      this.tweens.add({ targets: ray, fillAlpha: { from:0, to:0.35 }, scaleY:{from:0.4,to:1.5}, duration:900, yoyo:true, repeat:3, delay:i*80, ease:'Sine.easeInOut' });
    }
  }

  // ── Ambient particles (always on, subtle) ────────────────────────────────
  private _spawnAmbientParticles() {
    for (let i = 0; i < 16; i++) {
      const px = 100 + Math.random() * (WORLD_W - 200);
      const py = 100 + Math.random() * (WORLD_H - 200);
      const p = this.add.circle(px, py, 2, 0x44ff88, 0.45).setDepth(2);
      this.tweens.add({
        targets: p, y: py - 40 - Math.random()*40, alpha: 0,
        duration: 2500 + Math.random()*2000, delay: Math.random()*3000, repeat: -1,
        onRepeat: () => { p.setPosition(px, py); p.setAlpha(0.45); },
      });
    }
  }

  // ── Collision layout ────────────────────────────────────────────────────
  private _createColliders() {
    const T = 32;
    // Outer walls
    this._block(WORLD_W/2, T/2,          WORLD_W, T);
    this._block(WORLD_W/2, WORLD_H-T/2,  WORLD_W, T);
    this._block(T/2,       WORLD_H/2,    T, WORLD_H);
    this._block(WORLD_W-T/2, WORLD_H/2,  T, WORLD_H);
    // Top shelf wall (full width minus door openings)
    this._block(WORLD_W/2, 200, WORLD_W, 200);
    // Left worktables
    this._block(310,  480, 360, 140);
    this._block(310,  650, 360, 130);
    // Right worktables
    this._block(1370, 480, 360, 140);
    this._block(1370, 650, 360, 130);
    // Right greenhouse structure
    this._block(1560, 480, 200, 440);
    // Bottom decoration row (leaves/pots)
    this._block(WORLD_W/2, 880, WORLD_W-120, 80);
    // Bottom-left barrels
    this._block(90, 770, 130, 100);
  }

  private _block(cx:number, cy:number, w:number, h:number) {
    const rect = this.add.rectangle(cx, cy, w, h, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.staticGroup.add(rect);
  }
}
