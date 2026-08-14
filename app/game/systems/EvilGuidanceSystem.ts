// ============================================================
// EvilGuidanceSystem — Evil Path quest-completion driven
// navigation arrow.
//
// STATE MACHINE (advancement on QUEST COMPLETION only):
//   inactive
//   nav_f7          → arrow points to F7 (Dueling)
//   duel_active     → player inside duel (arrow hidden)
//   nav_building23  → DUEL_WON → arrow points to Building 23
//   plant_active    → player in plant quest (arrow stays on B23)
//   nav_h1          → CLOSE_QUEST { completed } → arrow → H1
//   book_active     → player in O9 (arrow stays on H1)
//   complete        → RESTRICTED_BOOK_FOUND → arrow disappears
//
// Arrow is rendered BELOW/IN FRONT of the player (not above).
// Only active when playerPath === 'evil'.
// ============================================================
import Phaser from 'phaser';
import { eventBus } from '../EventBus';
import { EVIL_GUIDANCE_TARGETS } from '../data/buildings';

type EvilQuestState =
  | 'inactive'
  | 'nav_f7'
  | 'duel_active'
  | 'nav_building23'
  | 'plant_active'
  | 'nav_library'
  | 'book_active'
  | 'nav_h1'
  | 'spell_active'
  | 'complete';

// Map each nav state to its target index in EVIL_GUIDANCE_TARGETS
const STATE_TARGET: Partial<Record<EvilQuestState, number>> = {
  nav_f7:         0,
  duel_active:    0,
  nav_building23: 1,
  plant_active:   1,
  nav_library:    2,
  book_active:    2,
  nav_h1:         3,
  spell_active:   3,
};

export class EvilGuidanceSystem {
  private scene:        Phaser.Scene;
  private arrowGfx:    Phaser.GameObjects.Graphics;
  private glowGfx:     Phaser.GameObjects.Graphics;
  private distText:    Phaser.GameObjects.Text;

  private state:       EvilQuestState = 'inactive';
  private bobTime      = 0;
  private glowAlpha    = 0.3;
  private glowDir      = 1;
  private arrowAngle   = Math.PI / 2; // pointing down initially
  private emitTimer    = 0;

