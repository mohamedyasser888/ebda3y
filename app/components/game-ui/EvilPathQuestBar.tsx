'use client';
// ============================================================
// EvilPathQuestBar — TOP-RIGHT polished RPG quest tracker
// Shows Evil Path progress: Duel → Rare Plant → Restricted Book
// Advances ONLY on quest completion, never on building arrival.
// ============================================================
import { useEffect, useState, useRef } from 'react';
import { eventBus } from '../../game/EventBus';

type QuestStep = { label: string; icon: string; status: 'pending' | 'active' | 'done' };
type EvilQuestState =
  | 'inactive' | 'nav_f7' | 'duel_active'
  | 'nav_building23' | 'plant_active'
  | 'nav_library' | 'book_active'
  | 'nav_h1' | 'spell_active' | 'complete';

const STEPS: { label: string; icon: string; activeStates: EvilQuestState[]; doneStates: EvilQuestState[] }[] = [
  {
    label:        'Win the Duel',
    icon:         '⚔',
    activeStates: ['nav_f7', 'duel_active'],
    doneStates:   ['nav_building23', 'plant_active', 'nav_library', 'book_active', 'nav_h1', 'spell_active', 'complete'],
  },
  {
    label:        'Find Rare Plant',
    icon:         '🌿',
    activeStates: ['nav_building23', 'plant_active'],
    doneStates:   ['nav_library', 'book_active', 'nav_h1', 'spell_active', 'complete'],
  },
  {
    label:        'Restricted Book',
    icon:         '📖',
    activeStates: ['nav_library', 'book_active'],
    doneStates:   ['nav_h1', 'spell_active', 'complete'],
  },
  {
    label:        'Spell Challenge',
    icon:         '✨',
    activeStates: ['nav_h1', 'spell_active'],
    doneStates:   ['complete'],
  }
];

const OBJECTIVE: Partial<Record<EvilQuestState, string>> = {
  nav_f7:         'Go to F7 and win the duel',
  duel_active:    'Win the duel to continue',
  nav_building23: 'Go to Building 23 — find the Rare Plant',
  plant_active:   'Find the Rare Plant',
  nav_library:    'Go to Library — find the Restricted Book',
  book_active:    'Find the Restricted Book',
  nav_h1:         'Go to H1 — complete the Spell Challenge',
  spell_active:   'Complete the Spell Challenge',
  complete:       'Quest Complete!',
};

