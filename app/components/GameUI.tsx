'use client';

// ============================================================
// GameUI — Root React UI layer (over Phaser canvas)
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../game/EventBus';
import { InteractionPrompt } from './game-ui/DialogueBox';
import BrewingInterface from './game-ui/BrewingInterface';
import DuellingInterface from './game-ui/DuellingInterface';
import HiddenObjectQuest from './game-ui/HiddenObjectQuest';

export default function GameUI() {
  const [brewingOpen,  setBrewingOpen]  = useState(false);
  const [duellingOpen, setDuellingOpen] = useState(false);
  const [questOpen,    setQuestOpen]    = useState(false);

  useEffect(() => {
    const offOpenBrew  = eventBus.on('OPEN_BREWING', () => setBrewingOpen(true));
    const offCloseBrew = eventBus.on('CLOSE_BREWING', () => setBrewingOpen(false));
    const offOpenDuel  = eventBus.on('OPEN_DUEL',    () => setDuellingOpen(true));
    const offCloseDuel = eventBus.on('CLOSE_DUEL',   () => setDuellingOpen(false));
    const offOpenQuest = eventBus.on('OPEN_QUEST',   () => setQuestOpen(true));

    return () => {
      offOpenBrew(); offCloseBrew();
      offOpenDuel(); offCloseDuel();
      offOpenQuest();
    };
  }, []);

  return (
    <>
      <InteractionPrompt />

      {brewingOpen && (
        <BrewingInterface onClose={() => { eventBus.emit('CLOSE_BREWING'); setBrewingOpen(false); }} />
      )}

      {duellingOpen && (
        <DuellingInterface onClose={() => { eventBus.emit('CLOSE_DUEL'); setDuellingOpen(false); }} />
      )}

      {questOpen && (
        <HiddenObjectQuest onClose={(completed: boolean) => {
          setQuestOpen(false);
          eventBus.emit('CLOSE_QUEST', { completed });
        }} />
      )}
    </>
  );
}
