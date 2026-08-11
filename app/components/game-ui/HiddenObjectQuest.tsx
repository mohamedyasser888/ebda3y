'use client';
// ============================================================
// HiddenObjectQuest — Mouse-click hidden object game
// l1.png background, all SVG items (transparent, no images)
// 3 SVG plants: plantA/plantB = wrong, plantRare = correct
// Many decoy plants + items fill the shelves symmetrically
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Props { onClose: (completed: boolean) => void; }
type Phase = 'intro' | 'searching' | 'discovery' | 'complete';
type ItemKind = 'rare' | 'decoy' | 'wrong';

interface SlotDef { svg: string; label: string; kind: ItemKind; }
interface SlotState extends SlotDef {
  id: string; left: string; top: string; width: string; height: string;
  found: boolean;
}

// ── Shelf grid constants ─────────────────────────────────────────────────
const ROW_Y = ['12%', '23%', '34%', '45%', '56%'];
const ROW_H = '8.5%';
const COLS = [
  { slots: ['26.6%', '31.0%', '35.3%'], w: '3.8%' },
  { slots: ['41.0%', '46.2%', '51.4%'], w: '4.6%' },
  { slots: ['57.8%', '62.7%', '67.6%'], w: '4.3%' },
];
const NICHE_SLOTS = [{ x: '80.4%', w: '6.8%' }, { x: '88.0%', w: '6.8%' }];
const NICHE_ROWS  = ['20%', '33%', '46%'];

// ── Slot grid — 5 rows × 3 cols × 3 items + 6 niche ─────────────────────
// plantRare hidden at row3 col2 slot2 (centre-centre, among similar plants)
// plantA (decoy) at row2 col1 slot2 (left area)
// plantB (decoy) at row4 col3 slot2 (right area)
// Additional decoy plants scattered at 8 more positions to confuse
const SLOT_GRID: SlotDef[][][] = [
  // Row 1 — books
  [
    [{ svg: 'bookRed', label: 'Herbology Book', kind: 'wrong' }, { svg: 'bookBlue', label: 'Charms Textbook', kind: 'wrong' }, { svg: 'bookGreen', label: 'Potions Manual', kind: 'wrong' }],
    [{ svg: 'bookPurple', label: 'Dark Arts Tome', kind: 'wrong' }, { svg: 'bookGold', label: 'Enchanted Spellbook', kind: 'wrong' }, { svg: 'bookBrown', label: 'History of Magic', kind: 'wrong' }],
    [{ svg: 'bookTeal', label: 'Astronomy Guide', kind: 'wrong' }, { svg: 'bookOrange', label: 'Transfiguration', kind: 'wrong' }, { svg: 'bookBlack', label: 'Restricted Volume', kind: 'wrong' }],
  ],
  // Row 2 — potions + decoy plant A hidden here
  [
    [{ svg: 'potionBlue', label: 'Calming Draught', kind: 'wrong' }, { svg: 'plantA', label: 'Small herb...', kind: 'decoy' }, { svg: 'scroll', label: 'Old Scroll', kind: 'wrong' }],
    [{ svg: 'potionGreen', label: 'Wiggenweld Potion', kind: 'wrong' }, { svg: 'potionPurple', label: 'Strange Draught', kind: 'wrong' }, { svg: 'potionGold', label: 'Felix Felicis', kind: 'wrong' }],
    [{ svg: 'plantDecoy1', label: 'Common herb', kind: 'wrong' }, { svg: 'potionRed', label: 'Strengthening Tonic', kind: 'wrong' }, { svg: 'potionBlue', label: 'Veritaserum', kind: 'wrong' }],
  ],
  // Row 3 — tomes + rare plant hidden centre
  [
    [{ svg: 'tome', label: 'Grand Grimoire', kind: 'wrong' }, { svg: 'plantDecoy2', label: 'Dried herb', kind: 'wrong' }, { svg: 'inkwell', label: 'Magic Inkwell', kind: 'wrong' }],
    [{ svg: 'jar', label: 'Preserved Specimen', kind: 'wrong' }, { svg: 'plantRare', label: 'Unusual specimen...', kind: 'rare' }, { svg: 'jar', label: 'Mystery Jar', kind: 'wrong' }],
    [{ svg: 'plantDecoy3', label: 'Garden clipping', kind: 'wrong' }, { svg: 'tome', label: 'Forbidden Tome', kind: 'wrong' }, { svg: 'inkwell', label: 'Enchanted Ink', kind: 'wrong' }],
  ],
  // Row 4 — crystals + decoy plant B hidden right
  [
    [{ svg: 'crystal', label: 'Amethyst Shard', kind: 'wrong' }, { svg: 'hourglass', label: 'Time Turner', kind: 'wrong' }, { svg: 'plantDecoy4', label: 'Ivy cutting', kind: 'wrong' }],
    [{ svg: 'hourglass', label: 'Magic Hourglass', kind: 'wrong' }, { svg: 'orb', label: 'Crystal Orb', kind: 'wrong' }, { svg: 'hourglass', label: 'Sand Timer', kind: 'wrong' }],
    [{ svg: 'plantDecoy5', label: 'Dried fern', kind: 'wrong' }, { svg: 'plantB', label: 'Potted herb...', kind: 'decoy' }, { svg: 'crystal', label: 'Purple Crystal', kind: 'wrong' }],
  ],
  // Row 5 — skulls + keys + quills + extra decoy plants
  [
    [{ svg: 'skull', label: 'Memento Mori', kind: 'wrong' }, { svg: 'plantDecoy6', label: 'Small sprig', kind: 'wrong' }, { svg: 'quill', label: 'Phoenix Quill', kind: 'wrong' }],
    [{ svg: 'key', label: 'Silver Key', kind: 'wrong' }, { svg: 'wand', label: 'Spare Wand', kind: 'wrong' }, { svg: 'key', label: 'Bronze Key', kind: 'wrong' }],
    [{ svg: 'plantDecoy7', label: 'Leafy clipping', kind: 'wrong' }, { svg: 'skull', label: 'Old Skull', kind: 'wrong' }, { svg: 'quill', label: 'Eagle Feather Quill', kind: 'wrong' }],
  ],
];

