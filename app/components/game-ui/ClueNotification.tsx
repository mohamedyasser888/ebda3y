'use client';

// ============================================================
// ClueNotification — "✦ CLUE FOUND ✦" magical toast
// Subscribes to CLUE_FOUND EventBus events from Phaser
// ============================================================
import { useEffect, useState } from 'react';
import { eventBus } from '../../game/EventBus';

interface ClueData {
  name:   string;
  badge:  string;
  total:  number;
}

export default function ClueNotification() {
  const [data, setData]       = useState<ClueData | null>(null);
  const [visible, setVisible] = useState(false);
  const [anim, setAnim]       = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    const off = eventBus.on('CLUE_FOUND', (raw: unknown) => {
      const d = raw as ClueData;
      setData(d);
      setVisible(true);
      setAnim('in');

      // Keep it up for 2.5s
      setTimeout(() => {
        setAnim('out');
        setTimeout(() => setVisible(false), 500); // Wait for fade out
      }, 2500);
    });
    return off;
  }, []);

  if (!visible || !data) return null;

  return (
    <div className={`clue-notification clue-notification--${anim}`}>
      {/* Background magical elements */}
      <div className="clue-notification__sparkle clue-notification__sparkle-1" />
      <div className="clue-notification__sparkle clue-notification__sparkle-2" />
      
      {/* Content */}
      <div className="clue-notification__content">
        <div className="clue-notification__icon">🔍</div>
        <div className="clue-notification__text">
          <div className="clue-notification__badge">{data.badge}</div>
          <div className="clue-notification__name">{data.name}</div>
        </div>
      </div>
    </div>
  );
}
