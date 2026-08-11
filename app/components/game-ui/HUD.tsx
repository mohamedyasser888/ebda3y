'use client';

// ============================================================
// HUD — Heads-Up Display (XP, potions brewed)
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../../game/EventBus';

interface HUDState {
  totalXP: number;
  potionsCount: number;
  currentScene: string;
}

export default function HUD() {
  const [state, setState] = useState<HUDState>({
    totalXP: 0,
    potionsCount: 0,
    currentScene: '',
  });

  useEffect(() => {
    const offBrewed = eventBus.on('POTION_BREWED', (data: unknown) => {
      const { xp } = data as { xp: number };
      setState((prev) => ({
        ...prev,
        totalXP: prev.totalXP + xp,
        potionsCount: prev.potionsCount + 1,
      }));
    });

    const offScene = eventBus.on('SCENE_READY', (data: unknown) => {
      const { scene } = data as { scene: string };
      setState((prev) => ({ ...prev, currentScene: scene }));
    });

    return () => {
      offBrewed();
      offScene();
    };
  }, []);

  return (
    <div className="hud">
      <div className="hud-panel">
        <span className="hud-icon">⭐</span>
        <span className="hud-text">XP: <span className="hud-value">{state.totalXP}</span></span>
      </div>
      <div className="hud-panel">
        <span className="hud-icon">🧪</span>
        <span className="hud-text">Potions: <span className="hud-value">{state.potionsCount}</span></span>
      </div>
      {state.currentScene && (
        <div className="hud-panel">
          <span className="hud-icon">🏰</span>
          <span className="hud-text" style={{ fontSize: 10, opacity: 0.8 }}>
            {state.currentScene === 'CommonRoomScene' ? 'Common Room' : 'Potion Lab'}
          </span>
        </div>
      )}
    </div>
  );
}
