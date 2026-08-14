// ============================================================
// Shared TypeScript Types — Magical Potion Academy
// ============================================================

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Legendary';
export type Rarity     = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type SceneName =
  | 'BootScene'
  | 'OutdoorWorldScene'
  | 'CommonRoomScene'
  | 'PotionLabScene'
  | 'DuellingRoomScene'
  | 'BotanicalClassroomScene'
  | 'AstronomyTowerScene'
  | 'HogwartsLibraryScene'
  | 'CreaturesClassScene'
  | 'MagicalHospitalScene'
  | 'RarePlantQuestScene'
  | 'O9Scene'
  | 'SpellTrainingScene'
  | 'CreaturesInvestigationScene'
  | 'H2SpellQuestScene';

export type BrewingPhase =
  | 'idle' | 'selecting' | 'adding' | 'stirring' | 'brewing' | 'success' | 'failure';

// ── Ingredient ────────────────────────────────────────────
export interface Ingredient {
  id:          string;
  name:        string;
  emoji:       string;
  color:       string;
  description: string;
}

// ── Potion ────────────────────────────────────────────────
export interface Potion {
  id:                  string;
  name:                string;
  description:         string;
  difficulty:          Difficulty;
  rarity:              Rarity;
  ingredients:         string[];   // ingredient ids in order
  recipe:              string[];   // step-by-step
  brewingTime:         number;     // seconds
  effect:              string;
  xpReward:            number;
  color:               string;     // cauldron liquid hex
  emoji:               string;
  unlockRequirement?:  string;     // potion id required first
}

// ── Building definition (used by registry + scenes) ───────
export interface BuildingDef {
  id:           string;       // unique key, e.g. 'potionLab'
  label:        string;       // display name, e.g. 'Potion Laboratory'
  sceneKey:     SceneName;    // Phaser scene to load
  // Outdoor world — where the door sits
  doorX:        number;
  doorY:        number;
  doorRadius:   number;       // interaction distance in world px
  // Interior — where player spawns after entering
  spawnX:       number;
  spawnY:       number;
  // Outdoor world — where player returns after exiting
  returnX:      number;
  returnY:      number;
  // Optional prompt override
  enterPrompt?: string;
}

// ── Global game state (for Zustand) ──────────────────────
export interface GameState {
  currentScene:    SceneName;
  potionsBrewedIds: string[];
  totalXP:         number;
  // Outdoor player position (persisted for return trips)
  outdoorX:        number;
  outdoorY:        number;
  // Which building the player is currently inside (null = outdoors)
  insideBuilding:  string | null;
  brewingOpen:     boolean;
  selectedPotionId: string | null;
  addedIngredients: string[];
  brewingPhase:    BrewingPhase;
  stirProgress:    number;
}

// ── EventBus event shapes ─────────────────────────────────
export interface GameEvent {
  SCENE_READY:          { scene: SceneName };
  ENTER_BUILDING:       { buildingId: string };
  EXIT_BUILDING:        { buildingId: string };
  OPEN_BREWING:         undefined;
  CLOSE_BREWING:        undefined;
  POTION_BREWED:        { potionId: string; xp: number };
  PLAYER_NEAR_DOOR:     { near: boolean; target?: string };
  PLAYER_NEAR_CAULDRON: { near: boolean };
  WIZARD_CELEBRATE:     undefined;
  WIZARD_SHAKE:         undefined;
  OPEN_DUEL:            undefined;
  CLOSE_DUEL:           undefined;
  DUEL_WON:             undefined;
  DUEL_LOST:            undefined;
  PLAYER_NEAR_DUEL:     { near: boolean };
  OPEN_QUEST:           undefined;
  CLOSE_QUEST:          { completed: boolean };
  SHOW_PATH_SELECTION:  undefined;
  PATH_SELECTED:        { path: 'good' | 'evil' };
  PLAYER_NEAR_INSTRUCTOR: { near: boolean; name?: string; locked?: boolean };
  OPEN_SPELL_GESTURE:   { spell: 'lumos' | 'nox' | 'expelliarmus' };
}

// ── Spell (for duelling) ──────────────────────────────────
export interface Spell {
  id:          string;
  name:        string;
  type:        'attack' | 'defense' | 'heal';
  damage?:     number;
  heal?:       number;
  effect:      string;
  description: string;
  color:       string;
  icon:        string;
}

// ── Duel State ────────────────────────────────────────────
export interface DuelState {
  playerHP:       number;
  aiHP:           number;
  playerMaxHP:    number;
  aiMaxHP:        number;
  turn:           'player' | 'ai';
  phase:          'selecting' | 'animating' | 'result';
  log:            BattleLogEntry[];
  activeEffects:  { player: ActiveEffect[]; ai: ActiveEffect[] };
  shieldActive:   { player: boolean; ai: boolean };
  skipTurn:       { player: boolean; ai: boolean };
  status:         'active' | 'playerWon' | 'aiWon';
}

export interface BattleLogEntry {
  turn:       number;
  caster:     'player' | 'ai';
  spellName:  string;
  result:     string;
  damage?:    number;
  heal?:      number;
}

export interface ActiveEffect {
  name:           string;
  turnsLeft:      number;
  damagePerTurn?: number;
}
