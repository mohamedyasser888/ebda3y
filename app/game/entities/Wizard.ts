// ============================================================
// Wizard Entity — Physics sprite that walks (never flies).
// Uses the procedural spritesheet created by BootScene.
// Shadow ellipse keeps feet visually grounded at all times.
// ============================================================
import Phaser from 'phaser';

export type WizardDirection = 'down' | 'up' | 'left' | 'right';

// Frame dimensions match BootScene generator (48×64 per cell, 4×8 rows)
const FRAME_W = 48;
const FRAME_H = 64;

// Scale: target display height in world pixels
const TARGET_H = 80;

// Row layout (mirroring BootScene)
const _ROW: Record<WizardDirection, { idle: number; walk: number }> = {
  down:  { idle: 0, walk: 1 },
  up:    { idle: 2, walk: 3 },
  left:  { idle: 4, walk: 5 },
  right: { idle: 6, walk: 7 },
};
void _ROW; // referenced by type system only

export class Wizard {
  sprite:  Phaser.Physics.Arcade.Sprite;
  private shadow:        Phaser.GameObjects.Ellipse;
  private scene:         Phaser.Scene;
  private hasAnims       = false;
  private lastDirection: WizardDirection = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // ── Shadow (drawn BELOW sprite, depth 9) ──────────────
    // Placed at the wizard's feet and updated every frame
    this.shadow = scene.add.ellipse(x, y, 28, 10, 0x000000, 0.28);
    this.shadow.setDepth(9);

    // ── Sprite ────────────────────────────────────────────
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

    // Physics body at feet only
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
      targets: this.sprite, y: oy - 18, duration: 140,
      ease: 'Power2', yoyo: true, repeat: 2,
      onComplete: () => this.sprite.setY(oy),
    });
    this.scene.tweens.add({
      targets: this.sprite, tint: { from: 0xffffff, to: 0xffd700 },
      duration: 100, yoyo: true, repeat: 3,
    });
  }

  shake() {
    const ox = this.sprite.x;
    this.scene.tweens.add({
      targets: this.sprite, x: ox + 8, duration: 45,
      ease: 'Linear', yoyo: true, repeat: 5,
      onComplete: () => this.sprite.setX(ox),
    });
    this.scene.tweens.add({
      targets: this.sprite, tint: { from: 0xffffff, to: 0xff4444 },
      duration: 70, yoyo: true, repeat: 3,
    });
  }

  // ── Private ──────────────────────────────────────────────

  private _setPhysicsBody() {
    const spr   = this.sprite;
    const scale = spr.scaleX;
    const bodyW = Math.round(FRAME_W * scale * 0.44);
    const bodyH = Math.round(FRAME_H * scale * 0.26);
    spr.setBodySize(bodyW / scale, bodyH / scale, false);
    spr.setOffset(
      (FRAME_W - bodyW / scale) / 2,
      FRAME_H - bodyH / scale,
    );
  }

  private _generateFallbackTexture(scene: Phaser.Scene) {
    if (scene.textures.exists('wizard-fallback')) return;
    const cv  = document.createElement('canvas');
    cv.width  = 48; cv.height = 80;
    const ctx = cv.getContext('2d')!;

    ctx.fillStyle = '#6b3a1f'; ctx.fillRect(12,60,10,18); ctx.fillRect(26,60,10,18);
    ctx.fillStyle = '#5a1f9a';
    ctx.beginPath(); ctx.moveTo(6,78); ctx.lineTo(42,78); ctx.lineTo(36,34); ctx.lineTo(12,34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7b3fc4'; ctx.fillRect(21,34,6,44);
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(8,73,32,5);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(13,50,22,4);
    ctx.fillStyle = '#f0cd60'; ctx.fillRect(21,49,6,6);
    ctx.fillStyle = '#f4c58a';
    ctx.beginPath(); ctx.arc(24,28,12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a0533';
    ctx.beginPath(); ctx.arc(20,28,2.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(28,28,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(21,27,1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(29,27,1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#8b4513'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(24,31,4,0.1,Math.PI-0.1); ctx.stroke();
    ctx.fillStyle = '#1a0533'; ctx.fillRect(11,17,26,6);
    ctx.fillStyle = '#1a0533';
    ctx.beginPath(); ctx.moveTo(24,-2); ctx.lineTo(13,21); ctx.lineTo(35,21); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a227'; ctx.fillRect(13,17,22,4);
    ctx.fillStyle = '#8b5e3c'; ctx.fillRect(39,-4,3,44);
    ctx.fillStyle = '#c084fc';
    ctx.beginPath(); ctx.arc(40,-6,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e9d5ff';
    ctx.beginPath(); ctx.arc(38,-8,2,0,Math.PI*2); ctx.fill();

    scene.textures.addCanvas('wizard-fallback', cv);
  }
}
