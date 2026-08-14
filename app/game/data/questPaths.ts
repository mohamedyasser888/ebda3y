// ============================================================
// Quest Path Registry — defines which quests belong to which
// story path.  Add new quest IDs here to extend either path.
//
// EVIL  → existing quests (dueling, rare plant, library O9)
// GOOD  → future quests (added later)
//
// Usage in Phaser scenes:
//   import { isQuestAvailable } from '../data/questPaths';
//   if (!isQuestAvailable('dueling')) return; // skip for good players
// ============================================================

export const QUEST_PATHS = {
  evil: [
    'dueling',       // DuellingRoomScene — duel challenge
    'rarePlant',     // BotanicalClassroomScene — rare plant hunt
    'restrictedBook', // HogwartsLibraryScene → O9Scene — restricted book
  ] as const,

  good: [
    'goodDuelingTraining',   // SpellTrainingScene — Lumos, Nox, Expelliarmus
    'goodCreaturesLesson',   // CreaturesInvestigationScene — Magical Creatures Investigation
    'h2SpellListening',      // H2SpellQuestScene — Spell Listening Challenge
  ] as const,
} as const;

export type QuestId =
  | typeof QUEST_PATHS.evil[number]
  | typeof QUEST_PATHS.good[number];

// ── Helper: read the player's path from Zustand outside React ─
function _getPlayerPath(): 'good' | 'evil' | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useGameStore } = require('../../stores/gameStore') as
      typeof import('../../stores/gameStore');
    return useGameStore.getState().playerPath;
  } catch {
    return null;
  }
}

/**
 * Returns true if the given quest is available for the current player path.
 * Call this inside any Phaser scene to guard quest bubbles / interactions.
 *
 * @param questId  One of the registered quest IDs
 */
export function isQuestAvailable(questId: QuestId): boolean {
  const path = _getPlayerPath();
  if (!path) return false; // no path chosen yet → nothing available

  const evilIds: readonly string[] = QUEST_PATHS.evil;
  const goodIds: readonly string[] = QUEST_PATHS.good;

  if (path === 'evil') return evilIds.includes(questId);
  if (path === 'good') return goodIds.includes(questId);
  return false;
}

/**
 * Returns all quest IDs available for the current player path.
 */
export function getAvailableQuests(): string[] {
  const path = _getPlayerPath();
  if (!path) return [];
  return [...QUEST_PATHS[path]];
}