const NICHE_GRID: SlotDef[][] = [
  [{ svg: 'potionPurple', label: 'Niche Potion', kind: 'wrong' }, { svg: 'plantDecoy8', label: 'Window herb', kind: 'wrong' }],
  [{ svg: 'scroll', label: 'Rolled Parchment', kind: 'wrong' }, { svg: 'potionGold', label: 'Golden Tonic', kind: 'wrong' }],
  [{ svg: 'orb', label: 'Seeing Orb', kind: 'wrong' }, { svg: 'plantDecoy1', label: 'Common plant', kind: 'wrong' }],
];

function buildSlots(): SlotState[] {
  const slots: SlotState[] = [];
  SLOT_GRID.forEach((row, ri) =>
    COLS.forEach((col, ci) =>
      col.slots.forEach((x, si) => {
        const def = row[ci][si];
        slots.push({ ...def, id: `r${ri}c${ci}s${si}`, left: x, top: ROW_Y[ri], width: col.w, height: ROW_H, found: false });
      })
    )
  );
  NICHE_GRID.forEach((row, ri) =>
    NICHE_SLOTS.forEach((slot, si) => {
      const def = row[si];
      slots.push({ ...def, id: `n${ri}s${si}`, left: slot.x, top: NICHE_ROWS[ri], width: slot.w, height: ROW_H, found: false });
    })
  );
  return slots;
}

