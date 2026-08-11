// ============================================================
// Zustand Game Store — Global State
// ============================================================
import { create } from 'zustand';
import type { BrewingPhase, SceneName } from '../types/game.types';

interface GameStore {
  // ── Scene ─────────────────────────────────────────────
  currentScene:    SceneName;
  setCurrentScene: (scene: SceneName) => void;

  // ── Outdoor position (preserved when entering buildings) ──
  outdoorX:        number;
  outdoorY:        number;
  setOutdoorPosition: (x: number, y: number) => void;

  // ── Which building is loaded (null = outdoors) ────────
  insideBuilding:  string | null;
  setInsideBuilding: (id: string | null) => void;

  // ── Progress ──────────────────────────────────────────
  potionsBrewedIds: string[];
  totalXP:          number;
  addBrewedPotion:  (id: string, xp: number) => void;
  hasBrewed:        (id: string) => boolean;

  // ── Brewing UI ────────────────────────────────────────
  brewingOpen:     boolean;
  setBrewingOpen:  (open: boolean) => void;

  selectedPotionId:   string | null;
  setSelectedPotionId: (id: string | null) => void;

  addedIngredients: string[];
  addIngredient:    (id: string) => void;
  resetIngredients: () => void;

  brewingPhase:    BrewingPhase;
  setBrewingPhase: (phase: BrewingPhase) => void;

  stirProgress:    number;
  setStirProgress: (p: number) => void;

  // ── Interaction prompt flags (driven by Phaser scenes) ─
  nearDoor:     boolean;
  setNearDoor:  (near: boolean) => void;
  nearCauldron: boolean;
  setNearCauldron: (near: boolean) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentScene:    'BootScene',
  setCurrentScene: (scene) => set({ currentScene: scene }),

  // Default spawn is outdoors near academy entrance
  outdoorX: 960,
  outdoorY: 900,
  setOutdoorPosition: (x, y) => set({ outdoorX: x, outdoorY: y }),

  insideBuilding:    null,
  setInsideBuilding: (id) => set({ insideBuilding: id }),

  potionsBrewedIds: [],
  totalXP:          0,
  addBrewedPotion: (id, xp) =>
    set((s) => ({
      potionsBrewedIds: s.potionsBrewedIds.includes(id)
        ? s.potionsBrewedIds
        : [...s.potionsBrewedIds, id],
      totalXP: s.totalXP + xp,
    })),
  hasBrewed: (id) => get().potionsBrewedIds.includes(id),

  brewingOpen:     false,
  setBrewingOpen:  (open) => set({ brewingOpen: open }),

  selectedPotionId:    null,
  setSelectedPotionId: (id) =>
    set({ selectedPotionId: id, addedIngredients: [], brewingPhase: 'selecting', stirProgress: 0 }),

  addedIngredients: [],
  addIngredient:    (id) => set((s) => ({ addedIngredients: [...s.addedIngredients, id] })),
  resetIngredients: () =>
    set({ addedIngredients: [], brewingPhase: 'selecting', stirProgress: 0 }),

  brewingPhase:    'idle',
  setBrewingPhase: (phase) => set({ brewingPhase: phase }),

  stirProgress:    0,
  setStirProgress: (p) => set({ stirProgress: Math.min(1, Math.max(0, p)) }),

  nearDoor:        false,
  setNearDoor:     (near) => set({ nearDoor: near }),
  nearCauldron:    false,
  setNearCauldron: (near) => set({ nearCauldron: near }),
}));
