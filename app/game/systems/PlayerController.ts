// ============================================================
// PlayerController — WASD + Arrow keys, smooth acceleration,
// 8-direction normalized movement, dash on Shift.
// ============================================================
import Phaser from 'phaser';
import { Wizard, type WizardDirection } from '../entities/Wizard';

interface Keys {
  up:       Phaser.Input.Keyboard.Key;
  down:     Phaser.Input.Keyboard.Key;
  left:     Phaser.Input.Keyboard.Key;
  right:    Phaser.Input.Keyboard.Key;
  up2:      Phaser.Input.Keyboard.Key;
  down2:    Phaser.Input.Keyboard.Key;
  left2:    Phaser.Input.Keyboard.Key;
  right2:   Phaser.Input.Keyboard.Key;
  dash:     Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
}

// Direction hysteresis: how much stronger one axis must be to switch
const DIR_HYSTERESIS = 1.3;

// Movement speeds (px/s)
const WALK_SPEED  = 180;
const DASH_SPEED  = 400;

// How fast velocity lerps toward target (0–1, higher = snappier)
// 0.22 gives a subtle "ease-in" feel without noticeable lag
const ACCEL_LERP  = 0.22;
const DECEL_LERP  = 0.28;  // slightly faster stop than start

export class PlayerController {
  private scene:         Phaser.Scene;
  private sprite:        Phaser.Physics.Arcade.Sprite;
  private wizard:        Wizard;
  private keys:          Keys;
  private blocked        = false;
  private direction:     WizardDirection = 'down';
  private isMoving       = false;
  private isDashingState = false;
  private footstepTimer  = 0;
  private onInteract?:   () => void;

  // Current smoothed velocity (for lerp)
  private velX = 0;
  private velY = 0;

  constructor(scene: Phaser.Scene, wizard: Wizard, onInteract?: () => void) {
    this.scene      = scene;
    this.wizard     = wizard;
    this.sprite     = wizard.getSprite();
    this.onInteract = onInteract;

    const kb = scene.input.keyboard!;
    this.keys = {
      up:       kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up2:      kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down2:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left2:    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right2:   kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      dash:     kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      interact: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    this.keys.interact.on('down', () => {
      if (!this.blocked && this.onInteract) this.onInteract();
    });
  }

  setBlocked(blocked: boolean) {
    this.blocked = blocked;
    if (blocked) {
      this.velX = 0;
      this.velY = 0;
      this.sprite.setVelocity(0, 0);
      this.wizard.updateAnimation(this.direction, false);
      this.wizard.updateShadow();
    }
  }

  getDirection(): WizardDirection { return this.direction; }
  isWalking():    boolean          { return this.isMoving; }
  isDashing():    boolean          { return this.isDashingState; }

  update(delta: number) {
    if (this.blocked) return;

    const upHeld    = this.keys.up.isDown    || this.keys.up2.isDown;
    const downHeld  = this.keys.down.isDown  || this.keys.down2.isDown;
    const leftHeld  = this.keys.left.isDown  || this.keys.left2.isDown;
    const rightHeld = this.keys.right.isDown || this.keys.right2.isDown;
    const dashHeld  = this.keys.dash.isDown;

    const anyKey = upHeld || downHeld || leftHeld || rightHeld;

    // Build target velocity vector
    const raw = new Phaser.Math.Vector2(0, 0);
    if (upHeld)    raw.y -= 1;
    if (downHeld)  raw.y += 1;
    if (leftHeld)  raw.x -= 1;
    if (rightHeld) raw.x += 1;

    const topSpeed = dashHeld ? DASH_SPEED : WALK_SPEED;
    if (raw.length() > 0) raw.normalize().scale(topSpeed);

    // Smooth lerp toward target velocity
    const alpha = anyKey ? ACCEL_LERP : DECEL_LERP;
    this.velX = Phaser.Math.Linear(this.velX, raw.x, alpha);
    this.velY = Phaser.Math.Linear(this.velY, raw.y, alpha);

    // Snap to zero when very slow and no key held (prevents endless micro-drift)
    if (!anyKey && Math.abs(this.velX) < 2 && Math.abs(this.velY) < 2) {
      this.velX = 0;
      this.velY = 0;
    }

    this.sprite.setVelocity(this.velX, this.velY);

    const speed     = Math.sqrt(this.velX * this.velX + this.velY * this.velY);
    this.isMoving       = speed > 8;
    this.isDashingState = dashHeld && this.isMoving;

    if (this.isMoving) {
      // Direction logic with hysteresis
      const ax = Math.abs(this.velX);
      const ay = Math.abs(this.velY);
      const currentIsH = this.direction === 'left' || this.direction === 'right';

      if (currentIsH) {
        if (ay > ax * DIR_HYSTERESIS)      this.direction = this.velY > 0 ? 'down' : 'up';
        else if (ax > 0)                   this.direction = this.velX > 0 ? 'right' : 'left';
      } else {
        if (ax > ay * DIR_HYSTERESIS)      this.direction = this.velX > 0 ? 'right' : 'left';
        else if (ay > 0)                   this.direction = this.velY > 0 ? 'down' : 'up';
      }

      // Clean single-axis override
      if ((leftHeld || rightHeld) && !upHeld && !downHeld) {
        this.direction = rightHeld ? 'right' : 'left';
      } else if ((upHeld || downHeld) && !leftHeld && !rightHeld) {
        this.direction = downHeld ? 'down' : 'up';
      }

      // Footstep sound — faster when dashing
      const stepInterval = dashHeld ? 220 : 340;
      this.footstepTimer -= delta;
      if (this.footstepTimer <= 0) {
        this.footstepTimer = stepInterval;
        this._playFootstep(dashHeld);
      }
    } else {
      this.footstepTimer = 0;
    }

    this.wizard.updateAnimation(this.direction, this.isMoving);
    this.wizard.updateShadow();
  }

  private _playFootstep(heavy: boolean) {
    try {
      const ctx  = new AudioContext();
      const dur  = heavy ? 0.09 : 0.06;
      const buf  = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      const vol  = heavy ? 0.18 : 0.11;
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * vol;
      }
      const src    = ctx.createBufferSource();
      src.buffer   = buf;
      const filter = ctx.createBiquadFilter();
      filter.type            = 'bandpass';
      filter.frequency.value = heavy ? 120 : 180;
      filter.Q.value         = 1.2;
      src.connect(filter);
      filter.connect(ctx.destination);
      src.start();
      src.onended = () => ctx.close();
    } catch { /* audio unavailable */ }
  }
}
