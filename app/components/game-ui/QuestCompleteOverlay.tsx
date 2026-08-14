'use client';

// ============================================================
// QuestCompleteOverlay — Full-screen celebration for quests
// Subscribes to QUEST_CREATURES_COMPLETE
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../../game/EventBus';

export default function QuestCompleteOverlay() {
  const [visible, setVisible] = useState(false);
  const [questId, setQuestId] = useState<string | null>(null);

  useEffect(() => {
    const off = eventBus.on('QUEST_CREATURES_COMPLETE', (data: unknown) => {
      const { quest } = data as { quest: string };
      setQuestId(quest);
      setVisible(true);

      // Hide after animation finishes (Phaser transitions out after 4.5s)
      setTimeout(() => {
        setVisible(false);
      }, 4500);
    });
    return off;
  }, []);

  if (!visible) return null;

  return (
    <div className="quest-complete-overlay">
      <div className="quest-complete-overlay__bg" />
      
      <div className="quest-complete-overlay__content">
        <div className="quest-complete-overlay__sparks" />
        
        <h2 className="quest-complete-overlay__title">✦ اكتملت المهمة ✦</h2>
        <p className="quest-complete-overlay__subtitle">مهمة الأستاذ ماكسيم والمخلوقات السحرية</p>
        
        {/* Animated magical runes / particles */}
        <div className="quest-complete-overlay__particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i} 
              className="quest-complete-overlay__particle" 
              style={{
                '--angle': `${(i / 20) * 360}deg`,
                '--delay': `${Math.random() * 0.5}s`,
                '--speed': `${1 + Math.random()}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
