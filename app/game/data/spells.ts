// ============================================================
// Spell Registry — Wizard Duelling Spells
// ============================================================
import type { Spell } from '../../types/game.types';

export const SPELLS: Spell[] = [
  // ── ATTACK SPELLS ────────────────────────────────────────
  {
    id:          'expelliarmus',
    name:        'Expelliarmus',
    type:        'attack',
    damage:      15,
    effect:      'disarm',
    description: 'Wand flies! Opponent loses 1 spell next turn',
    color:       '#e74c3c',
    icon:        '⚡',
  },
  {
    id:          'stupefy',
    name:        'Stupefy',
    type:        'attack',
    damage:      20,
    effect:      'stun',
    description: 'Stunned! Opponent skips next turn',
    color:       '#e67e22',
    icon:        '💥',
  },
  {
    id:          'reducto',
    name:        'Reducto',
    type:        'attack',
    damage:      25,
    effect:      'blast',
    description: 'Powerful blast!',
    color:       '#c0392b',
    icon:        '🔥',
  },
  {
    id:          'confringo',
    name:        'Confringo',
    type:        'attack',
    damage:      18,
    effect:      'burn',
    description: 'Burns opponent for +5 damage next turn',
    color:       '#ff4500',
    icon:        '💫',
  },
  {
    id:          'sectumsempra',
    name:        'Sectumsempra',
    type:        'attack',
    damage:      30,
    effect:      'heavy',
    description: 'Heavy damage - dark magic',
    color:       '#8B0000',
    icon:        '⚔️',
  },
  {
    id:          'bombarda',
    name:        'Bombarda',
    type:        'attack',
    damage:      22,
    effect:      'explosive',
    description: 'Explosive blast with 30% stun chance',
    color:       '#f39c12',
    icon:        '💣',
  },

  // ── DEFENSE SPELLS ───────────────────────────────────────
  {
    id:          'protego',
    name:        'Protego',
    type:        'defense',
    effect:      'shield',
    description: 'Creates a magical shield blocking next attack',
    color:       '#3498db',
    icon:        '🛡️',
  },
  {
    id:          'protego-maxima',
    name:        'Protego Maxima',
    type:        'defense',
    effect:      'reflect',
    description: 'Block next attack and reflect 10 damage',
    color:       '#2980b9',
    icon:        '🔵',
  },
  {
    id:          'finite',
    name:        'Finite Incantatem',
    type:        'defense',
    effect:      'dispel',
    description: 'Cancel all active effects on opponent',
    color:       '#9b59b6',
    icon:        '✨',
  },

  // ── HEAL SPELLS ──────────────────────────────────────────
  {
    id:          'episkey',
    name:        'Episkey',
    type:        'heal',
    heal:        15,
    effect:      'restore',
    description: 'Mends minor wounds',
    color:       '#27ae60',
    icon:        '💚',
  },
  {
    id:          'vulnera',
    name:        'Vulnera Sanentur',
    type:        'heal',
    heal:        25,
    effect:      'regenerate',
    description: 'Heals serious wounds',
    color:       '#2ecc71',
    icon:        '🌿',
  },
  {
    id:          'reparifors',
    name:        'Reparifors',
    type:        'heal',
    heal:        20,
    effect:      'cure',
    description: 'Cures wounds and removes debuffs',
    color:       '#1abc9c',
    icon:        '🍃',
  },
];

// Quick lookup by id
export const SPELL_MAP: Record<string, Spell> =
  Object.fromEntries(SPELLS.map((s) => [s.id, s]));
