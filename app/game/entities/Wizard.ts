// ============================================================
// Wizard Entity — Physics sprite driven by PlayerController.
// Reads from the procedural 8-col spritesheet made by BootScene.
// Shadow ellipse keeps feet visually grounded at all times.
// ============================================================
import Phaser from 'phaser';

export type WizardDirection = 'down' | 'up' | 'left' | 'right';

// Frame dimensions match BootScene generator (64×80 per cell, 8×8)
const FRAME_W = 64;
const FRAME_H = 80;

// Scale: target display height in world pixels
const TARGET_H = 80;

export class Wizard {
  sprite:  Phaser.Physics.Arcade.Sprite;
  private shadow:        Phaser.GameObjects.Ellipse;
  private scene:         Phaser.Scene;
  private hasAnims       = false;
  private lastDirection: WizardDirection = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Shadow placed at wizard's feet, depth below sprite
    this.shadow = scene.add.ellipse(x, y, 30, 10, 0x000000, 0.25);
    this.shadow.setDepth(9);

    if (scene.textures.exists('wizard')) {
      this.sprite   = scene.physics.add.sprite(x, y, 'wizard');
      this.hasAnims = scene.anims.exists('wizard-walk-down');
      this.sprite.setScale(TARGET_H / FRAME_H);
    } else {
      this._generateFallbackTexture(scene);
      this.sprite = scene.physics.add.sprite(x, y, 'wizard-fallback');
      this.sprite.setScale(TARGET_H / 80);
      this.hasAnims = false;
    }

    // Bottom-centre origin → feet sit exactly at (x, y)
    this.sprite.setOrigin(0.5, 1.0);

    // Tight physics body at feet
    this._setPhysicsBody();

    this.sprite.setDepth(10);
    this.sprite.setCollideWorldBounds(true);

    if (this.hasAnims) this.sprite.play('wizard-idle-down', true);
  }

  // ── Public API ──────────────────────────────────────────

  getSprite(): Phaser.Physics.Arcade.Sprite { return this.sprite; }

  /** Must be called once per frame to keep shadow under feet */
  updateShadow() {
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 2);
    // Shadow scales slightly during walk for a more grounded look
    const isMoving = (this.sprite.body as Phaser.Physics.Arcade.Body)?.speed > 10;
    const scaleX = isMoving ? 1.15 : 1.0;
    this.scene.tweens.killTweensOf(this.shadow);
    this.shadow.setScale(scaleX, 1);
  }

  /** Called every frame from PlayerController */
  updateAnimation(direction: WizardDirection, isMoving: boolean) {
    this.lastDirection = direction;

    if (!this.hasAnims) {
      this.sprite.setFlipX(direction === 'left');
      return;
    }

    const key = isMoving ? `wizard-walk-${direction}` : `wizard-idle-${direction}`;
    if (this.sprite.anims.currentAnim?.key !== key) {
      this.sprite.play(key, true);
    }
  }

  celebrate() {
    const oy = this.sprite.y;
    this.scene.tweens.add({
      targets: this.sprite, y: oy - 20, duration: 130,
      ease: 'Power2', yoyo: true, repeat: 3,
      onComplete: () => this.sprite.setY(oy),
    });
    this.scene.tweens.add({
      targets: this.sprite, tint: { from: 0xffffff, to: 0xffd700 },
      duration: 90, yoyo: true, repeat: 5,
    });
  }

  shake() {
    const ox = this.sprite.x;
    this.scene.tweens.add({
      targets: this.sprite, x: ox + 9, duration: 40,
      ease: 'Linear', yoyo: true, repeat: 6,
      onComplete: () => this.sprite.setX(ox),
    });
    this.scene.tweens.add({
      targets: this.sprite, tint: { from: 0xffffff, to: 0xff4444 },
      duration: 60, yoyo: true, repeat: 4,
    });
  }

  // ── Private ──────────────────────────────────────────────

  private _setPhysicsBody() {
    const spr   = this.sprite;
    const scale = spr.scaleX;
    const bodyW = Math.round(FRAME_W * scale * 0.42);
    const bodyH = Math.round(FRAME_H * scale * 0.24);
    spr.setBodySize(bodyW / scale, bodyH / scale, false);
    spr.setOffset(
      (FRAME_W - bodyW / scale) / 2,
      FRAME_H - bodyH / scale,
    );
  }

  private _generateFallbackTexture(scene: Phaser.Scene) {
    if (scene.textures.exists('wizard-fallback')) return;
    const cv  = document.createElement('canvas');
    cv.width  = 64; cv.height = 80;
    const ctx = cv.getContext('2d')!;

    // Yellow robe fallback
    ctx.fillStyle = '#d4a017';
    ctx.beginPath(); ctx.moveTo(8,78); ctx.lineTo(56,78); ctx.lineTo(46,36); ctx.lineTo(18,36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(29, 36, 6, 42);
    // Belt
    ctx.fillStyle = '#3d2800';
    ctx.fillRect(18, 52, 28, 5);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(29, 51, 6, 7);
    // Head
    ctx.fillStyle = '#f4c58a';
    ctx.beginPath(); ctx.arc(32, 28, 12, 0, Math.PI * 2); ctx.fill();
    // Beard
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.ellipse(32, 36, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#1a0533';
    ctx.beginPath(); ctx.arc(28, 27, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(36, 27, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(29, 26, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(37, 26, 1, 0, Math.PI * 2); ctx.fill();
    // Hat
    ctx.fillStyle = '#d4a017';
    ctx.beginPath(); ctx.moveTo(32, 2); ctx.lineTo(15, 19); ctx.lineTo(49, 19); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a07810';
    ctx.fillRect(15, 19, 34, 5);
    ctx.fillStyle = '#3d2800';
    ctx.fillRect(16, 19, 32, 4);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(28, 19, 8, 4);
    // Staff
    ctx.fillStyle = '#7a4e1a';
    ctx.fillRect(51, 4, 3, 52);
    ctx.fillStyle = '#ffe866';
    ctx.beginPath(); ctx.arc(52, 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff5a0';
    ctx.beginPath(); ctx.arc(50, 0, 2.5, 0, Math.PI * 2); ctx.fill();

    scene.textures.addCanvas('wizard-fallback', cv);
  }
}
