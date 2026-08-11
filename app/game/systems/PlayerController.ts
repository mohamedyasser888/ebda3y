// ============================================================
// PlayerController — WASD + Arrow keys, 8-direction normalized
// ============================================================
import Phaser from 'phaser';
import { Wizard, type WizardDirection } from '../entities/Wizard';

interface Keys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  up2: Phaser.Input.Keyboard.Key;
  down2: Phaser.Input.Keyboard.Key;
  left2: Phaser.Input.Keyboard.Key;
  right2: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
}

export class PlayerController {
  private scene: Phaser.Scene;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private wizard: Wizard;
  private keys: Keys;
  private speed: number = 180;
  private dashSpeed: number = 420;
  private blocked: boolean = false;
  private direction: WizardDirection = 'down';
  private isMoving: boolean = false;
  private isDashingState: boolean = false;
  private footstepTimer: number = 0;
  private onInteract?: () => void;

  constructor(
    scene: Phaser.Scene,
    wizard: Wizard,
    onInteract?: () => void
  ) {
    this.scene = scene;
    this.wizard = wizard;
    this.sprite = wizard.getSprite();
    this.onInteract = onInteract;

    const keyboard = scene.input.keyboard!;
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      interact: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    this.keys.interact.on('down', () => {
      if (!this.blocked && this.onInteract) {
        this.onInteract();
      }
    });
  }

  setBlocked(blocked: boolean) {
    this.blocked = blocked;
    if (blocked) {
      this.sprite.setVelocity(0, 0);
      this.wizard.updateAnimation(this.direction, false);
      this.wizard.updateShadow();
    }
  }

  getDirection(): WizardDirection { return this.direction; }
  isWalking(): boolean { return this.isMoving; }

  update(delta: number) {
    if (this.blocked) return;

    const upHeld = this.keys.up.isDown || this.keys.up2.isDown;
    const downHeld = this.keys.down.isDown || this.keys.down2.isDown;
    const leftHeld = this.keys.left.isDown || this.keys.left2.isDown;
    const rightHeld = this.keys.right.isDown || this.keys.right2.isDown;
    const dashHeld = this.keys.dash.isDown;

    const vel = new Phaser.Math.Vector2(0, 0);
    if (upHeld) vel.y -= 1;
    if (downHeld) vel.y += 1;
    if (leftHeld) vel.x -= 1;
    if (rightHeld) vel.x += 1;

    if (vel.x !== 0 || vel.y !== 0) {
      vel.normalize().scale(dashHeld ? this.dashSpeed : this.speed);
    }

    this.sprite.setVelocity(vel.x, vel.y);

    this.isMoving = vel.x !== 0 || vel.y !== 0;
    this.isDashingState = dashHeld && this.isMoving;

    if (this.isMoving) {
      // Determine primary direction based on velocity
      if (Math.abs(vel.x) > Math.abs(vel.y)) {
        this.direction = vel.x > 0 ? 'right' : 'left';
      } else {
        this.direction = vel.y > 0 ? 'down' : 'up';
      }

      this.footstepTimer -= delta;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 340;
        this.playFootstep();
      }
    } else {
      this.footstepTimer = 0;
    }

    // Update wizard animation based on direction and movement
    this.wizard.updateAnimation(this.direction, this.isMoving);
    // Keep shadow ellipse under the wizard's feet
    this.wizard.updateShadow();
  }

  isDashing() {
    return this.isDashingState;
  }

  private playFootstep() {
    try {
      const ctx = new AudioContext();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.12;
      }
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 180;
      filter.Q.value = 1.2;
      source.connect(filter);
      filter.connect(ctx.destination);
      source.start();
      source.onended = () => ctx.close();
    } catch { /* audio unavailable */ }
  }
}
