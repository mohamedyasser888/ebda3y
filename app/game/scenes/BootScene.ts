// ============================================================
// BootScene — Preloads assets, generates wizard spritesheet,
//             registers all animations, then enters the world.
//
// WIZARD DESIGN: Yellow robes + pointed wizard hat + white beard
// Spritesheet layout: 8 columns x 8 rows  (8 walk frames each dir)
//   Row 0 - idle-down   (1 frame, mirrored across 8 cols)
//   Row 1 - walk-down   (8 frames)
//   Row 2 - idle-up
//   Row 3 - walk-up
//   Row 4 - idle-left
//   Row 5 - walk-left
//   Row 6 - idle-right
//   Row 7 - walk-right
//
// frameIndex = row * COLS + col
// ============================================================
import Phaser from 'phaser';

const FRAME_W = 64;
const FRAME_H = 80;
const COLS    = 8;   // 8 walk frames for ultra-smooth movement
const ROWS    = 8;

// Yellow Wizard Palette
const P = {
  YELLOW_BRIGHT : '#f5c518',
  YELLOW_MID    : '#d4a017',
  YELLOW_DARK   : '#a07810',
  YELLOW_SHADOW : '#7a5c0c',
  GOLD_LIGHT    : '#ffe066',
  GOLD_MID      : '#c9a227',
  GOLD_DARK     : '#8a6a00',
  HAT_BAND      : '#3d2800',
  SKIN_LIGHT    : '#f8d5a0',
  SKIN_MID      : '#f4c58a',
  SKIN_DARK     : '#d4995e',
  BEARD_LIGHT   : '#e8e8e8',
  BEARD_MID     : '#cccccc',
  BEARD_DARK    : '#aaaaaa',
  EYE_DARK      : '#1a0533',
  EYE_SHINE     : '#ffffff',
  BOOT_DARK     : '#4a2800',
  BOOT_MID      : '#6b3a10',
  BOOT_LIGHT    : '#8b5030',
  STAFF_WOOD    : '#7a4e1a',
  STAFF_ORB     : '#ffe866',
  STAFF_GLOW    : '#fff5a0',
};

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    const { width, height } = this.cameras.main;

    this.add.rectangle(width / 2, height / 2, width, height, 0x060010);
    this.add.text(width / 2, height / 2 - 110, '🏰', { fontSize: '64px' }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 42, 'What If',
      { fontFamily: '"Cinzel", Georgia, serif', fontSize: '42px', color: '#f0e0b0', fontStyle: 'bold' }
    ).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 6, 'Adventure Awaits You',
      { fontFamily: '"Cinzel", Georgia, serif', fontSize: '14px', color: '#9b7ed4' }
    ).setOrigin(0.5);

    const barBg = this.add.rectangle(width / 2, height / 2 + 56, 420, 6, 0x1a0a3a);
    barBg.setStrokeStyle(1, 0x4a2a7a);
    const bar = this.add.rectangle(width / 2 - 209, height / 2 + 56, 0, 4, 0xc8a020);
    bar.setOrigin(0, 0.5);
    const sub = this.add.text(width / 2, height / 2 + 78, 'Loading...',
      { fontFamily: 'Georgia, serif', fontSize: '11px', color: '#5a4a6e' }
    ).setOrigin(0.5);

    this.load.on('progress',     (v: number)          => { bar.width = 418 * v; });
    this.load.on('fileprogress', (f: { key: string }) => { sub.setText(`Loading ${f.key}...`); });
    this.load.on('complete',     ()                    => { sub.setText(''); });

    this.load.image('common-room-bg', '/assets/backgrounds/common-room.png');
    this.load.image('potion-lab-bg',  '/assets/backgrounds/potion-lab.png');
    this.load.image('wizard-raw', '/assets/sprites/wizard.png');
  }

  create() {
    this._generateWizardSpritesheet();
    this._registerAnimations();

    let pathAlreadyChosen = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useGameStore } = require('../../stores/gameStore') as typeof import('../../stores/gameStore');
      pathAlreadyChosen = useGameStore.getState().playerPath !== null;
    } catch { /* ignore */ }

    if (pathAlreadyChosen) {
      this.scene.start('OutdoorWorldScene');
    } else {
      const { eventBus } = require('../EventBus') as typeof import('../EventBus');
      eventBus.emit('SHOW_PATH_SELECTION');
      const off = eventBus.on('PATH_SELECTED', () => {
        off();
        this.scene.start('OutdoorWorldScene');
      });
    }
  }

  // Build 8-col x 8-row spritesheet procedurally
  private _generateWizardSpritesheet() {
    const canvas  = document.createElement('canvas');
    canvas.width  = FRAME_W * COLS;
    canvas.height = FRAME_H * ROWS;
    const ctx     = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const rowDefs: { row: number; dir: 'down'|'up'|'left'|'right'; walk: boolean }[] = [
      { row: 0, dir: 'down',  walk: false },
      { row: 1, dir: 'down',  walk: true  },
      { row: 2, dir: 'up',    walk: false },
      { row: 3, dir: 'up',    walk: true  },
      { row: 4, dir: 'left',  walk: false },
      { row: 5, dir: 'left',  walk: true  },
      { row: 6, dir: 'right', walk: false },
      { row: 7, dir: 'right', walk: true  },
    ];

    for (const { row, dir, walk } of rowDefs) {
      for (let col = 0; col < COLS; col++) {
        this._drawFrame(ctx, col * FRAME_W, row * FRAME_H, dir, col, walk);
      }
    }

    if (this.textures.exists('wizard')) this.textures.remove('wizard');
    this.textures.addCanvas('wizard', canvas);

    const texture = this.textures.get('wizard');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        texture.add(r * COLS + c, 0, c * FRAME_W, r * FRAME_H, FRAME_W, FRAME_H);
      }
    }
  }

  private _drawFrame(
    ctx:   CanvasRenderingContext2D,
    ox:    number,
    oy:    number,
    dir:   'down' | 'up' | 'left' | 'right',
    phase: number,
    isWalk: boolean
  ) {
    ctx.clearRect(ox, oy, FRAME_W, FRAME_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, FRAME_W, FRAME_H);
    ctx.clip();

    const cx    = ox + FRAME_W / 2;
    const floor = oy + FRAME_H - 3;

    // 8-frame smooth walk physics
    const t      = isWalk ? (phase / COLS) * Math.PI * 2 : 0;
    const bob    = isWalk ? Math.abs(Math.sin(t)) * 2.5 : 0;
    const lean   = isWalk ? Math.sin(t) * 0.038 : 0;
    const shiftX = isWalk ? Math.sin(t) * 1.2 : 0;

    const isSide = dir === 'left' || dir === 'right';
    const flipX  = dir === 'left';
    const bx     = cx + shiftX;

    // Draw legs first (behind body)
    this._drawLegs(ctx, dir, phase, isWalk, bx, floor - bob, lean);

    // Draw body with lean
    ctx.save();
    ctx.translate(bx, floor - bob);
    if (lean !== 0) ctx.rotate(lean);
    this._drawRobe(ctx, isSide, isWalk, phase);
    this._drawArms(ctx, isSide, flipX, isWalk, phase, dir);
    this._drawHead(ctx, dir, isSide, flipX);
    this._drawHat(ctx, dir, isSide, isWalk, phase);
    ctx.restore();

    ctx.restore();
  }

  private _drawLegs(
    ctx: CanvasRenderingContext2D,
    dir: string,
    phase: number,
    isWalk: boolean,
    bx: number,
    by: number,
    lean: number
  ) {
    const LEG_H  = 14;
    const BOOT_H = 7;
    const LEG_W  = 7;

    ctx.save();
    ctx.translate(bx, by);
    if (lean !== 0) ctx.rotate(lean);

    const t      = isWalk ? (phase / 8) * Math.PI * 2 : 0;
    const lSwing = isWalk ? Math.sin(t) * 5 : 0;
    const rSwing = isWalk ? Math.sin(t + Math.PI) * 5 : 0;
    const lLift  = isWalk ? Math.max(0, -Math.sin(t)) * 5 : 0;
    const rLift  = isWalk ? Math.max(0, -Math.sin(t + Math.PI)) * 5 : 0;

    const drawBoot = (lx: number, ly: number, lift: number, bright: boolean) => {
      const topY = -LEG_H - BOOT_H - lift;
      // Robe-to-leg colour (match robe)
      ctx.fillStyle = bright ? P.YELLOW_DARK : P.YELLOW_SHADOW;
      ctx.fillRect(lx - LEG_W / 2, topY, LEG_W, LEG_H);
      // Boot
      ctx.fillStyle = bright ? P.BOOT_MID : P.BOOT_DARK;
      ctx.fillRect(lx - LEG_W / 2 - 1, topY + LEG_H, LEG_W + 2, BOOT_H);
      if (bright) {
        ctx.fillStyle = P.BOOT_LIGHT;
        ctx.fillRect(lx - LEG_W / 2 + 1, topY + LEG_H + 1, LEG_W, 2);
      }
      // Gold cuff
      ctx.fillStyle = P.GOLD_MID;
      ctx.fillRect(lx - LEG_W / 2 - 1, topY, LEG_W + 2, 3);
    };

    if (dir === 'left' || dir === 'right') {
      const d = dir === 'right' ? 1 : -1;
      ctx.globalAlpha = 0.7;
      drawBoot(d * 4 + lSwing * d * 0.6, lSwing, lLift, false);
      ctx.globalAlpha = 1;
      drawBoot(-d * 3 + rSwing * d * 0.6, rSwing, rLift, true);
    } else {
      drawBoot(-7 + lSwing * 0.3, 0, lLift, true);
      drawBoot( 7 + rSwing * 0.3, 0, rLift, true);
    }

    ctx.restore();
  }

  private _drawRobe(
    ctx: CanvasRenderingContext2D,
    isSide: boolean,
    isWalk: boolean,
    phase: number
  ) {
    const robeTop  = -44;
    const robeBot  = -16;
    const topW     = isSide ? 15 : 20;
    const botW     = isSide ? 18 : 26;
    const sway     = isWalk ? Math.sin((phase / 8) * Math.PI * 2) * 1.5 : 0;

    // Shadow
    ctx.fillStyle = P.YELLOW_SHADOW;
    ctx.beginPath();
    ctx.moveTo(-botW / 2 + sway, robeBot);
    ctx.lineTo( botW / 2 + sway, robeBot);
    ctx.lineTo( topW / 2, robeTop + 4);
    ctx.lineTo(-topW / 2, robeTop + 4);
    ctx.closePath(); ctx.fill();

    // Main robe
    ctx.fillStyle = P.YELLOW_MID;
    ctx.beginPath();
    ctx.moveTo(-botW / 2 + sway + 1, robeBot);
    ctx.lineTo( botW / 2 + sway - 1, robeBot);
    ctx.lineTo( topW / 2 - 1, robeTop + 3);
    ctx.lineTo(-topW / 2 + 1, robeTop + 3);
    ctx.closePath(); ctx.fill();

    // Highlight centre stripe
    ctx.fillStyle = P.YELLOW_BRIGHT;
    ctx.beginPath();
    ctx.moveTo(-3 + sway * 0.3, robeBot);
    ctx.lineTo( 3 + sway * 0.3, robeBot);
    ctx.lineTo( 2, robeTop + 3);
    ctx.lineTo(-2, robeTop + 3);
    ctx.closePath(); ctx.fill();

    // Gold hem
    ctx.fillStyle = P.GOLD_MID;
    ctx.fillRect(-botW / 2 + sway, robeBot - 4, botW, 4);
    ctx.fillStyle = P.GOLD_LIGHT;
    ctx.fillRect(-botW / 2 + 1 + sway, robeBot - 3, botW - 2, 1);

    // Belt
    ctx.fillStyle = P.HAT_BAND;
    ctx.fillRect(-topW / 2 + 1, robeTop + 22, topW - 2, 5);
    ctx.fillStyle = P.GOLD_LIGHT;
    ctx.fillRect(-4, robeTop + 22, 8, 5);
    ctx.fillStyle = P.GOLD_DARK;
    ctx.fillRect(-2, robeTop + 23, 4, 3);
  }

  private _drawArms(
    ctx: CanvasRenderingContext2D,
    isSide: boolean,
    flipX: boolean,
    isWalk: boolean,
    phase: number,
    dir: string
  ) {
    const robeTop = -44;
    const armTopY = robeTop + 4;
    const ARM_W   = 7;
    const ARM_H   = 15;
    const t       = isWalk ? (phase / 8) * Math.PI * 2 : 0;
    const aSwing  = isWalk ? Math.sin(t) * 0.28 : 0;

    if (dir === 'up') {
      ctx.fillStyle = P.YELLOW_DARK;
      ctx.fillRect(-12, armTopY + 2, ARM_W, ARM_H);
      ctx.fillRect(  5, armTopY + 2, ARM_W, ARM_H);
      ctx.fillStyle = P.STAFF_WOOD;
      ctx.fillRect(10, robeTop - 20, 3, 40);
      ctx.fillStyle = P.STAFF_ORB;
      ctx.beginPath(); ctx.arc(11.5, robeTop - 22, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.STAFF_GLOW;
      ctx.beginPath(); ctx.arc(10,   robeTop - 24, 2, 0, Math.PI * 2); ctx.fill();
      return;
    }

    // Left arm
    ctx.save();
    ctx.translate(isSide ? -8 : -10, armTopY);
    ctx.rotate(flipX ? -0.2 - aSwing * 0.5 : 0.2 + aSwing * 0.5);
    ctx.fillStyle = P.YELLOW_MID;
    ctx.fillRect(-ARM_W / 2, 0, ARM_W, ARM_H);
    ctx.fillStyle = P.GOLD_MID;
    ctx.fillRect(-ARM_W / 2, ARM_H - 4, ARM_W, 4);
    // Hand
    ctx.fillStyle = P.SKIN_MID;
    ctx.beginPath(); ctx.arc(0, ARM_H + 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Right arm + staff
    ctx.save();
    ctx.translate(isSide ? 8 : 10, armTopY);
    ctx.rotate(flipX ? 0.2 - aSwing * 0.5 : -0.2 - aSwing * 0.5);
    ctx.fillStyle = P.YELLOW_MID;
    ctx.fillRect(-ARM_W / 2, 0, ARM_W, ARM_H);
    ctx.fillStyle = P.GOLD_MID;
    ctx.fillRect(-ARM_W / 2, ARM_H - 4, ARM_W, 4);
    // Hand
    ctx.fillStyle = P.SKIN_MID;
    ctx.beginPath(); ctx.arc(0, ARM_H + 2, 4, 0, Math.PI * 2); ctx.fill();
    // Staff
    ctx.fillStyle = P.STAFF_WOOD;
    ctx.fillRect(-1.5, -30, 3, 46);
    ctx.fillStyle = P.GOLD_MID;
    ctx.fillRect(-2.5, -18, 5, 2.5);
    ctx.fillRect(-2.5, -10, 5, 2.5);
    // Orb
    ctx.fillStyle = P.STAFF_ORB;
    ctx.beginPath(); ctx.arc(0, -34, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.STAFF_GLOW;
    ctx.beginPath(); ctx.arc(-2, -36, 2.5, 0, Math.PI * 2); ctx.fill();
    if (isWalk && phase % 2 === 0) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(3, -38, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private _drawHead(
    ctx: CanvasRenderingContext2D,
    dir: string,
    isSide: boolean,
    flipX: boolean
  ) {
    const headCY = -55;
    const headR  = isSide ? 9 : 11;
    const hox    = isSide ? (flipX ? -2 : 2) : 0;

    // Neck
    ctx.fillStyle = P.SKIN_MID;
    ctx.fillRect(-4, -49, 8, 7);

    // Head
    ctx.fillStyle = P.SKIN_MID;
    ctx.beginPath(); ctx.arc(hox, headCY, headR, 0, Math.PI * 2); ctx.fill();

    if (dir !== 'up') {
      // White beard
      ctx.fillStyle = P.BEARD_LIGHT;
      if (isSide) {
        const bx = flipX ? hox - headR + 2 : hox + headR - 2;
        ctx.beginPath(); ctx.ellipse(bx, headCY + 6, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.BEARD_MID;
        ctx.beginPath(); ctx.ellipse(bx + (flipX ? 2 : -2), headCY + 8, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.ellipse(0, headCY + 7, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.BEARD_MID;
        ctx.beginPath(); ctx.ellipse(-2, headCY + 10, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.BEARD_DARK;
        ctx.fillRect(-3, headCY + 4, 6, 2);
      }
    }

    if (dir === 'down') {
      ctx.fillStyle = P.EYE_DARK;
      ctx.beginPath(); ctx.arc(-4, headCY,     2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 4, headCY,     2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.EYE_SHINE;
      ctx.beginPath(); ctx.arc(-3, headCY - 1, 1,   0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 5, headCY - 1, 1,   0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.BEARD_DARK; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-7, headCY - 3); ctx.lineTo(-1, headCY - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo( 7, headCY - 3); ctx.lineTo( 1, headCY - 4); ctx.stroke();
      ctx.fillStyle = P.SKIN_DARK;
      ctx.beginPath(); ctx.arc(0, headCY + 3, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb3b3'; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(-7, headCY + 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 7, headCY + 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (dir === 'right' || dir === 'left') {
      const ex = flipX ? hox - 3 : hox + 3;
      ctx.fillStyle = P.EYE_DARK;
      ctx.beginPath(); ctx.arc(ex, headCY, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.EYE_SHINE;
      ctx.beginPath(); ctx.arc(ex + (flipX ? -1 : 1), headCY - 1, 1, 0, Math.PI * 2); ctx.fill();
      const nx = flipX ? hox - (headR - 1) : hox + (headR - 1);
      ctx.fillStyle = P.SKIN_DARK;
      ctx.beginPath(); ctx.arc(nx, headCY + 3, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.BEARD_DARK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex - 3, headCY - 3); ctx.lineTo(ex + 3, headCY - 4); ctx.stroke();
    } else {
      ctx.fillStyle = P.BEARD_MID;
      ctx.beginPath(); ctx.arc(0, headCY, headR, Math.PI, Math.PI * 2); ctx.fill();
    }
  }

  private _drawHat(
    ctx: CanvasRenderingContext2D,
    dir: string,
    isSide: boolean,
    isWalk: boolean,
    phase: number
  ) {
    const headCY = -55;
    const headR  = isSide ? 9 : 11;
    const brimY  = headCY - headR + 2;
    const brimW  = isSide ? 20 : 26;
    const brimH  = 5;
    const hatH   = isSide ? 28 : 34;
    const tiltX  = dir === 'right' ? 4 : dir === 'left' ? -4 : 0;
    const sway   = isWalk ? Math.sin((phase / 8) * Math.PI * 2) * 1.5 : 0;
    const tipX   = tiltX + sway;

    // Brim shadow
    ctx.fillStyle = P.YELLOW_SHADOW;
    ctx.beginPath(); ctx.ellipse(0, brimY, brimW / 2 + 1, brimH / 2 + 1, 0, 0, Math.PI * 2); ctx.fill();

    // Cone shadow side
    ctx.fillStyle = P.YELLOW_SHADOW;
    ctx.beginPath();
    ctx.moveTo(tipX + 2,       brimY - brimH - hatH);
    ctx.lineTo( brimW / 2 - 1, brimY - brimH + 2);
    ctx.lineTo( 0,              brimY - brimH + 2);
    ctx.closePath(); ctx.fill();

    // Main cone
    ctx.fillStyle = P.YELLOW_MID;
    ctx.beginPath();
    ctx.moveTo(tipX,            brimY - brimH - hatH);
    ctx.lineTo(-brimW / 2 + 2, brimY - brimH + 2);
    ctx.lineTo( brimW / 2 - 2, brimY - brimH + 2);
    ctx.closePath(); ctx.fill();

    // Cone highlight
    ctx.fillStyle = P.YELLOW_BRIGHT;
    ctx.beginPath();
    ctx.moveTo(tipX,     brimY - brimH - hatH);
    ctx.lineTo(tipX - 3, brimY - brimH + 2);
    ctx.lineTo(tipX + 1, brimY - brimH + 2);
    ctx.closePath(); ctx.fill();

    // Hat band
    const bandY = brimY - brimH - 5;
    ctx.fillStyle = P.HAT_BAND;
    ctx.fillRect(-brimW / 2 + 3, bandY, brimW - 6, 5);
    ctx.fillStyle = P.GOLD_LIGHT;
    ctx.fillRect(-4, bandY, 8, 5);
    ctx.fillStyle = P.GOLD_DARK;
    ctx.fillRect(-2, bandY + 1, 4, 3);

    // Gold star on cone
    this._drawStar(ctx, tipX * 0.35, brimY - brimH - hatH * 0.45, 4, P.GOLD_LIGHT);

    // Brim top
    ctx.fillStyle = P.YELLOW_MID;
    ctx.beginPath(); ctx.ellipse(0, brimY - brimH / 2, brimW / 2, brimH / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.YELLOW_BRIGHT;
    ctx.beginPath(); ctx.ellipse(0, brimY - brimH / 2 - 1, brimW / 2 - 2, brimH / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();

    // Brim front edge (drawn last)
    ctx.fillStyle = P.YELLOW_DARK;
    ctx.beginPath(); ctx.ellipse(0, brimY, brimW / 2, brimH / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.GOLD_MID;
    ctx.beginPath(); ctx.ellipse(0, brimY - 1, brimW / 2 - 1, brimH / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();

    // Sparkles at hat tip during walk
    if (isWalk && phase % 3 === 0) {
      const sy = brimY - brimH - hatH - 3;
      ctx.fillStyle = P.STAFF_GLOW; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(tipX,     sy,     2,   0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tipX + 4, sy - 2, 1,   0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tipX - 3, sy - 3, 1,   0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private _drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      else         ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
  }

  private _registerAnimations() {
    const dirs: { key: string; row: number }[] = [
      { key: 'down',  row: 0 },
      { key: 'up',    row: 2 },
      { key: 'left',  row: 4 },
      { key: 'right', row: 6 },
    ];

    for (const { key, row } of dirs) {
      const idleStart = row * COLS;
      const walkStart = (row + 1) * COLS;

      if (!this.anims.exists(`wizard-idle-${key}`)) {
        this.anims.create({
          key: `wizard-idle-${key}`,
          frames: [{ key: 'wizard', frame: idleStart }],
          frameRate: 1,
          repeat: -1,
        });
      }

      if (!this.anims.exists(`wizard-walk-${key}`)) {
        this.anims.create({
          key: `wizard-walk-${key}`,
          frames: this.anims.generateFrameNumbers('wizard', {
            frames: Array.from({ length: COLS }, (_, i) => walkStart + i),
          }),
          frameRate: 14,
          repeat: -1,
        });
      }
    }
  }
}