// ── SVG catalogue — all transparent, no background fills ─────────────────
// Plants all share the same design language (pot + stem + leaves)
// but differ in leaf shape/color so they look like siblings, not obvious
const SVG: Record<string, React.ReactNode> = {
  // ── Books (colored spines) ──────────────────────────────────────────────
  bookRed:    <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#c0392b"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#922b21"/><rect x="4" y="10" width="18" height="1.5" fill="#e8a09a" opacity="0.8"/><rect x="4" y="14" width="13" height="1" fill="#e8a09a" opacity="0.5"/></svg>,
  bookBlue:   <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#2471a3"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#1a5276"/><rect x="4" y="10" width="18" height="1.5" fill="#aed6f1" opacity="0.8"/></svg>,
  bookGreen:  <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#1e8449"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#145a32"/><rect x="4" y="10" width="16" height="1.5" fill="#a9dfbf" opacity="0.8"/></svg>,
  bookPurple: <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#7d3c98"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#6c3483"/><rect x="4" y="10" width="17" height="1.5" fill="#d7bde2" opacity="0.8"/></svg>,
  bookGold:   <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#b7950b"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#9a7d0a"/><rect x="4" y="8" width="18" height="2" fill="#f9e79f" opacity="0.9"/><rect x="4" y="39" width="18" height="2" fill="#f9e79f" opacity="0.9"/><rect x="7" y="22" width="14" height="3" fill="#f9e79f" opacity="0.5"/></svg>,
  bookBrown:  <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#784212"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#6e2f1a"/><rect x="4" y="12" width="14" height="1.5" fill="#d4ac6e" opacity="0.8"/></svg>,
  bookTeal:   <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#117a65"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#0e6655"/><rect x="4" y="10" width="17" height="1.5" fill="#a2d9ce" opacity="0.8"/></svg>,
  bookOrange: <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#ca6f1e"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#a04000"/><rect x="4" y="10" width="15" height="1.5" fill="#fad7a0" opacity="0.8"/></svg>,
  bookBlack:  <svg viewBox="0 0 28 50"><rect x="1" y="0" width="26" height="49" rx="2" fill="#212f3d"/><rect x="1" y="0" width="5" height="49" rx="1" fill="#17202a"/><rect x="4" y="10" width="18" height="1.5" fill="#85c1e9" opacity="0.7"/></svg>,
  // ── Potions ─────────────────────────────────────────────────────────────
  potionBlue:   <svg viewBox="0 0 30 46"><rect x="11" y="1" width="8" height="11" rx="3" fill="#7f8c8d"/><rect x="10" y="0" width="10" height="3" rx="1.5" fill="#606060"/><ellipse cx="15" cy="30" rx="12" ry="14" fill="#2e86c1" opacity="0.85"/><ellipse cx="11" cy="23" rx="3.5" ry="5.5" fill="#aed6f1" opacity="0.35"/></svg>,
  potionRed:    <svg viewBox="0 0 30 46"><rect x="11" y="1" width="8" height="11" rx="3" fill="#7f8c8d"/><rect x="10" y="0" width="10" height="3" rx="1.5" fill="#606060"/><ellipse cx="15" cy="30" rx="12" ry="14" fill="#c0392b" opacity="0.85"/><ellipse cx="11" cy="23" rx="3.5" ry="5.5" fill="#f1948a" opacity="0.35"/></svg>,
  potionGreen:  <svg viewBox="0 0 30 46"><rect x="11" y="1" width="8" height="11" rx="3" fill="#7f8c8d"/><rect x="10" y="0" width="10" height="3" rx="1.5" fill="#606060"/><ellipse cx="15" cy="30" rx="12" ry="14" fill="#1e8449" opacity="0.85"/><ellipse cx="11" cy="23" rx="3.5" ry="5.5" fill="#82e0aa" opacity="0.35"/></svg>,
  potionPurple: <svg viewBox="0 0 30 46"><rect x="11" y="1" width="8" height="11" rx="3" fill="#7f8c8d"/><rect x="10" y="0" width="10" height="3" rx="1.5" fill="#606060"/><ellipse cx="15" cy="30" rx="12" ry="14" fill="#7d3c98" opacity="0.85"/><ellipse cx="11" cy="23" rx="3.5" ry="5.5" fill="#d2b4de" opacity="0.35"/></svg>,
  potionGold:   <svg viewBox="0 0 30 46"><rect x="11" y="1" width="8" height="11" rx="3" fill="#7f8c8d"/><rect x="10" y="0" width="10" height="3" rx="1.5" fill="#606060"/><ellipse cx="15" cy="30" rx="12" ry="14" fill="#b7950b" opacity="0.85"/><ellipse cx="11" cy="23" rx="3.5" ry="5.5" fill="#f9e79f" opacity="0.35"/></svg>,
  // ── Other items ──────────────────────────────────────────────────────────
  scroll:    <svg viewBox="0 0 28 44"><ellipse cx="14" cy="6" rx="10" ry="5" fill="#c8a86b"/><rect x="4" y="6" width="20" height="32" fill="#f0e6c8"/><ellipse cx="14" cy="38" rx="10" ry="5" fill="#c8a86b"/><line x1="8" y1="14" x2="20" y2="14" stroke="#8b7355" strokeWidth="1.5"/><line x1="8" y1="19" x2="18" y2="19" stroke="#8b7355" strokeWidth="1"/><line x1="8" y1="24" x2="20" y2="24" stroke="#8b7355" strokeWidth="1.5"/></svg>,
  crystal:   <svg viewBox="0 0 28 50"><polygon points="14,1 25,16 20,48 8,48 3,16" fill="#9b59b6" opacity="0.82"/><polygon points="14,1 25,16 20,48 8,48 3,16" fill="none" stroke="#d2b4de" strokeWidth="1.5"/><polygon points="14,5 22,16 18,42 10,42 6,16" fill="#c39bd3" opacity="0.3"/></svg>,
  hourglass: <svg viewBox="0 0 28 48"><rect x="3" y="2" width="22" height="4" rx="2" fill="#b7950b"/><rect x="3" y="42" width="22" height="4" rx="2" fill="#b7950b"/><path d="M5 6 L14 24 L5 42 L23 42 L14 24 L23 6 Z" fill="#d4ac6e" opacity="0.7"/><path d="M5 6 L23 6 L14 24Z" fill="#f9e79f" opacity="0.7"/><path d="M14 24 L5 42 L23 42Z" fill="#f9e79f" opacity="0.3"/></svg>,
  skull:     <svg viewBox="0 0 34 40"><ellipse cx="17" cy="16" rx="13" ry="14" fill="#e8e0d0"/><rect x="9" y="27" width="16" height="10" rx="2" fill="#d4cfc5"/><ellipse cx="12" cy="16" rx="3.8" ry="4.2" fill="#1a1a1a"/><ellipse cx="22" cy="16" rx="3.8" ry="4.2" fill="#1a1a1a"/><rect x="11" y="29" width="4" height="7" rx="1" fill="#1a1a1a"/><rect x="19" y="29" width="4" height="7" rx="1" fill="#1a1a1a"/></svg>,
  orb:       <svg viewBox="0 0 38 40"><ellipse cx="19" cy="19" rx="17" ry="17" fill="#5b2c6f" opacity="0.82"/><ellipse cx="19" cy="19" rx="17" ry="17" fill="none" stroke="#d2b4de" strokeWidth="1.5"/><ellipse cx="13" cy="12" rx="5.5" ry="4.5" fill="#e8daef" opacity="0.2"/></svg>,
  key:       <svg viewBox="0 0 42 18"><circle cx="9" cy="9" r="7" fill="none" stroke="#b7950b" strokeWidth="2.5"/><circle cx="9" cy="9" r="3.5" fill="none" stroke="#b7950b" strokeWidth="1.5"/><rect x="15" y="7.5" width="24" height="3" rx="1.5" fill="#b7950b"/><rect x="31" y="10.5" width="4" height="4" rx="1" fill="#b7950b"/><rect x="25" y="10.5" width="3" height="3" rx="1" fill="#b7950b"/></svg>,
  quill:     <svg viewBox="0 0 12 46"><path d="M6 1 C11 8,12 18,8 30 C7 35,6 42,6 44 C6 42,5 35,4 30 C0 18,1 8,6 1Z" fill="#f0e6c8"/><line x1="6" y1="10" x2="6" y2="44" stroke="#8b7355" strokeWidth="0.8"/></svg>,
  wand:      <svg viewBox="0 0 8 46"><rect x="2" y="5" width="4" height="39" rx="2" fill="#5d4037"/><polygon points="4,1 7,7 4,6 1,7" fill="#f9e79f"/></svg>,
  jar:       <svg viewBox="0 0 30 44"><rect x="9" y="2" width="12" height="5" rx="2.5" fill="#707b7c"/><ellipse cx="15" cy="28" rx="11" ry="13" fill="#aab7b8" opacity="0.72"/><ellipse cx="15" cy="28" rx="11" ry="13" fill="none" stroke="#707b7c" strokeWidth="1.5"/></svg>,
  tome:      <svg viewBox="0 0 32 50"><rect x="1" y="1" width="30" height="48" rx="3" fill="#7d6608"/><rect x="1" y="1" width="7" height="48" rx="2" fill="#6d5d07"/><rect x="5" y="7" width="22" height="2.5" rx="1" fill="#f9e79f" opacity="0.6"/><rect x="5" y="40" width="22" height="2.5" rx="1" fill="#f9e79f" opacity="0.6"/><circle cx="18" cy="25" r="5" fill="none" stroke="#f9e79f" strokeWidth="1" opacity="0.5"/></svg>,
  inkwell:   <svg viewBox="0 0 28 32"><ellipse cx="14" cy="22" rx="11" ry="8" fill="#1a1a2e"/><ellipse cx="14" cy="22" rx="11" ry="8" fill="none" stroke="#5b2c6f" strokeWidth="1.5"/><ellipse cx="14" cy="14" rx="7" ry="5" fill="#212f3d"/><ellipse cx="14" cy="14" rx="7" ry="5" fill="none" stroke="#5b2c6f" strokeWidth="1"/></svg>,

  // ── PLANTS — all same pot/stem design, differ in leaf shape only ────────
  // plantRare — THE correct one: star-shaped leaves, slightly different stem
  plantRare: <svg viewBox="0 0 34 50">
    {/* pot */}
    <rect x="9" y="38" width="16" height="10" rx="2" fill="#7d4012"/>
    <rect x="7" y="36" width="20" height="4" rx="1" fill="#9b5523"/>
    {/* stem */}
    <line x1="17" y1="36" x2="17" y2="24" stroke="#2d7a1f" strokeWidth="2"/>
    {/* star leaves — unique identifier */}
    <polygon points="17,10 19,16 25,16 20,20 22,26 17,22 12,26 14,20 9,16 15,16" fill="#1e8449"/>
    <polygon points="17,14 18.5,18.5 23,18.5 19.5,21 21,25.5 17,23 13,25.5 14.5,21 11,18.5 15.5,18.5" fill="#27ae60"/>
    {/* small side leaves */}
    <ellipse cx="10" cy="30" rx="5" ry="3" fill="#1e8449" transform="rotate(-30,10,30)"/>
    <ellipse cx="24" cy="30" rx="5" ry="3" fill="#1e8449" transform="rotate(30,24,30)"/>
  </svg>,

  // plantA — decoy 1: round leaves, taller stem
  plantA: <svg viewBox="0 0 34 50">
    <rect x="9" y="38" width="16" height="10" rx="2" fill="#7d4012"/>
    <rect x="7" y="36" width="20" height="4" rx="1" fill="#9b5523"/>
    <line x1="17" y1="36" x2="17" y2="22" stroke="#2d7a1f" strokeWidth="2"/>
    <ellipse cx="17" cy="16" rx="9" ry="9" fill="#27ae60"/>
    <ellipse cx="17" cy="16" rx="6" ry="6" fill="#2ecc71"/>
    <ellipse cx="11" cy="28" rx="5" ry="3.5" fill="#27ae60" transform="rotate(-20,11,28)"/>
    <ellipse cx="23" cy="28" rx="5" ry="3.5" fill="#27ae60" transform="rotate(20,23,28)"/>
    <ellipse cx="15" cy="11" rx="2" ry="3" fill="#58d68d" opacity="0.5"/>
  </svg>,

  // plantB — decoy 2: pointed leaves, bushier
  plantB: <svg viewBox="0 0 34 50">
    <rect x="9" y="38" width="16" height="10" rx="2" fill="#7d4012"/>
    <rect x="7" y="36" width="20" height="4" rx="1" fill="#9b5523"/>
    <line x1="17" y1="36" x2="17" y2="26" stroke="#2d7a1f" strokeWidth="2"/>
    <polygon points="17,8 21,20 17,18 13,20" fill="#1e8449"/>
    <polygon points="17,8 20,19 17,17 14,19" fill="#27ae60"/>
    <polygon points="9,22 14,28 10,30 7,26" fill="#1e8449"/>
    <polygon points="25,22 20,28 24,30 27,26" fill="#1e8449"/>
    <polygon points="12,14 16,24 13,24 10,20" fill="#27ae60"/>
    <polygon points="22,14 18,24 21,24 24,20" fill="#27ae60"/>
  </svg>,

  // 8 extra decoy plants (wrong) — variations of the same theme to confuse
  plantDecoy1: <svg viewBox="0 0 34 50">
    <rect x="10" y="39" width="14" height="9" rx="2" fill="#7d4012"/>
    <rect x="8" y="37" width="18" height="3" rx="1" fill="#9b5523"/>
    <line x1="17" y1="37" x2="17" y2="27" stroke="#2d7a1f" strokeWidth="1.5"/>
    <ellipse cx="17" cy="20" rx="8" ry="10" fill="#1e8449"/>
    <ellipse cx="17" cy="20" rx="5" ry="7" fill="#2ecc71"/>
    <ellipse cx="13" cy="30" rx="4" ry="2.5" fill="#27ae60" transform="rotate(-25,13,30)"/>
  </svg>,
  plantDecoy2: <svg viewBox="0 0 34 50">
    <rect x="10" y="39" width="14" height="9" rx="2" fill="#5d3710"/>
    <rect x="8" y="37" width="18" height="3" rx="1" fill="#7d4a20"/>
    <line x1="17" y1="37" x2="17" y2="24" stroke="#1a5c12" strokeWidth="1.5"/>
    <path d="M17 8 C22 12, 24 20, 20 28 C18 32, 16 35, 17 37 C18 35, 16 32, 14 28 C10 20, 12 12, 17 8Z" fill="#196f3d"/>
    <path d="M17 12 C20 15, 21 21, 18 27" fill="none" stroke="#1e8449" strokeWidth="1" opacity="0.7"/>
  </svg>,
  plantDecoy3: <svg viewBox="0 0 34 50">
    <rect x="9" y="38" width="16" height="10" rx="2" fill="#8b4513"/>
    <rect x="7" y="36" width="20" height="4" rx="1" fill="#a0522d"/>
    <line x1="17" y1="36" x2="17" y2="28" stroke="#2d7a1f" strokeWidth="2"/>
    <ellipse cx="12" cy="22" rx="6" ry="4" fill="#1e8449" transform="rotate(-30,12,22)"/>
    <ellipse cx="22" cy="22" rx="6" ry="4" fill="#1e8449" transform="rotate(30,22,22)"/>
    <ellipse cx="17" cy="18" rx="5" ry="6" fill="#27ae60"/>
    <ellipse cx="17" cy="15" rx="3" ry="4" fill="#2ecc71"/>
  </svg>,
  plantDecoy4: <svg viewBox="0 0 34 50">
    <rect x="10" y="39" width="14" height="9" rx="2" fill="#7d4012"/>
    <rect x="8" y="37" width="18" height="3" rx="1" fill="#9b5523"/>
    <line x1="17" y1="37" x2="15" y2="26" stroke="#2d7a1f" strokeWidth="1.5"/>
    <line x1="17" y1="37" x2="19" y2="26" stroke="#2d7a1f" strokeWidth="1.5"/>
    <ellipse cx="12" cy="22" rx="7" ry="5" fill="#27ae60" transform="rotate(-20,12,22)"/>
    <ellipse cx="22" cy="22" rx="7" ry="5" fill="#27ae60" transform="rotate(20,22,22)"/>
  </svg>,
  plantDecoy5: <svg viewBox="0 0 34 50">
    <rect x="9" y="39" width="16" height="9" rx="2" fill="#6b3710"/>
    <rect x="7" y="37" width="20" height="3" rx="1" fill="#8b4513"/>
    <line x1="17" y1="37" x2="17" y2="22" stroke="#145a32" strokeWidth="1.5"/>
    <polygon points="17,8 20,16 26,14 22,20 25,28 17,24 9,28 12,20 8,14 14,16" fill="#117a65"/>
    <polygon points="17,12 19.5,17.5 24,16 21,20.5 23,26 17,22.5 11,26 13,20.5 10,16 14.5,17.5" fill="#138d75"/>
  </svg>,
  plantDecoy6: <svg viewBox="0 0 34 50">
    <rect x="10" y="39" width="14" height="9" rx="2" fill="#7d4012"/>
    <rect x="8" y="37" width="18" height="3" rx="1" fill="#9b5523"/>
    <line x1="17" y1="37" x2="17" y2="25" stroke="#2d7a1f" strokeWidth="1.5"/>
    <ellipse cx="17" cy="17" rx="10" ry="9" fill="#1e8449"/>
    <ellipse cx="17" cy="18" rx="7" ry="6" fill="#27ae60"/>
    <line x1="17" y1="8" x2="17" y2="34" stroke="#145a32" strokeWidth="0.8"/>
    <line x1="10" y1="16" x2="24" y2="20" stroke="#145a32" strokeWidth="0.8"/>
  </svg>,
  plantDecoy7: <svg viewBox="0 0 34 50">
    <rect x="9" y="38" width="16" height="10" rx="2" fill="#7d4012"/>
    <rect x="7" y="36" width="20" height="4" rx="1" fill="#9b5523"/>
    <line x1="17" y1="36" x2="17" y2="24" stroke="#1a5c12" strokeWidth="2"/>
    <path d="M17 10 C24 14, 26 22, 22 30 L17 35 L12 30 C8 22, 10 14, 17 10Z" fill="#1e6e42"/>
    <path d="M17 14 C22 17, 23 23, 20 29" fill="none" stroke="#27ae60" strokeWidth="1.2" opacity="0.8"/>
    <path d="M17 14 C12 17, 11 23, 14 29" fill="none" stroke="#27ae60" strokeWidth="1.2" opacity="0.8"/>
  </svg>,
  plantDecoy8: <svg viewBox="0 0 34 50">
    <rect x="10" y="39" width="14" height="9" rx="2" fill="#6b3710"/>
    <rect x="8" y="37" width="18" height="3" rx="1" fill="#8b4513"/>
    <line x1="17" y1="37" x2="17" y2="28" stroke="#2d7a1f" strokeWidth="1.5"/>
    <ellipse cx="11" cy="24" rx="5" ry="7" fill="#27ae60" transform="rotate(-15,11,24)"/>
    <ellipse cx="23" cy="24" rx="5" ry="7" fill="#27ae60" transform="rotate(15,23,24)"/>
    <ellipse cx="17" cy="20" rx="4" ry="6" fill="#2ecc71"/>
    <ellipse cx="17" cy="17" rx="2.5" ry="3.5" fill="#58d68d"/>
  </svg>,
};

