'use client';

// ============================================================
// DialogueBox — "Press E to…" interaction prompts
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../../game/EventBus';
import { BUILDING_MAP } from '../../game/data/buildings';

interface DialogueBoxProps {
  text:    string;
  visible: boolean;
}

export function DialogueBox({ text, visible }: DialogueBoxProps) {
  if (!visible) return null;
  return <div className="dialogue-box">{text}</div>;
}

// ── InteractionPrompt — subscribes to all EventBus door/cauldron events ──
export function InteractionPrompt() {
  const [prompt, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    const offDoor = eventBus.on('PLAYER_NEAR_DOOR', (data: unknown) => {
      const { near, target } = data as { near: boolean; target?: string };
      if (!near) { setPrompt(null); return; }

      if (target === 'outdoor') {
        setPrompt('🌿  Press E to exit to Academy Grounds');
      } else if (target && BUILDING_MAP[target]) {
        setPrompt(BUILDING_MAP[target].enterPrompt ?? `Press E to enter ${BUILDING_MAP[target].label}`);
      } else {
        setPrompt('Press E to enter');
      }
    });

    const offDuel = eventBus.on('PLAYER_NEAR_DUEL', (data: unknown) => {
      const { near } = data as { near: boolean };
      if (near) {
        setPrompt('⚡  Press E to challenge the duel arena');
      } else if (!near) {
        setPrompt(null);
      }
    });

    const offCauldron = eventBus.on('PLAYER_NEAR_CAULDRON', (data: unknown) => {
      const { near } = data as { near: boolean };
      setPrompt(near ? '🪄  Press E to brew a potion' : null);
    });

    const offInstructor = eventBus.on('PLAYER_NEAR_INSTRUCTOR', (data: unknown) => {
      const { near, name, locked } = data as { near: boolean; name?: string; locked?: boolean };
      if (near) {
        setPrompt(locked ? `🔒  ${name} is busy` : `🗣️  Press E to talk to ${name}`);
      } else {
        setPrompt(null);
      }
    });

    return () => { offDoor(); offDuel(); offCauldron(); offInstructor(); };
  }, []);

  return <DialogueBox text={prompt ?? ''} visible={!!prompt} />;
}
