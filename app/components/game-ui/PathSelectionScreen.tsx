'use client';
// ============================================================
// PathSelectionScreen — Good / Evil path opening sequence
// Shows ONCE on new game before OutdoorWorldScene starts.
// Full-screen cinematic Arabic magical UI.
// ============================================================
import React, { useState, useEffect, useRef } from 'react';

interface Props {
  onSelect: (path: 'good' | 'evil') => void;
}

export default function PathSelectionScreen({ onSelect }: Props) {
  const [phase, setPhase]         = useState<'intro' | 'choose' | 'chosen' | 'exit'>('intro');
  const [chosen, setChosen]       = useState<'good' | 'evil' | null>(null);
  const [lineIdx, setLineIdx]     = useState(0);
  const [hovered, setHovered]     = useState<'good' | 'evil' | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── Arabic message lines ─────────────────────────────────
  const LINES = [
    'لقد بدأت رحلتك الآن...',
    'أمامك طريقان، وكلٌ منهما يخفي أسرارًا لا تعرفها.',
    'أحدهما يقودك نحو النور...',
    'والآخر نحو الظلام.',
    'اختر طريقك، وتذكّر...',
    ' يمكنك دائمًا العودة.',
  ];

  // ── Animated text reveal ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'intro') return;
    if (lineIdx >= LINES.length) {
      setTimeout(() => setPhase('choose'), 900);
      return;
    }
    const t = setTimeout(() => setLineIdx(i => i + 1), lineIdx === 0 ? 1200 : 1600);
    return () => clearTimeout(t);
  }, [phase, lineIdx]);

  // ── Particle system on canvas ────────────────────────────
  type Particle = { x: number; y: number; vx: number; vy: number; r: number; a: number; col: string; life: number; maxLife: number };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width  = window.innerWidth;
    const H = canvas.height = window.innerHeight;

    const pts: Particle[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5, vy: -0.4 - Math.random() * 0.6,
      r: 1 + Math.random() * 2.5,
      a: Math.random(),
      col: Math.random() > 0.5 ? '#b388ff' : '#ffd700',
      life: Math.random() * 200, maxLife: 160 + Math.random() * 80,
    }));

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.life++;
        if (p.life > p.maxLife) { p.life = 0; p.x = Math.random()*W; p.y = H + 10; }
        p.x += p.vx; p.y += p.vy;
        const lifeRatio = p.life / p.maxLife;
        const alpha = lifeRatio < 0.2 ? lifeRatio/0.2 : lifeRatio > 0.8 ? (1-lifeRatio)/0.2 : 1;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
        // sparkle cross
        if (p.r > 2) {
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillRect(p.x - 3, p.y - 0.5, 6, 1);
          ctx.fillRect(p.x - 0.5, p.y - 3, 1, 6);
        }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Handle selection ─────────────────────────────────────
  const handlePick = (path: 'good' | 'evil') => {
    setChosen(path);
    setPhase('chosen');
    setTimeout(() => {
      setPhase('exit');
      setTimeout(() => onSelect(path), 800);
    }, 1400);
  };

  // ── Shared card style ────────────────────────────────────
  const cardBase: React.CSSProperties = {
    position:        'relative',
    width:           280,
    padding:         '32px 24px',
    borderRadius:    12,
    cursor:          'pointer',
    textAlign:       'center',
    fontFamily:      '"Press Start 2P", monospace',
    transition:      'transform 0.25s, box-shadow 0.25s',
    userSelect:      'none',
  };

  const goodCard: React.CSSProperties = {
    ...cardBase,
    background:  'linear-gradient(160deg, #1a1060 0%, #2a1880 50%, #120840 100%)',
    border:      `2px solid ${hovered==='good' ? '#ffd700' : '#8855cc'}`,
    boxShadow:   hovered==='good'
      ? '0 0 40px rgba(255,215,0,0.55), 0 0 14px rgba(255,215,0,0.35), inset 0 0 20px rgba(255,215,0,0.08)'
      : '0 0 18px rgba(136,85,204,0.35)',
    transform:   hovered==='good' ? 'scale(1.06) translateY(-4px)' : 'scale(1)',
    opacity:     chosen && chosen!=='good' ? 0.35 : 1,
  };

  const evilCard: React.CSSProperties = {
    ...cardBase,
    background:  'linear-gradient(160deg, #1a0010 0%, #2a0020 50%, #0a000a 100%)',
    border:      `2px solid ${hovered==='evil' ? '#ff3a3a' : '#660022'}`,
    boxShadow:   hovered==='evil'
      ? '0 0 40px rgba(255,58,58,0.55), 0 0 14px rgba(255,58,58,0.35), inset 0 0 20px rgba(255,58,58,0.08)'
      : '0 0 18px rgba(102,0,34,0.35)',
    transform:   hovered==='evil' ? 'scale(1.06) translateY(-4px)' : 'scale(1)',
    opacity:     chosen && chosen!=='evil' ? 0.35 : 1,
  };

  return (
    <div style={{
      position:       'fixed', inset: 0, zIndex: 9000,
      background:     'radial-gradient(ellipse at 50% 30%, #0e0630 0%, #050112 60%, #000000 100%)',
      display:        'flex', flexDirection: 'column',
      alignItems:     'center', justifyContent: 'center',
      opacity:        phase === 'exit' ? 0 : 1,
      transition:     'opacity 0.8s ease',
      overflow:       'hidden',
      fontFamily:     '"Press Start 2P", monospace',
    }}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }} />

      {/* Decorative top/bottom borders */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:4,
        background:'linear-gradient(90deg, transparent, #b388ff 30%, #ffd700 50%, #b388ff 70%, transparent)', zIndex:1 }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4,
        background:'linear-gradient(90deg, transparent, #b388ff 30%, #ffd700 50%, #b388ff 70%, transparent)', zIndex:1 }} />

      {/* Inner content */}
      <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', maxWidth:760, padding:'0 28px', gap:32 }}>

        {/* Decorative star */}
        <div style={{ fontSize:38, animation:'pathPulse 2.4s ease-in-out infinite', marginBottom:-8 }}>✦</div>

        {/* Arabic intro lines */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, textAlign:'center' }}>
          {LINES.map((line, i) => (
            <div key={i} style={{
              fontSize:     i===0||i===5 ? 15 : 12,
              color:        i===0 ? '#ffd700' : i===5 ? '#ff9944' : '#e2d9f3',
              opacity:      i < lineIdx ? 1 : 0,
              transform:    i < lineIdx ? 'translateY(0)' : 'translateY(12px)',
              transition:   'opacity 0.8s ease, transform 0.8s ease',
              letterSpacing: 1,
              lineHeight:   2.2,
              direction:    'rtl',
              textShadow:   i===0 ? '0 0 18px rgba(255,215,0,0.6)' : i===5 ? '0 0 14px rgba(255,153,68,0.5)' : 'none',
            }}>
              {line}
            </div>
          ))}
        </div>

        {/* Choice prompt + cards */}
        {phase === 'choose' || phase === 'chosen' ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:28,
            animation:'pathFadeIn 0.8s ease forwards', opacity:0 }}>
            <div style={{ fontSize:13, color:'#cc99ff', letterSpacing:2, direction:'rtl', textShadow:'0 0 12px rgba(204,153,255,0.5)' }}>
              أي طريق ستختار؟
            </div>

            <div style={{ display:'flex', gap:40, flexWrap:'wrap', justifyContent:'center' }}>
              {/* Good */}
              <div
                style={goodCard}
                onMouseEnter={() => setHovered('good')}
                onMouseLeave={() => setHovered(null)}
                onClick={() => phase === 'choose' && handlePick('good')}
              >
                <div style={{ fontSize:44, marginBottom:14, filter: hovered==='good'||chosen==='good' ? 'drop-shadow(0 0 14px gold)' : 'none' }}>✨</div>
                <div style={{ fontSize:12, color: chosen==='good' ? '#ffd700' : '#e2d9f3', letterSpacing:2, direction:'rtl', lineHeight:2.2, textShadow: chosen==='good' ? '0 0 16px rgba(255,215,0,0.8)' : 'none' }}>
                  طريق الخير
                </div>
                {chosen==='good' && (
                  <div style={{ position:'absolute', inset:0, borderRadius:12, border:'2px solid #ffd700', boxShadow:'0 0 40px rgba(255,215,0,0.5), inset 0 0 30px rgba(255,215,0,0.12)', animation:'pathPulse 0.6s ease infinite', pointerEvents:'none' }} />
                )}
              </div>

              {/* Evil */}
              <div
                style={evilCard}
                onMouseEnter={() => setHovered('evil')}
                onMouseLeave={() => setHovered(null)}
                onClick={() => phase === 'choose' && handlePick('evil')}
              >
                <div style={{ fontSize:44, marginBottom:14, filter: hovered==='evil'||chosen==='evil' ? 'drop-shadow(0 0 14px #ff4444)' : 'none' }}>🌑</div>
                <div style={{ fontSize:12, color: chosen==='evil' ? '#ff8888' : '#e2d9f3', letterSpacing:2, direction:'rtl', lineHeight:2.2, textShadow: chosen==='evil' ? '0 0 16px rgba(255,80,80,0.8)' : 'none' }}>
                  طريق الشر
                </div>
                {chosen==='evil' && (
                  <div style={{ position:'absolute', inset:0, borderRadius:12, border:'2px solid #ff4444', boxShadow:'0 0 40px rgba(255,68,68,0.5), inset 0 0 30px rgba(255,68,68,0.12)', animation:'pathPulse 0.6s ease infinite', pointerEvents:'none' }} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes pathPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
        @keyframes pathFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
