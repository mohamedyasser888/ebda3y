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

  // ── Path selection (good / evil) ──────────────────────
  playerPath:    'good' | 'evil' | null;
  setPlayerPath: (path: 'good' | 'evil') => void;
  resetPath:     () => void;

  // ── Evil Path Guided Quest ────────────────────────────
  // Legacy arrival-based state (kept for save compat)
  evilGuidanceState: 'inactive' | 'evil_guidance_f7' | 'evil_guidance_building23' | 'evil_guidance_h1' | 'evil_guidance_completed';
  setEvilGuidanceState: (state: 'inactive' | 'evil_guidance_f7' | 'evil_guidance_building23' | 'evil_guidance_h1' | 'evil_guidance_completed') => void;
  evilGuidanceActive: boolean;

  // Completion-based quest state (source of truth for navigation)
  evilQuestState:
    | 'inactive'
    | 'nav_f7'            // heading to F7
    | 'duel_active'       // inside duel, waiting for win
    | 'nav_building23'    // heading to Building 23
    | 'plant_active'      // inside plant quest, waiting for completion
    | 'nav_h1'            // heading to H1 library
    | 'book_active'       // inside book quest, waiting for completion
    | 'nav_library'       // heading to library for spell
    | 'spell_active'      // inside spell quest
    | 'complete';         // entire sequence done
  setEvilQuestState: (s: 'inactive'|'nav_f7'|'duel_active'|'nav_building23'|'plant_active'|'nav_h1'|'book_active'|'nav_library'|'spell_active'|'complete') => void;
  evilDuelWon:         boolean;
  evilPlantFound:      boolean;
  evilBookFound:       boolean;
  setEvilDuelWon:      () => void;
  setEvilPlantFound:   () => void;
  setEvilBookFound:    () => void;
  resetEvilQuest:      () => void;

  // ── Good-path spell training quest ─────────────────────
  goodTrainingStarted:      boolean;
  lumosCompleted:           boolean;
  noxCompleted:             boolean;
  expelliarmusCompleted:    boolean;
  goodTrainingCompleted:    boolean;
  setGoodTrainingStarted:   () => void;
  setLumosCompleted:        () => void;
  setNoxCompleted:          () => void;
  setExpelliarmusCompleted: () => void;
  setGoodTrainingCompleted: () => void;
  resetGoodTraining:        () => void;

  // ── Good-path Quest 2: Magical Creatures Investigation ──
  goodCreaturesLessonStarted:          boolean;
  maximDialogueCompleted:              boolean;
  // Split-dialogue aliases
  maximPages1To5Completed:             boolean;
  maximDialogueCompletedPart1:         boolean;
  investigationStarted:                boolean;
  clueScratchesFound:                  boolean;
  clueHidingPlaceFound:                boolean;
  clueMetallicSoundFound:              boolean;
  investigationComplete:               boolean;  // alias for creatureFearDiscovered
  creatureFearDiscovered:              boolean;
  maximInvestigationDialogueCompleted: boolean;
  maximPages6To11Started:              boolean;
  noiseRemoved:                        boolean;
  safeAreaPrepared:                    boolean;
  foodCollected:                       boolean;
  creatureFed:                         boolean;
  goodCreaturesLessonCompleted:        boolean;
  // Quest state machine
  questState: 'not_started' | 'started' | 'initial_dialogue' | 'investigation' | 'return_to_maxim' | 'final_dialogue' | 'completed';
  setQuestState: (s: 'not_started' | 'started' | 'initial_dialogue' | 'investigation' | 'return_to_maxim' | 'final_dialogue' | 'completed') => void;
  setGoodCreaturesLessonStarted:          () => void;
  setMaximDialogueCompleted:              () => void;
  setMaximPages1To5Completed:             () => void;
  setInvestigationStarted:                () => void;
  setClueScratchesFound:                  () => void;
  setClueHidingPlaceFound:                () => void;
  setClueMetallicSoundFound:              () => void;
  setInvestigationComplete:               () => void;
  setCreatureFearDiscovered:              () => void;
  setMaximInvestigationDialogueCompleted: () => void;
  setMaximPages6To11Started:              () => void;
  setNoiseRemoved:                        () => void;
  setSafeAreaPrepared:                    () => void;
  setFoodCollected:                       () => void;
  setCreatureFed:                         () => void;
  setGoodCreaturesLessonCompleted:        () => void;
  resetGoodCreaturesLesson:               () => void;

  // ── H2 Spell Listening Quest ──────────────────────────────
  h2QuestState:
    | 'not_started'
    | 'room_entered'
    | 'inspect_object'
    | 'show_n1'
    | 'show_n2'
    | 'spell_intro'
    | 'playing_audio'
    | 'choose_action'
    | 'guess_spell'
    | 'spell_hint'
    | 'final_cinematic'
    | 'completed';
  setH2QuestState: (s: 'not_started'|'room_entered'|'inspect_object'|'show_n1'|'show_n2'|'spell_intro'|'playing_audio'|'choose_action'|'guess_spell'|'spell_hint'|'final_cinematic'|'completed') => void;
  h2SpellAttempts: number;
  incrementH2Attempts: () => void;
  resetH2Attempts: () => void;
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

  playerPath:    null,
  setPlayerPath: (path) => set({ playerPath: path }),
  resetPath:     () => set({ playerPath: null }),

  // ── Evil Path Guided Quest ────────────────────────────
  evilGuidanceState: 'inactive',
  evilGuidanceActive: false,
  setEvilGuidanceState: (state) => set({
    evilGuidanceState: state,
    evilGuidanceActive: state !== 'inactive' && state !== 'evil_guidance_completed',
  }),

  // Completion-based quest state
  evilQuestState: 'inactive',
  setEvilQuestState: (s) => set({ evilQuestState: s }),
  evilDuelWon:     false,
  evilPlantFound:  false,
  evilBookFound:   false,
  setEvilDuelWon:  () => set({ evilDuelWon: true }),
  setEvilPlantFound: () => set({ evilPlantFound: true }),
  setEvilBookFound: () => set({ evilBookFound: true }),
  resetEvilQuest:  () => set({
    evilQuestState: 'inactive', evilDuelWon: false,
    evilPlantFound: false, evilBookFound: false,
  }),

  // ── Good-path spell training quest ─────────────────────
  goodTrainingStarted:      false,
  lumosCompleted:           false,
  noxCompleted:             false,
  expelliarmusCompleted:    false,
  goodTrainingCompleted:    false,
  setGoodTrainingStarted:   () => set({ goodTrainingStarted: true }),
  setLumosCompleted:        () => set({ lumosCompleted: true }),
  setNoxCompleted:          () => set({ noxCompleted: true }),
  setExpelliarmusCompleted: () => set({ expelliarmusCompleted: true }),
  setGoodTrainingCompleted: () => set({ goodTrainingCompleted: true }),
  resetGoodTraining:        () => set({
    goodTrainingStarted: false, lumosCompleted: false,
    noxCompleted: false, expelliarmusCompleted: false,
    goodTrainingCompleted: false,
  }),

  // ── Good-path Quest 2: Magical Creatures Investigation ──
  goodCreaturesLessonStarted:          false,
  maximDialogueCompleted:              false,
  maximPages1To5Completed:             false,
  maximDialogueCompletedPart1:         false,
  investigationStarted:                false,
  clueScratchesFound:                  false,
  clueHidingPlaceFound:                false,
  clueMetallicSoundFound:              false,
  investigationComplete:               false,
  creatureFearDiscovered:              false,
  maximInvestigationDialogueCompleted: false,
  maximPages6To11Started:              false,
  noiseRemoved:                        false,
  safeAreaPrepared:                    false,
  foodCollected:                       false,
  creatureFed:                         false,
  goodCreaturesLessonCompleted:        false,
  questState:                          'not_started',
  setQuestState: (s) => set({ questState: s }),
  setGoodCreaturesLessonStarted:          () => set({ goodCreaturesLessonStarted: true, questState: 'started' }),
  setMaximDialogueCompleted:              () => set({ maximDialogueCompleted: true, maximPages1To5Completed: true, maximDialogueCompletedPart1: true, questState: 'investigation' }),
  setMaximPages1To5Completed:             () => set({ maximPages1To5Completed: true, maximDialogueCompletedPart1: true }),
  setInvestigationStarted:                () => set({ investigationStarted: true, questState: 'investigation' }),
  setClueScratchesFound:                  () => set({ clueScratchesFound: true }),
  setClueHidingPlaceFound:                () => set({ clueHidingPlaceFound: true }),
  setClueMetallicSoundFound:              () => set({ clueMetallicSoundFound: true }),
  setInvestigationComplete:               () => set({ investigationComplete: true, creatureFearDiscovered: true, questState: 'return_to_maxim' }),
  setCreatureFearDiscovered:              () => set({ creatureFearDiscovered: true, investigationComplete: true, questState: 'return_to_maxim' }),
  setMaximInvestigationDialogueCompleted: () => set({ maximInvestigationDialogueCompleted: true, questState: 'completed' }),
  setMaximPages6To11Started:              () => set({ maximPages6To11Started: true, questState: 'final_dialogue' }),
  setNoiseRemoved:                        () => set({ noiseRemoved: true }),
  setSafeAreaPrepared:                    () => set({ safeAreaPrepared: true }),
  setFoodCollected:                       () => set({ foodCollected: true }),
  setCreatureFed:                         () => set({ creatureFed: true }),
  setGoodCreaturesLessonCompleted:        () => set({ goodCreaturesLessonCompleted: true, questState: 'completed' }),
  resetGoodCreaturesLesson:               () => set({
    goodCreaturesLessonStarted: false, maximDialogueCompleted: false,
    maximPages1To5Completed: false, maximDialogueCompletedPart1: false,
    investigationStarted: false, clueScratchesFound: false,
    clueHidingPlaceFound: false, clueMetallicSoundFound: false,
    investigationComplete: false, creatureFearDiscovered: false,
    maximInvestigationDialogueCompleted: false, maximPages6To11Started: false,
    noiseRemoved: false, safeAreaPrepared: false,
    foodCollected: false, creatureFed: false,
    goodCreaturesLessonCompleted: false, questState: 'not_started',
  }),

  // ── H2 Spell Listening Quest ──────────────────────────────
  h2QuestState: 'not_started',
  setH2QuestState: (s) => set({ h2QuestState: s }),
  h2SpellAttempts: 0,
  incrementH2Attempts: () => set((st) => ({ h2SpellAttempts: st.h2SpellAttempts + 1 })),
  resetH2Attempts: () => set({ h2SpellAttempts: 0 }),
}));