export default function HiddenObjectQuest({ onClose }: Props) {
  const [slots,   setSlots]   = useState<SlotState[]>(() => buildSlots());
  const [phase,   setPhase]   = useState<Phase>('intro');
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [fbk,     setFbk]     = useState<{ text: string; color: string; x: number; y: number } | null>(null);
  const [cursor,  setCursor]  = useState({ x: 0, y: 0 });
  const [rareSlot,setRareSlot]= useState<SlotState | null>(null);
  const fbkT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.style.cursor = 'none';
    return () => { document.body.style.cursor = 'auto'; };
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    setCursor({ x: e.clientX, y: e.clientY });
  }, []);

  const showFbk = (text: string, color: string, x: number, y: number) => {
    if (fbkT.current) clearTimeout(fbkT.current);
    setFbk({ text, color, x, y });
    fbkT.current = setTimeout(() => setFbk(null), 2200);
  };

  const handleClick = (slot: SlotState, e: React.MouseEvent) => {
    if (phase !== 'searching') return;
    e.stopPropagation();
    if (slot.kind === 'wrong') {
      showFbk('Wrong item. Search again.', '#ff8888', e.clientX, e.clientY);
    } else if (slot.kind === 'decoy') {
      showFbk('Wrong plant. Search again.', '#ffaa44', e.clientX, e.clientY);
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, found: true } : s));
    } else {
      // rare plant found!
      setRareSlot(slot);
      setPhase('discovery');
      setTimeout(() => setPhase('complete'), 5800);
    }
  };

  return (
    <div onMouseMove={onMove} style={{ position: 'fixed', inset: 0, zIndex: 160, cursor: 'none', userSelect: 'none', fontFamily: '"Press Start 2P",monospace' }}>
      {/* Custom magnifying glass cursor */}
      <div style={{ position: 'fixed', left: cursor.x - 18, top: cursor.y - 18, width: 36, height: 36, fontSize: 26, lineHeight: '36px', textAlign: 'center', pointerEvents: 'none', zIndex: 9999, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>🔍</div>

      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0a0010' }}>
        {/* Background */}
        <img src="/assets/backgrounds/quest-room.png" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0, pointerEvents: 'none' }} alt="" draggable={false} />

        {/* HUD */}
        {phase === 'searching' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, background: 'linear-gradient(180deg,rgba(8,0,16,0.9),transparent)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px' }}>
            <div style={{ fontSize: 9, color: '#c4b5fd', letterSpacing: 1 }}>🔍 Find the Rare Plant</div>
            <button onClick={() => onClose(false)} style={{ background: 'rgba(60,0,20,0.7)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: 9, padding: '4px 12px', cursor: 'none', borderRadius: 4, fontFamily: 'inherit' }}>✕ Leave</button>
          </div>
        )}

        {/* All shelf items */}
        {slots.map(slot => {
          if (slot.found && slot.kind !== 'rare') return null;
          const isH = hovered === slot.id;
          return (
            <div
              key={slot.id}
              style={{ position: 'absolute', left: slot.left, top: slot.top, width: slot.width, height: slot.height, zIndex: isH ? 22 : 18, cursor: 'none', filter: isH ? 'brightness(1.9) drop-shadow(0 0 7px rgba(255,240,160,1))' : 'none', transition: 'filter 0.12s', background: 'transparent' }}
              onMouseEnter={e => { setHovered(slot.id); setTooltip({ text: slot.label, x: e.clientX, y: e.clientY }); }}
              onMouseLeave={() => { setHovered(null); setTooltip(null); }}
              onClick={e => handleClick(slot, e)}
            >
              <div style={{ width: '100%', height: '100%' }}>{SVG[slot.svg]}</div>
            </div>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <div style={{ position: 'fixed', left: tooltip.x + 28, top: tooltip.y - 16, background: 'rgba(14,6,28,0.97)', border: '1px solid #7c3aed', color: '#e2d9f3', fontSize: 9, padding: '4px 10px', borderRadius: 4, pointerEvents: 'none', zIndex: 9998, whiteSpace: 'nowrap', boxShadow: '0 0 10px rgba(124,58,237,0.5)' }}>
            {tooltip.text}
          </div>
        )}

        {/* Feedback text */}
        {fbk && (
          <div style={{ position: 'fixed', left: fbk.x - 90, top: fbk.y - 48, color: fbk.color, fontSize: 11, fontFamily: 'inherit', textShadow: '0 0 6px rgba(0,0,0,0.9),2px 2px 0 #000', pointerEvents: 'none', zIndex: 9997, animation: 'hobFbk 2.2s ease-out forwards', whiteSpace: 'nowrap' }}>
            {fbk.text}
          </div>
        )}

        {/* INTRO */}
        {phase === 'intro' && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(4,0,12,0.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 16, color: '#c4b5fd', marginBottom: 18, textShadow: '0 0 20px #7c3aed' }}>✨ The Rare Plant Quest ✨</div>
            <div style={{ fontSize: 10, color: '#e2d9f3', marginBottom: 10, lineHeight: 2.2, textAlign: 'center' }}>A rare magical plant is hidden among these shelves.</div>
            <div style={{ fontSize: 9, color: '#a78bfa', marginBottom: 8, lineHeight: 2, textAlign: 'center' }}>Many plants look similar — only one is truly rare.</div>
            <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 28, lineHeight: 2, textAlign: 'center' }}>Move your 🔍 cursor and click to inspect objects.</div>
            <button style={{ padding: '10px 28px', fontSize: 10, fontFamily: 'inherit', cursor: 'none', border: '2px solid #c4b5fd', background: 'rgba(36,18,72,0.9)', color: '#e2d9f3', borderRadius: 6 }} onClick={() => setPhase('searching')}>Begin Search</button>
          </div>
        )}

        {/* DISCOVERY */}
        {(phase === 'discovery' || phase === 'complete') && rareSlot && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, pointerEvents: phase === 'complete' ? 'auto' : 'none' }}>
            <div style={{ position: 'absolute', inset: 0, animation: 'hobDark 1.4s forwards', zIndex: 1 }} />
            {/* Spotlit rare plant */}
            <div style={{ position: 'absolute', left: rareSlot.left, top: rareSlot.top, width: rareSlot.width, height: rareSlot.height, zIndex: 15, animation: 'hobGlow 1.6s ease-out forwards', transformOrigin: 'center', filter: 'drop-shadow(0 0 20px #88ffaa) drop-shadow(0 0 50px #44ff88)' }}>
              <div style={{ width: '100%', height: '100%' }}>{SVG.plantRare}</div>
            </div>
            {/* Particles */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{ position: 'absolute', left: `calc(${rareSlot.left} + ${Math.cos(i / 20 * Math.PI * 2) * 8}%)`, top: `calc(${rareSlot.top} + ${Math.sin(i / 20 * Math.PI * 2) * 10}%)`, width: 7, height: 7, borderRadius: '50%', background: i % 3 === 0 ? '#88ffaa' : i % 3 === 1 ? '#f0c040' : '#c084fc', zIndex: 18, animation: `hobPart ${1.6 + i * 0.06}s ${i * 0.06}s ease-out forwards` }} />
            ))}
            {/* Text */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 22, animation: 'hobTextIn 0.8s 2.4s ease-out both' }}>
              <div style={{ fontSize: 22, color: '#88ffbb', textShadow: '0 0 30px #44ff88,0 0 60px #44ff88', marginBottom: 14 }}>You found the rare plant!</div>
              <div style={{ fontSize: 12, color: '#f0c040', textShadow: '0 0 12px #f0c040', marginBottom: 28 }}>✨ Quest Complete ✨</div>
              {phase === 'complete' && (
                <button onClick={() => onClose(true)} style={{ padding: '10px 28px', fontSize: 10, fontFamily: 'inherit', cursor: 'none', border: '2px solid #88ffbb', background: 'rgba(0,28,14,0.88)', color: '#88ffbb', borderRadius: 6 }}>Return to Room</button>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes hobDark   { 0%{background:rgba(0,0,0,0)} 100%{background:rgba(0,0,0,0.84)} }
        @keyframes hobGlow   { 0%{transform:scale(1)} 50%{transform:scale(3.2)} 100%{transform:scale(2.8)} }
        @keyframes hobPart   { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(calc((var(--i,0) - 10) * 8px), calc((var(--j,0) - 10) * -12px)) scale(0.2)} }
        @keyframes hobTextIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hobFbk    { 0%{opacity:1;transform:translateY(0)} 70%{opacity:1;transform:translateY(-28px)} 100%{opacity:0;transform:translateY(-46px)} }
      `}</style>
    </div>
  );
}