export default function EvilPathQuestBar() {
  const [visible,   setVisible]   = useState(false);
  const [questState, setQuestState] = useState<EvilQuestState>('inactive');
  const [distance,  setDistance]  = useState<number | null>(null);
  const [flash,     setFlash]     = useState(false);
  const [slideIn,   setSlideIn]   = useState(false);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const offUpdate = eventBus.on('EVIL_GUIDANCE_UPDATE', (raw: unknown) => {
      const d = raw as { state: EvilQuestState; distance: number | null };
      if (!d.state || d.state === 'inactive') return;
      setQuestState(d.state);
      if (d.distance !== null) setDistance(d.distance);
      if (!visible) {
        setVisible(true);
        setTimeout(() => setSlideIn(true), 20);
      }
    });

    const offState = eventBus.on('EVIL_GUIDANCE_STATE', (raw: unknown) => {
      const d = raw as { next: EvilQuestState };
      setQuestState(d.next);
      setDistance(null);
      if (d.next !== 'inactive') {
        setVisible(true);
        setTimeout(() => setSlideIn(true), 20);
      }
    });

    const offAdvance = eventBus.on('EVIL_GUIDANCE_ADVANCE', () => {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    });

    const offComplete = eventBus.on('EVIL_GUIDANCE_COMPLETE', () => {
      setQuestState('complete');
      setDistance(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
      // Fade out after 4 seconds
      if (hideRef.current) clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => {
        setSlideIn(false);
        setTimeout(() => setVisible(false), 500);
      }, 4000);
    });

    return () => {
      offUpdate(); offState(); offAdvance(); offComplete();
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const steps: QuestStep[] = STEPS.map(s => ({
    label:  s.label,
    icon:   s.icon,
    status: s.doneStates.includes(questState)
      ? 'done'
      : s.activeStates.includes(questState)
        ? 'active'
        : 'pending',
  }));

  const objective = OBJECTIVE[questState] ?? '';
  const isDuelActive   = questState === 'duel_active';
  const isComplete     = questState === 'complete';

  return (
    <div style={{
      position:   'fixed',
      top:        '18px',
      right:      '18px',
      zIndex:     180,
      minWidth:   240,
      maxWidth:   300,
      fontFamily: '"Press Start 2P", monospace',
      transform:  slideIn ? 'translateX(0)' : 'translateX(110%)',
      opacity:    slideIn ? 1 : 0,
      transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.5s ease',
      // Flash removed so it doesn't blink in and out harshly
    }}>
      {/* Frame */}
      <div style={{
        background:   'linear-gradient(160deg, #0d0020 0%, #12002a 60%, #080018 100%)',
        border:       '1.5px solid #8833cc',
        borderRadius: 8,
        boxShadow:    '0 0 24px rgba(136,51,204,0.45), inset 0 0 14px rgba(136,51,204,0.08)',
        overflow:     'hidden',
      }}>
        {/* Corner runes */}
        <div style={{ position:'absolute', top:5,  left:8,  fontSize:8, color:'#5a2a88', opacity:0.6 }}>✦</div>
        <div style={{ position:'absolute', top:5,  right:8, fontSize:8, color:'#5a2a88', opacity:0.6 }}>✦</div>

        {/* Header */}
        <div style={{
          padding:      '8px 14px 6px',
          borderBottom: '1px solid rgba(136,51,204,0.4)',
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          background:   'linear-gradient(90deg, rgba(136,51,204,0.18) 0%, transparent 100%)',
        }}>
          <span style={{ fontSize:10, color:'#cc88ff', letterSpacing:2 }}>🌑</span>
          <span style={{ fontSize:9,  color:'#cc88ff', letterSpacing:2, fontWeight:'bold' }}>EVIL PATH</span>
        </div>

        {/* Body */}
        <div style={{ padding:'10px 14px 12px', display:'flex', flexDirection:'column', gap:8 }}>

          {/* Current objective */}
          <div style={{
            fontSize:    9,
            color:       isComplete ? '#4ade80' : isDuelActive ? '#ff8888' : '#f0c040',
            lineHeight:  1.7,
            letterSpacing: 0.5,
            textShadow:  isComplete ? '0 0 10px rgba(74,222,128,0.5)' : undefined,
          }}>
            {isComplete ? '✓ QUEST COMPLETE' : objective}
          </div>

          {/* Divider */}
          <div style={{ height:1, background:'linear-gradient(90deg, transparent, rgba(136,51,204,0.5), transparent)' }} />

          {/* Step checklist */}
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
                {/* Status icon */}
                <span style={{ fontSize:10, width:14, textAlign:'center',
                  color: s.status==='done' ? '#4ade80' : s.status==='active' ? '#f0c040' : '#3a2a5a',
                  textShadow: s.status==='done' ? '0 0 8px rgba(74,222,128,0.6)' : s.status==='active' ? '0 0 8px rgba(240,192,64,0.6)' : 'none',
                }}>
                  {s.status==='done' ? '✓' : s.status==='active' ? '▶' : '○'}
                </span>
                {/* Step label */}
                <span style={{
                  fontSize:    8,
                  color:       s.status==='done' ? '#4ade80' : s.status==='active' ? '#ffdf70' : '#3a2a5a',
                  letterSpacing: 0.5,
                  textDecoration: s.status==='done' ? 'line-through' : 'none',
                  opacity:     s.status==='pending' ? 0.5 : 1,
                  textShadow:  s.status==='active' && flash ? '0 0 12px rgba(255,223,112,0.8)' : 'none',
                  transition: 'text-shadow 0.3s ease, color 0.3s ease'
                }}>
                  {s.icon} {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Distance badge */}
          {!isComplete && distance !== null && (
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:2 }}>
              <div style={{
                fontSize:      8,
                color:         '#f0c040',
                background:    'rgba(136,51,204,0.2)',
                border:        '1px solid rgba(136,51,204,0.4)',
                borderRadius:  4,
                padding:       '2px 8px',
                letterSpacing: 1,
              }}>
                {distance}m ▸
              </div>
            </div>
          )}
        </div>

        {/* Bottom glow bar */}
        <div style={{
          height:     2,
          background: isComplete
            ? 'linear-gradient(90deg, transparent, #4ade80, transparent)'
            : 'linear-gradient(90deg, transparent, #8833cc, transparent)',
        }} />
      </div>
    </div>
  );
}
