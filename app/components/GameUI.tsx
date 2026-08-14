'use client';

// ============================================================
// GameUI — Root React UI layer (over Phaser canvas)
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../game/EventBus';
import { useGameStore } from '../stores/gameStore';
import { InteractionPrompt } from './game-ui/DialogueBox';
import BrewingInterface from './game-ui/BrewingInterface';
import DuellingInterface from './game-ui/DuellingInterface';
import HiddenObjectQuest from './game-ui/HiddenObjectQuest';
import PathSelectionScreen from './game-ui/PathSelectionScreen';
import SpellGestureUI, { type SpellName } from './game-ui/SpellGestureUI';
import WelcomeVideo from './game-ui/WelcomeVideo';
import QuestHUD from './game-ui/QuestHUD';
import ClueNotification from './game-ui/ClueNotification';
import QuestCompleteOverlay from './game-ui/QuestCompleteOverlay';
import EvilPathQuestBar from './game-ui/EvilPathQuestBar';
import EndGameVideo from './game-ui/EndGameVideo';

export default function GameUI() {
  const [brewingOpen,      setBrewingOpen]      = useState(false);
  const [duellingOpen,     setDuellingOpen]     = useState(false);
  const [questOpen,        setQuestOpen]        = useState(false);
  const [pathOpen,         setPathOpen]         = useState(false);
  const [welcomeVideoOpen, setWelcomeVideoOpen] = useState(false);
  const [endGameVideoOpen, setEndGameVideoOpen] = useState(false);
  const [selectedPathTemp, setSelectedPathTemp] = useState<'good' | 'evil' | null>(null);
  
  const [spellGestureOpen, setSpellGestureOpen] = useState(false);
  const [activeSpell,      setActiveSpell]      = useState<SpellName | null>(null);

  const { playerPath, setPlayerPath } = useGameStore();

  useEffect(() => {
    const offOpenBrew  = eventBus.on('OPEN_BREWING', () => setBrewingOpen(true));
    const offCloseBrew = eventBus.on('CLOSE_BREWING', () => setBrewingOpen(false));
    const offOpenDuel  = eventBus.on('OPEN_DUEL',    () => setDuellingOpen(true));
    const offCloseDuel = eventBus.on('CLOSE_DUEL',   () => setDuellingOpen(false));
    const offOpenQuest = eventBus.on('OPEN_QUEST',   () => setQuestOpen(true));
    // BootScene emits this when no path has been saved
    const offPathSel   = eventBus.on('SHOW_PATH_SELECTION', () => setPathOpen(true));
    // Spell gesture overlay
    const offOpenGesture = eventBus.on('OPEN_SPELL_GESTURE', (data: unknown) => {
      const { spell } = data as { spell: SpellName };
      setActiveSpell(spell);
      setSpellGestureOpen(true);
    });

    // End game sequence
    const offEvilComplete = eventBus.on('EVIL_GUIDANCE_COMPLETE', () => {
      setTimeout(() => setEndGameVideoOpen(true), 2000);
    });
    // Placeholder for when good path is done
    const offGoodComplete = eventBus.on('GOOD_GUIDANCE_COMPLETE', () => {
      setTimeout(() => setEndGameVideoOpen(true), 2000);
    });

    return () => {
      offOpenBrew(); offCloseBrew();
      offOpenDuel(); offCloseDuel();
      offOpenQuest(); offPathSel();
      offOpenGesture();
      offEvilComplete();
      offGoodComplete();
    };
  }, []);

  useEffect(() => {
    // If a path is already saved, the game starts immediately without the video.
    // So we should stop the intro music and play game music.
    const initialPath = useGameStore.getState().playerPath;
    if (initialPath) {
      const introAudio = document.getElementById('bg-music-intro') as HTMLAudioElement | null;
      if (introAudio) introAudio.pause();
      
      const gameAudio = document.getElementById('bg-music-game') as HTMLAudioElement | null;
      if (gameAudio) gameAudio.play().catch(() => {});
    }
  }, []);

  const handlePathSelect = (path: 'good' | 'evil') => {
    setPlayerPath(path);
    setPathOpen(false);
    
    // Pause intro music to prevent making the video laggy/heavy
    const introAudio = document.getElementById('bg-music-intro') as HTMLAudioElement | null;
    if (introAudio) introAudio.pause();

    // Show the welcome video
    setSelectedPathTemp(path);
    setWelcomeVideoOpen(true);
  };

  const handleVideoEnd = () => {
    setWelcomeVideoOpen(false);
    
    const gameAudio = document.getElementById('bg-music-game') as HTMLAudioElement | null;
    if (gameAudio) gameAudio.play().catch(() => {});

    if (selectedPathTemp) {
      // Tell Phaser the selection & video are done so it can unblock gameplay
      eventBus.emit('PATH_SELECTED', { path: selectedPathTemp });
      setSelectedPathTemp(null);
    }
  };

  return (
    <>
      {/* Path selection — shown before game starts if no path chosen */}
      {pathOpen && (
        <PathSelectionScreen onSelect={handlePathSelect} />
      )}
      
      {/* Welcome video — shown right after choosing a path */}
      {welcomeVideoOpen && (
        <WelcomeVideo onVideoEnd={handleVideoEnd} />
      )}

      <QuestHUD />
      <EvilPathQuestBar />
      <InteractionPrompt />
      <ClueNotification />
      <QuestCompleteOverlay />

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

      {spellGestureOpen && activeSpell && (
        <SpellGestureUI
          spell={activeSpell}
          onClose={(learned: boolean) => {
            setSpellGestureOpen(false);
            if (learned) {
              eventBus.emit('SPELL_LEARNED', { spell: activeSpell });
            }
            setActiveSpell(null);
          }}
        />
      )}

      {/* End Game Video Sequence */}
      {endGameVideoOpen && playerPath && (
        <EndGameVideo path={playerPath} />
      )}
    </>
  );
}
