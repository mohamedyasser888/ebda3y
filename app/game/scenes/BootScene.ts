// ============================================================
// BootScene — Preloads assets, generates wizard spritesheet,
//             registers all animations, then enters CommonRoom
// ============================================================
import Phaser from 'phaser';

// Each frame cell: 48×64 px
// Spritesheet layout: 4 columns × 8 rows
//   Row 0 – idle-down   (1 frame, cols 0–3 identical)
//   Row 1 – walk-down   (4 frames)
//   Row 2 – idle-up
//   Row 3 – walk-up
//   Row 4 – idle-left
//   Row 5 – walk-left
//   Row 6 – idle-right
//   Row 7 – walk-right
//
// We store them linearly: frameIndex = row*4 + col
const FRAME_W = 48;
const FRAME_H = 64;
const COLS    = 4;
const ROWS    = 8;

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  // ─────────────────────────────────────────────────────────
  preload() {
    const { width, height } = this.cameras.main;

    // Loading screen background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0114);

    const barBg = this.add.rectangle(width / 2, height / 2, 420, 22, 0x1a0533);
    barBg.setStrokeStyle(2, 0xc9a227);
    const bar = this.add.rectangle(width / 2 - 208, height / 2, 0, 18, 0xc9a227);
    bar.setOrigin(0, 0.5);

    this.add.text(width / 2, height / 2 - 54,
      '✦  Magical Potion Academy  ✦',
      { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#f0cd60' }
    ).setOrigin(0.5);

    const sub = this.add.text(width / 2, height / 2 + 44, '',
      { fontFamily: 'Georgia, serif', fontSize: '13px', color: '#c9a227' }
    ).setOrigin(0.5);

    this.load.on('progress',     (v: number)           => { bar.width = 416 * v; });
    this.load.on('fileprogress', (f: { key: string })  => { sub.setText(`Loading ${f.key}…`); });
    this.load.on('complete',     ()                     => { sub.destroy(); });

    // Room backgrounds
    this.load.image('common-room-bg', '/assets/backgrounds/common-room.png');
    this.load.image('potion-lab-bg',  '/assets/backgrounds/potion-lab.png');

    // We load the provided wizard.png as a fallback / landing-page image.
    // At runtime we will ALSO generate a full procedural spritesheet so the
    // game always has properly animated frames regardless of what the PNG
    // actually contains.
    this.load.image('wizard-raw', '/assets/sprites/wizard.png');
  }

  // ─────────────────────────────────────────────────────────
  create() {
    // Generate the full 48×64 × 4×8 spritesheet programmatically.
    this._generateWizardSpritesheet();

    // Register animations against the generated key 'wizard'
    this._registerAnimations();

    this.scene.start('OutdoorWorldScene');
  }

  // ─────────────────────────────────────────────────────────
  // Generate wizard spritesheet on a JS canvas, then load into
  // Phaser's texture manager as 'wizard'.
  // ─────────────────────────────────────────────────────────
  private _generateWizardSpritesheet() {
    const sheetW = FRAME_W * COLS;
    const sheetH = FRAME_H * ROWS;

    const canvas  = document.createElement('canvas');
    canvas.width  = sheetW;
    canvas.height = sheetH;
    const ctx     = canvas.getContext('2d')!;

    // Row definitions: [row, direction, isWalk]
    const rows: { row: number; dir: 'down'|'up'|'left'|'right'; walk: boolean }[] = [
      { row: 0, dir: 'down',  walk: false },
      { row: 1, dir: 'down',  walk: true  },
      { row: 2, dir: 'up',    walk: false },
      { row: 3, dir: 'up',    walk: true  },
      { row: 4, dir: 'left',  walk: false },
      { row: 5, dir: 'left',  walk: true  },
      { row: 6, dir: 'right', walk: false },
      { row: 7, dir: 'right', walk: true  },
    ];

    for (const { row, dir, walk } of rows) {
      for (let col = 0; col < COLS; col++) {
        const x = col * FRAME_W;
        const y = row * FRAME_H;
        const legPhase = walk ? col : 0; // 0..3 walk cycle phase
        this._drawWizardFrame(ctx, x, y, dir, legPhase, walk);
      }
    }

    // Add the canvas texture to Phaser, then set frame data
    if (this.textures.exists('wizard')) {
      this.textures.remove('wizard');
    }
    this.textures.addCanvas('wizard', canvas);

    const texture = this.textures.get('wizard');
    // Clear auto-generated frames and add manual grid frames
    // Frame 0 = row 0 col 0, frame 1 = row 0 col 1, …
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        texture.add(
          idx,
          0,              // source index
          c * FRAME_W,
          r * FRAME_H,
          FRAME_W,
          FRAME_H
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  private _drawWizardFrame(
    ctx:      CanvasRenderingContext2D,
    ox:       number,
    oy:       number,
    dir:      'down' | 'up' | 'left' | 'right',
    legPhase: number,   // 0-3 walk cycle frame
    isWalk:   boolean
  ) {
    // Clear frame
    ctx.clearRect(ox, oy, FRAME_W, FRAME_H);

    // Helper — draw a rounded rect
    const roundRect = (
      x: number, y: number, w: number, h: number,
      r: number, color: string, alpha = 1
    ) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    // Centre anchor (feet at bottom-centre of cell)
    const cx    = ox + FRAME_W / 2;       // = ox + 24
    const floor = oy + FRAME_H - 2;       // = oy + 62

    // Walk bob & lean
    const bob   = isWalk ? Math.sin(legPhase * Math.PI * 0.5) * 1.5 : 0;
    const lean  = isWalk ? (legPhase % 2 === 0 ? 0.04 : -0.04) : 0;

    ctx.save();
    ctx.translate(cx, floor);
    if (lean !== 0) {
      ctx.transform(1, 0, lean, 1, 0, 0);
    }
    ctx.translate(0, -bob);

    // ── Leg positions (relative to cx, floor) ──
    // legs measured from bottom of body
    const bodyBottom = -8;   // boots top relative to floor
    const legW = 8;
    const legH = 14;

    // Walk cycle: alternating leg positions
    const legSwing = isWalk ? Math.sin(legPhase * Math.PI * 0.5) * 5 : 0;

    if (dir !== 'up') {
      // Left boot
      const lx = -7;
      const lLegY = bodyBottom - legH + (isWalk && legPhase % 2 === 0 ? -3 : 0);
      roundRect(lx - legW / 2, lLegY, legW, legH, 3, '#6b3a1f');
      // Boot shine
      ctx.fillStyle = '#8b4a1f';
      ctx.fillRect(lx - legW / 2 + 1, lLegY + legH - 5, legW - 2, 3);

      // Right boot
      const rx = 7;
      const rLegY = bodyBottom - legH + (isWalk && legPhase % 2 !== 0 ? -3 : 0);
      roundRect(rx - legW / 2, rLegY, legW, legH, 3, '#6b3a1f');
      ctx.fillStyle = '#8b4a1f';
      ctx.fillRect(rx - legW / 2 + 1, rLegY + legH - 5, legW - 2, 3);
    }

    // ── Robe body ──
    const robeTop    = bodyBottom - 32;
    const robeBottomW = 28;
    const robeTopW    = 20;

    // Robe shadow (depth)
    ctx.fillStyle = '#2e0f5e';
    ctx.beginPath();
    ctx.moveTo(-robeBottomW / 2 + 2, bodyBottom);
    ctx.lineTo(robeBottomW / 2 - 2, bodyBottom);
    ctx.lineTo(robeTopW / 2, robeTop + 6);
    ctx.lineTo(-robeTopW / 2, robeTop + 6);
    ctx.closePath();
    ctx.fill();

    // Main robe
    ctx.fillStyle = '#5a1f9a';
    ctx.beginPath();
    ctx.moveTo(-robeBottomW / 2, bodyBottom);
    ctx.lineTo(robeBottomW / 2, bodyBottom);
    ctx.lineTo(robeTopW / 2, robeTop + 4);
    ctx.lineTo(-robeTopW / 2, robeTop + 4);
    ctx.closePath();
    ctx.fill();

    // Robe highlight stripe
    ctx.fillStyle = '#7b3fc4';
    ctx.beginPath();
    ctx.moveTo(-4, bodyBottom);
    ctx.lineTo(4, bodyBottom);
    ctx.lineTo(2, robeTop + 4);
    ctx.lineTo(-2, robeTop + 4);
    ctx.closePath();
    ctx.fill();

    // Robe dark-blue trim at bottom
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-robeBottomW / 2, bodyBottom - 5, robeBottomW, 5);

    // Belt
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-robeTopW / 2 + 1, robeTop + 18, robeTopW - 2, 4);
    ctx.fillStyle = '#f0cd60';
    ctx.fillRect(-3, robeTop + 17, 6, 6);

    // ── Arms & Staff (show on sides / front) ──
    if (dir !== 'up') {
      // Left arm
      const armSwing = isWalk ? legSwing * 0.5 : 0;
      ctx.fillStyle = '#5a1f9a';
      ctx.save();
      ctx.translate(-robeTopW / 2 + 1, robeTop + 8);
      ctx.rotate(0.2 + armSwing * 0.05);
      roundRect(-4, 0, 8, 16, 3, '#5a1f9a');
      // Sleeve trim
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-4, 12, 8, 4);
      ctx.restore();

      // Right arm — holding staff
      ctx.save();
      ctx.translate(robeTopW / 2 - 1, robeTop + 8);
      ctx.rotate(-0.15 - armSwing * 0.05);
      roundRect(-4, 0, 8, 16, 3, '#5a1f9a');
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-4, 12, 8, 4);

      // Staff
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(-1, -24, 3, 40);
      // Staff crystal orb
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(0, -28, 6, 0, Math.PI * 2);
      ctx.fill();
      // Orb glow
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.arc(-2, -30, 2, 0, Math.PI * 2);
      ctx.fill();
      // Staff rings
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(-2, -20, 5, 2);
      ctx.fillRect(-2, -14, 5, 2);
      ctx.restore();
    } else {
      // Back view — just show robe back and staff tip
      ctx.fillStyle = '#5a1f9a';
      roundRect(-robeTopW / 2 - 3, robeTop + 6, 8, 15, 3, '#5a1f9a');
      roundRect(robeTopW / 2 - 5, robeTop + 6, 8, 15, 3, '#5a1f9a');
      // Staff visible behind wizard
      ctx.fillStyle = '#8b5e3c';
      ctx.fillRect(robeTopW / 2 + 4, robeTop - 26, 3, 42);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(robeTopW / 2 + 5, robeTop - 28, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Head (neck) ──
    const headY = robeTop - 4;
    ctx.fillStyle = '#f4c58a';
    ctx.fillRect(-5, headY - 6, 10, 10);  // neck

    // ── Head circle ──
    const headR = 11;
    const headCY = headY - 6 - headR + 3;

    // Skin
    ctx.fillStyle = '#f4c58a';
    ctx.beginPath();
    ctx.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Face details (only for front-facing directions)
    if (dir === 'down') {
      // Eyes
      ctx.fillStyle = '#1a0533';
      ctx.beginPath(); ctx.arc(-4, headCY + 1, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4,  headCY + 1, 2.5, 0, Math.PI * 2); ctx.fill();
      // Eye shine
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-3, headCY, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5,  headCY, 1, 0, Math.PI * 2); ctx.fill();
      // Smile
      ctx.strokeStyle = '#8b4513';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, headCY + 4, 4, 0.1, Math.PI - 0.1);
      ctx.stroke();
      // Eyebrows
      ctx.strokeStyle = '#3d1a00';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-6, headCY - 3); ctx.lineTo(-2, headCY - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6,  headCY - 3); ctx.lineTo(2,  headCY - 4); ctx.stroke();
      // Rosy cheeks
      ctx.fillStyle = '#ffb3b3';
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(-6, headCY + 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6,  headCY + 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (dir === 'right') {
      // Side profile eye
      ctx.fillStyle = '#1a0533';
      ctx.beginPath(); ctx.arc(3, headCY + 1, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(4, headCY, 1, 0, Math.PI * 2); ctx.fill();
      // Nose bump
      ctx.fillStyle = '#e8a070';
      ctx.beginPath(); ctx.arc(headR - 2, headCY + 3, 2, 0, Math.PI * 2); ctx.fill();
    } else if (dir === 'left') {
      ctx.fillStyle = '#1a0533';
      ctx.beginPath(); ctx.arc(-3, headCY + 1, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-4, headCY, 1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a070';
      ctx.beginPath(); ctx.arc(-(headR - 2), headCY + 3, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      // back view — just show hair
      ctx.fillStyle = '#4a2c0a';
      ctx.beginPath();
      ctx.arc(0, headCY, headR, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // ── Wizard Hat ──
    const hatBaseY = headCY - headR + 4;
    const hatBrimW = 22;
    const hatBrimH = 5;

    // Hat brim
    ctx.fillStyle = '#1a0533';
    roundRect(-hatBrimW / 2, hatBaseY - hatBrimH, hatBrimW, hatBrimH + 2, 2, '#1a0533');
    // Brim highlight
    ctx.fillStyle = '#2d1070';
    ctx.fillRect(-hatBrimW / 2 + 1, hatBaseY - hatBrimH + 1, hatBrimW - 2, 2);

    // Hat cone
    ctx.fillStyle = '#1a0533';
    ctx.beginPath();
    const hatTipX  = (dir === 'left' ? -3 : dir === 'right' ? 3 : 0);
    ctx.moveTo(hatTipX, hatBaseY - 28);
    ctx.lineTo(-hatBrimW / 2 + 2, hatBaseY - hatBrimH + 1);
    ctx.lineTo(hatBrimW / 2 - 2, hatBaseY - hatBrimH + 1);
    ctx.closePath();
    ctx.fill();

    // Hat band
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-hatBrimW / 2 + 3, hatBaseY - hatBrimH - 5, hatBrimW - 6, 4);

    // Hat star
    this._drawStar(ctx, hatTipX * 0.4, hatBaseY - 20, 3, '#f0cd60');

    // ── Magic sparkle on staff tip (walk animation) ──
    if (isWalk && dir !== 'up' && legPhase % 2 === 0) {
      ctx.fillStyle = '#e9d5ff';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(robeTopW / 2 + 3, robeTop - 28, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private _drawStar(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number, color: string
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ─────────────────────────────────────────────────────────
  private _registerAnimations() {
    const dirs: { key: string; row: number }[] = [
      { key: 'down',  row: 0 },
      { key: 'up',    row: 2 },
      { key: 'left',  row: 4 },
      { key: 'right', row: 6 },
    ];

    for (const { key, row } of dirs) {
      const idleRow  = row;
      const walkRow  = row + 1;
      const idleStart = idleRow * COLS;
      const walkStart = walkRow * COLS;

      // Idle — single frame
      if (!this.anims.exists(`wizard-idle-${key}`)) {
        this.anims.create({
          key: `wizard-idle-${key}`,
          frames: [{ key: 'wizard', frame: idleStart }],
          frameRate: 1,
          repeat: -1,
        });
      }

      // Walk — 4-frame cycle
      if (!this.anims.exists(`wizard-walk-${key}`)) {
        this.anims.create({
          key: `wizard-walk-${key}`,
          frames: this.anims.generateFrameNumbers('wizard', {
            frames: [walkStart, walkStart + 1, walkStart + 2, walkStart + 3],
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }
}
