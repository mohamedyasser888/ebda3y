'use client';

// ============================================================
// QuestHUD — Magical quest objective panel (top-right, fixed)
// Subscribes to QUEST_HUD_UPDATE EventBus events from Phaser
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../../game/EventBus';

interface QuestHUDData {
  quest:      string;
  objective:  string;
  clues?:     number;
  totalClues?: number;
}

export default function QuestHUD() {
  const [data,    setData]    = useState<QuestHUDData | null>(null);
  const [visible, setVisible] = useState(false);
  const [flash,   setFlash]   = useState(false);

  useEffect(() => {
    const off = eventBus.on('QUEST_HUD_UPDATE', (raw: unknown) => {
      const d = raw as QuestHUDData;
      setData(d);
      setVisible(true);
      // Flash on update
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    });

    const offComplete = eventBus.on('QUEST_CREATURES_COMPLETE', () => {
      setData(prev => prev ? { ...prev, objective: '✦ اكتملت المهمة ✦' } : null);
      setTimeout(() => setVisible(false), 6000);
    });

    return () => { off(); offComplete(); };
  }, []);

  if (!visible || !data) return null;

  const cluesFound = data.clues ?? 0;
  const totalClues = data.totalClues ?? 3;
  const showClues  = typeof data.clues === 'number';

  return (
    <div className={`quest-hud${flash ? ' quest-hud--flash' : ''}`}>
      {/* Quest name */}
      <div className="quest-hud__name">
        <span className="quest-hud__diamond">◆</span>
        {data.quest}
      </div>

      {/* Divider */}
      <div className="quest-hud__divider" />

      {/* Objective */}
      <div className="quest-hud__objective">
        {data.objective}
      </div>

      {/* Clue progress (investigation phase) */}
      {showClues && (
        <div className="quest-hud__clues">
          {Array.from({ length: totalClues }).map((_, i) => (
            <span
              key={i}
              className={`quest-hud__clue-dot ${i < cluesFound ? 'quest-hud__clue-dot--found' : ''}`}
            />
          ))}
          <span className="quest-hud__clue-label">{cluesFound}/{totalClues} أدلة</span>
        </div>
      )}
    </div>
  );
}
