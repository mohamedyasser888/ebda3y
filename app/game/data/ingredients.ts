// ============================================================
// Ingredients Data — 13 Core Magical Ingredients
// IDs are stable keys. Names/descriptions can be translated.
// ============================================================
import type { Ingredient } from '../../types/game.types';

export const INGREDIENTS: Ingredient[] = [
  { id:'mint-leaves',    name:'Mint Leaves',     emoji:'🌿', color:'#22a86a', description:'Fresh magical mint that cools and heals.' },
  { id:'fairy-dust',     name:'Fairy Dust',      emoji:'✨', color:'#ffe066', description:'Shimmering dust collected from fairy wings.' },
  { id:'unicorn-hair',   name:'Unicorn Hair',    emoji:'🦄', color:'#e9d5ff', description:'A single strand from a unicorn\'s mane, humming with magic.' },
  { id:'red-mushroom',   name:'Red Mushroom',    emoji:'🍄', color:'#c0192c', description:'A powerful forest mushroom with restorative properties.' },
  { id:'crystal-powder', name:'Crystal Powder',  emoji:'💎', color:'#67e8f9', description:'Finely ground enchanted mooncrystal dust.' },
  { id:'moon-flower',    name:'Moon Flower',     emoji:'🌸', color:'#c4b5fd', description:'A blossom that only opens under a full moon.' },
  { id:'glow-berry',     name:'Glow Berry',      emoji:'🫐', color:'#818cf8', description:'A berry that pulses with inner bioluminescence.' },
  { id:'dragon-scale',   name:'Dragon Scale',    emoji:'🐉', color:'#ff6b35', description:'A single iridescent scale from a fire dragon.' },
  { id:'golden-herb',    name:'Golden Herb',     emoji:'🌾', color:'#d97706', description:'A rare herb that glitters like spun gold.' },
  { id:'magic-crystal',  name:'Magic Crystal',   emoji:'🔮', color:'#a855f7', description:'A crystallized node of pure arcane energy.' },
  { id:'spider-silk',    name:'Spider Silk',     emoji:'🕸️', color:'#cbd5e1', description:'Thin, near-invisible thread from a magical spider.' },
  { id:'lavender',       name:'Lavender',        emoji:'💜', color:'#7c3aed', description:'Dried lavender sprigs imbued with calming magic.' },
  { id:'bat-wing',       name:'Bat Wing',        emoji:'🦇', color:'#374151', description:'A dried wing membrane from a cave bat.' },
];

export const INGREDIENT_MAP = Object.fromEntries(
  INGREDIENTS.map((i) => [i.id, i])
) as Record<string, Ingredient>;
