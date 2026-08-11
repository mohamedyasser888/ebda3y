// ============================================================
// Potions Data — 8 Core Recipes + 4 Advanced
// Structured for easy translation (en/ar).
// All ingredient IDs must match ingredients.ts.
// ============================================================
import type { Potion } from '../../types/game.types';

export const POTIONS: Potion[] = [
  // ── PAGE 1 ──────────────────────────────────────────────
  {
    id:          'healing',
    name:        'Healing Potion',
    emoji:       '❤️',
    description: 'A warm crimson brew that mends wounds and restores vitality with every sip.',
    difficulty:  'Easy',
    rarity:      'Common',
    ingredients: ['mint-leaves', 'fairy-dust', 'unicorn-hair', 'red-mushroom'],
    recipe: [
      'Fill the cauldron with spring water.',
      'Crush mint leaves and stir in.',
      'Add fairy dust — it will sparkle.',
      'Carefully drop in unicorn hair.',
      'Slice the red mushroom and add last.',
      'Stir 5 times clockwise until crimson.',
    ],
    brewingTime: 30,
    effect:      'Restores 50 HP over 10 seconds.',
    xpReward:    50,
    color:       '#c0192c',
  },

  // ── PAGE 2 ──────────────────────────────────────────────
  {
    id:          'mana',
    name:        'Mana Potion',
    emoji:       '💙',
    description: 'A shimmering sapphire liquid that restores magical energy and sharpens focus.',
    difficulty:  'Easy',
    rarity:      'Common',
    ingredients: ['crystal-powder', 'moon-flower', 'fairy-dust', 'glow-berry'],
    recipe: [
      'Pour moon water into the cauldron.',
      'Add crystal powder slowly — it glows.',
      'Float moon flower petals on top.',
      'Drop in the glow berry whole.',
      'Sprinkle fairy dust and stir anti-clockwise.',
      'Brew until sapphire blue and luminous.',
    ],
    brewingTime: 25,
    effect:      'Restores 75 MP instantly.',
    xpReward:    50,
    color:       '#2563eb',
  },

  // ── PAGE 3 ──────────────────────────────────────────────
  {
    id:          'strength',
    name:        'Strength Potion',
    emoji:       '💪',
    description: 'An amber brew that fills the drinker with incredible physical power.',
    difficulty:  'Medium',
    rarity:      'Uncommon',
    ingredients: ['dragon-scale', 'golden-herb', 'red-mushroom', 'magic-crystal'],
    recipe: [
      'Heat the cauldron to a fierce boil.',
      'Add dragon scale — stand back, it sparks!',
      'Grind golden herb and stir in.',
      'Drop red mushroom whole into the boil.',
      'Place magic crystal on the surface.',
      'Stir until the brew glows bright amber.',
    ],
    brewingTime: 60,
    effect:      'Doubles physical strength for 5 minutes.',
    xpReward:    100,
    color:       '#d97706',
  },

  // ── PAGE 4 ──────────────────────────────────────────────
  {
    id:          'speed',
    name:        'Speed Potion',
    emoji:       '⚡',
    description: 'A crackling electric brew that makes the drinker as fast as lightning.',
    difficulty:  'Medium',
    rarity:      'Uncommon',
    ingredients: ['glow-berry', 'mint-leaves', 'fairy-dust', 'spider-silk'],
    recipe: [
      'Crush glow berry and add to warm cauldron.',
      'Add mint leaves — they crackle with energy.',
      'Sprinkle fairy dust in a circle.',
      'Thread spider silk across the surface.',
      'Stir 7 times clockwise until golden.',
      'Bottle while still sparkling.',
    ],
    brewingTime: 45,
    effect:      'Triples movement speed for 3 minutes.',
    xpReward:    100,
    color:       '#eab308',
  },

  // ── PAGE 5 ──────────────────────────────────────────────
  {
    id:          'luck',
    name:        'Luck Potion',
    emoji:       '🍀',
    description: 'A bubbly emerald potion that tips fate firmly in your favour.',
    difficulty:  'Medium',
    rarity:      'Uncommon',
    ingredients: ['moon-flower', 'golden-herb', 'fairy-dust', 'crystal-powder'],
    recipe: [
      'Begin under starlight if possible.',
      'Add moon flower petals first.',
      'Grind golden herb to a fine powder and stir in.',
      'Sprinkle fairy dust in a star pattern.',
      'Add crystal powder last.',
      'Stir exactly 13 times clockwise.',
    ],
    brewingTime: 55,
    effect:      'Maximum luck for 15 minutes.',
    xpReward:    120,
    color:       '#16a34a',
  },

  // ── PAGE 6 ──────────────────────────────────────────────
  {
    id:          'wisdom',
    name:        'Wisdom Potion',
    emoji:       '🦉',
    description: 'A deep indigo brew that unlocks hidden knowledge and sharpens the mind.',
    difficulty:  'Medium',
    rarity:      'Uncommon',
    ingredients: ['lavender', 'crystal-powder', 'unicorn-hair', 'moon-flower'],
    recipe: [
      'Begin in candlelight for best results.',
      'Add dried lavender — breathe the calm.',
      'Stir in crystal powder slowly.',
      'Drop unicorn hair into the centre.',
      'Float moon flower petals on the surface.',
      'Stir in a figure-8, 3 times each way.',
    ],
    brewingTime: 50,
    effect:      'Intelligence doubled for 30 minutes.',
    xpReward:    120,
    color:       '#4338ca',
  },

  // ── PAGE 7 ──────────────────────────────────────────────
  {
    id:          'fire-resistance',
    name:        'Fire Resistance Potion',
    emoji:       '🔥',
    description: 'A lava-red brew that grants immunity to fire and extreme heat.',
    difficulty:  'Hard',
    rarity:      'Rare',
    ingredients: ['dragon-scale', 'golden-herb', 'crystal-powder'],
    recipe: [
      'Superheat the cauldron until glowing.',
      'Add dragon scale — it will begin to melt.',
      'Grind golden herb into the heat.',
      'Add crystal powder — it absorbs the fire.',
      'Stir with an iron spoon until lava-red.',
      'Cool to 37°C before bottling.',
    ],
    brewingTime: 80,
    effect:      'Complete fire immunity for 10 minutes.',
    xpReward:    180,
    color:       '#dc2626',
  },

  // ── PAGE 8 ──────────────────────────────────────────────
  {
    id:          'water-breathing',
    name:        'Water Breathing Potion',
    emoji:       '🌊',
    description: 'A shimmering aqua brew that lets you breathe as freely under the sea.',
    difficulty:  'Hard',
    rarity:      'Rare',
    ingredients: ['moon-flower', 'glow-berry', 'magic-crystal', 'mint-leaves'],
    recipe: [
      'Fill the cauldron with salt water.',
      'Add moon flower — it glows blue.',
      'Crush glow berry and stir in.',
      'Drop magic crystal to the bottom.',
      'Add mint leaves for freshness.',
      'Stir anti-clockwise until aquamarine.',
    ],
    brewingTime: 65,
    effect:      'Allows breathing underwater for 10 minutes.',
    xpReward:    180,
    color:       '#0891b2',
  },
];

export const POTION_MAP = Object.fromEntries(
  POTIONS.map((p) => [p.id, p])
) as Record<string, Potion>;