  // Event unsubscribe handles
  private offDuelWon?: () => void;
  private offCloseQuest?: () => void;
  private offBookFound?: () => void;
  private offSpellWon?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.glowGfx  = scene.add.graphics().setDepth(24);
    this.arrowGfx = scene.add.graphics().setDepth(25);
    this.distText = scene.add.text(0, 0, '', {
      fontFamily:      '"Press Start 2P", monospace',
      fontSize:        '9px',
      color:           '#f0cd60',
      stroke:          '#1a0533',
      strokeThickness: 4,
      padding:         { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(26).setVisible(false);
    this._setVisible(false);
  }

  // ── Activate — call once after player is spawned ─────────────────────
  activate() {
    const store = this._getStore();
    if (!store || store.playerPath !== 'evil') return;

    // Resume from saved state
    const saved = store.evilQuestState as EvilQuestState;
    if (saved && saved !== 'inactive') {
      this.state = saved;
    } else {
      this.state = 'nav_f7';
      store.setEvilQuestState('nav_f7');
    }

    if (this.state === 'complete') {
      this._setVisible(false);
      return;
    }

    this._setVisible(this.state !== 'duel_active' && this.state !== 'plant_active' && this.state !== 'book_active' && this.state !== 'spell_active');
    this._subscribeEvents();
    this._emitUpdate();
  }

  // ── Update — call every frame from OutdoorWorldScene.update() ────────
  update(playerX: number, playerY: number, delta: number) {
    if (this.state === 'inactive' || this.state === 'complete') return;

    // Hide arrow while player is inside a quest room
    if (this.state === 'duel_active' || this.state === 'plant_active' || this.state === 'book_active' || this.state === 'spell_active') {
      this._setVisible(false);
      return;
    }

    const targetIdx = STATE_TARGET[this.state] ?? 0;
    const target    = EVIL_GUIDANCE_TARGETS[targetIdx];
    if (!target) return;

    this._setVisible(true);
    this.bobTime   += delta;
    this.emitTimer += delta;

    const dx   = target.worldX - playerX;
    const dy   = target.worldY - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Smooth rotate arrow toward target
    const desired = Math.atan2(dy, dx) + Math.PI / 2;
    let   diff    = desired - this.arrowAngle;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.arrowAngle += diff * Math.min(1, delta * 0.007);

    // Arrow position: 90px IN FRONT OF / BELOW the player (toward target)
    const fwd    = this.arrowAngle - Math.PI / 2; // direction arrow points
    const offset = 90;
    const arrowX = playerX + Math.cos(fwd) * offset;
    const arrowY = playerY + Math.sin(fwd) * offset;

    // Glow pulse
    this.glowAlpha += this.glowDir * delta * 0.0004;
    if (this.glowAlpha > 0.45) { this.glowAlpha = 0.45; this.glowDir = -1; }
    if (this.glowAlpha < 0.12) { this.glowAlpha = 0.12; this.glowDir =  1; }

    // Bob (vertical float)
    const bob = Math.sin(this.bobTime * 0.003) * 7;

    this._drawGlow(arrowX, arrowY + bob);
    this._drawArrow(arrowX, arrowY + bob);

    const distM = Math.round(dist / 20);
    this.distText.setPosition(arrowX, arrowY + bob + 44).setText(`${distM}m`).setVisible(true);

    // Throttled UI update
    if (this.emitTimer > 250) {
      this.emitTimer = 0;
      eventBus.emit('EVIL_GUIDANCE_UPDATE', {
        step:     targetIdx,
        distance: distM,
        state:    this.state,
        target,
      });
    }
  }

  // ── Called when player enters F7 — marks duel as active ─────────────
  onEnterDueling() {
    if (this.state !== 'nav_f7') return;
    this._transition('duel_active');
  }

  // ── Called when player enters Building 23 ────────────────────────────
  onEnterBotanical() {
    if (this.state !== 'nav_building23') return;
    this._transition('plant_active');
  }

  // ── Called when player enters Library ────────────────────────────────
  onEnterLibrary() {
    if (this.state !== 'nav_library') return;
    this._transition('book_active');
  }

  // ── Called when player enters H1 ─────────────────────────────────────
  onEnterH1() {
    if (this.state !== 'nav_h1') return;
    this._transition('spell_active');
  }

  destroy() {
    this._unsubscribeEvents();
    this.glowGfx.destroy();
    this.arrowGfx.destroy();
    this.distText.destroy();
  }

  // ── Internal transition ───────────────────────────────────────────────
  private _transition(next: EvilQuestState) {
    const prev  = this.state;
    this.state  = next;
    this._getStore()?.setEvilQuestState(next);
    this._setVisible(next !== 'duel_active' && next !== 'plant_active' && next !== 'book_active' && next !== 'spell_active' && next !== 'complete' && next !== 'inactive');
    eventBus.emit('EVIL_GUIDANCE_STATE', { prev, next });
    this._emitUpdate();
  }

  private _emitUpdate() {
    const targetIdx = STATE_TARGET[this.state] ?? 0;
    const target    = EVIL_GUIDANCE_TARGETS[targetIdx];
    eventBus.emit('EVIL_GUIDANCE_UPDATE', { step: targetIdx, distance: null, state: this.state, target });
  }

  private _subscribeEvents() {
    // DUEL_WON → advance from duel_active to nav_building23
    this.offDuelWon = eventBus.on('DUEL_WON', () => {
      if (this.state !== 'duel_active') return;
      this._getStore()?.setEvilDuelWon();
      this._transition('nav_building23');
      eventBus.emit('EVIL_GUIDANCE_ADVANCE', {
        completedLabel: 'Duel',
        nextLabel:      'Building 23',
      });
    });

    // CLOSE_QUEST { completed: true } → advance from plant_active to nav_h1
    this.offCloseQuest = eventBus.on('CLOSE_QUEST' as any, (raw: unknown) => {
      const d = raw as { completed: boolean };
      if (!d.completed) return;
      if (this.state !== 'plant_active') return;
      this._getStore()?.setEvilPlantFound();
      this._transition('nav_library');
      eventBus.emit('EVIL_GUIDANCE_ADVANCE', {
        completedLabel: 'Rare Plant',
        nextLabel:      'Library',
      });
    });

    // RESTRICTED_BOOK_FOUND → advance from book_active to nav_h1
    this.offBookFound = eventBus.on('RESTRICTED_BOOK_FOUND', () => {
      if (this.state !== 'book_active') return;
      this._getStore()?.setEvilBookFound();
      this._transition('nav_h1');
      eventBus.emit('EVIL_GUIDANCE_ADVANCE', {
        completedLabel: 'Restricted Book',
        nextLabel:      'Building H1',
      });
    });

    // SPELL_CHALLENGE_WON → advance from spell_active to complete
    this.offSpellWon = eventBus.on('SPELL_CHALLENGE_WON', () => {
      if (this.state !== 'spell_active') return;
      this._transition('complete');
      this._setVisible(false);
      eventBus.emit('EVIL_GUIDANCE_COMPLETE', {});
    });
  }

  private _unsubscribeEvents() {
    this.offDuelWon?.();
    this.offCloseQuest?.();
    this.offBookFound?.();
    this.offSpellWon?.();
  }

  // ── Drawing ───────────────────────────────────────────────────────────
  private _drawGlow(_cx: number, _cy: number) {
    // Glow bubble removed — arrow only
    this.glowGfx.clear();
  }

  private _drawArrow(cx: number, cy: number) {
    this.arrowGfx.clear();
    const a   = this.arrowAngle;
    const cos = Math.cos(a), sin = Math.sin(a);
    const r   = (lx: number, ly: number): [number, number] =>
      [cx + lx*cos - ly*sin, cy + lx*sin + ly*cos];

    const tip    = r(0,   -36);
    const wL     = r(-24,   2);
    const wR     = r( 24,   2);
    const notchL = r( -9,   4);
    const notchR = r(  9,   4);
    const tailL  = r( -9,  26);
    const tailR  = r(  9,  26);
    const midL   = r(-14, -18);
    const midR   = r( 14, -18);
    const S      = 3;

    // Drop shadow
    this.arrowGfx.fillStyle(0x1a0533, 0.65);
    this.arrowGfx.fillTriangle(tip[0]+S,tip[1]+S, wL[0]+S,wL[1]+S, wR[0]+S,wR[1]+S);
    this.arrowGfx.fillTriangle(notchL[0]+S,notchL[1]+S, tailL[0]+S,tailL[1]+S, tailR[0]+S,tailR[1]+S);
    this.arrowGfx.fillTriangle(notchL[0]+S,notchL[1]+S, tailR[0]+S,tailR[1]+S, notchR[0]+S,notchR[1]+S);

    // Gold fill
    this.arrowGfx.fillStyle(0xf4d03f);
    this.arrowGfx.fillTriangle(tip[0],tip[1], wL[0],wL[1], wR[0],wR[1]);
    this.arrowGfx.fillTriangle(notchL[0],notchL[1], tailL[0],tailL[1], tailR[0],tailR[1]);
    this.arrowGfx.fillTriangle(notchL[0],notchL[1], tailR[0],tailR[1], notchR[0],notchR[1]);

    // Highlight
    this.arrowGfx.fillStyle(0xfdeea0, 0.55);
    this.arrowGfx.fillTriangle(tip[0],tip[1], wL[0],wL[1], midL[0],midL[1]);
    this.arrowGfx.fillStyle(0xcc88ff, 0.32);
    this.arrowGfx.fillTriangle(tip[0],tip[1], wR[0],wR[1], midR[0],midR[1]);
  }

  private _setVisible(v: boolean) {
    this.arrowGfx.setVisible(v);
    this.glowGfx.setVisible(v);
    if (!v) this.distText.setVisible(false);
  }

  private _getStore() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useGameStore } = require('../../stores/gameStore') as
        typeof import('../../stores/gameStore');
      return useGameStore.getState();
    } catch { return null; }
  }
}
