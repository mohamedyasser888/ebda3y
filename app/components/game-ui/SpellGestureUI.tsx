'use client';

// ============================================================
// SpellGestureUI — Full-screen mouse-gesture spell training overlay.
// The player traces a magical path on a canvas to learn each spell.
// ============================================================
import { useRef, useEffect, useCallback, useState } from 'react';

// ── Types ──────────────────────────────────────────────────
export type SpellName = 'lumos' | 'nox' | 'expelliarmus';

interface Props {
  spell: SpellName;
  onClose: (learned: boolean) => void;
}

interface TrajectoryPoint { x: number; y: number; }

interface TrailPoint { x: number; y: number; t: number; }

// ── Trajectory definitions (% of canvas W/H) ────────────────
const TRAJECTORIES: Record<SpellName, TrajectoryPoint[]> = {
  lumos: [
    { x: 0.25, y: 0.70 },
    { x: 0.30, y: 0.55 },
    { x: 0.40, y: 0.45 },
    { x: 0.50, y: 0.42 },
    { x: 0.60, y: 0.45 },
    { x: 0.68, y: 0.55 },
    { x: 0.72, y: 0.65 },
  ],
  nox: [
    { x: 0.30, y: 0.35 },
    { x: 0.38, y: 0.42 },
    { x: 0.45, y: 0.52 },
    { x: 0.50, y: 0.58 },
    { x: 0.55, y: 0.52 },
    { x: 0.62, y: 0.42 },
    { x: 0.68, y: 0.35 },
  ],
  expelliarmus: [
    { x: 0.22, y: 0.60 },
    { x: 0.32, y: 0.48 },
    { x: 0.44, y: 0.40 },
    { x: 0.56, y: 0.44 },
    { x: 0.64, y: 0.56 },
    { x: 0.68, y: 0.68 },
    { x: 0.72, y: 0.55 },
    { x: 0.76, y: 0.42 },
  ],
};

// ── Spell colours ────────────────────────────────────────────
const SPELL_COLORS: Record<SpellName, { primary: string; glow: string; rgb: string }> = {
  lumos:        { primary: '#ffd700', glow: '#fff3b0', rgb: '255,215,0'   },
  nox:          { primary: '#6644ff', glow: '#aabbff', rgb: '102,68,255'  },
  expelliarmus: { primary: '#ff4444', glow: '#ffaaaa', rgb: '255,68,68'   },
};

const SPELL_LABELS: Record<SpellName, string> = {
  lumos:        'LUMOS',
  nox:          'NOX',
  expelliarmus: 'EXPELLIARMUS',
};

const INSTRUCTOR_NAMES: Record<SpellName, string> = {
  lumos:        'Clara',
  nox:          'Valeria',
  expelliarmus: 'Elvarinth',
};

// Tolerance / thresholds
const START_RADIUS_PX   = 60;
const END_RADIUS_PX     = 60;
const OFFPATH_TOL_PX    = 55;
const OFFPATH_FAIL_MS   = 500;
const TRAIL_FADE_MS     = 200;

// ════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════
export default function SpellGestureUI({ spell, onClose }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);

  // Drawing state (kept in refs to avoid re-renders inside canvas loop)
  const isDrawing      = useRef(false);
  const trailPoints    = useRef<TrailPoint[]>([]);
  const offPathSince   = useRef<number | null>(null);
  const progressRef    = useRef(0);
  const animRef        = useRef<number | null>(null);
  const pulseT         = useRef(0);

  // React UI state
  const [status,   setStatus]   = useState<'idle' | 'drawing' | 'success' | 'fail'>('idle');
  const [progress, setProgress] = useState(0);
  const [flashColor, setFlashColor] = useState<string | null>(null);

  const traj    = TRAJECTORIES[spell];
  const colors  = SPELL_COLORS[spell];

  // ── Resolve canvas-space trajectory points ──────────────────
  const getCanvasPoints = useCallback((): { x: number; y: number }[] => {
    const cv = canvasRef.current;
    if (!cv) return [];
    return traj.map((p) => ({ x: p.x * cv.width, y: p.y * cv.height }));
  }, [traj]);

  // ── Distance from point to line segment ─────────────────────
  const distToSegment = (
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): number => {
    const abx = bx - ax, aby = by - ay;
    const len2 = abx * abx + aby * aby;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / len2));
    return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
  };

  // ── Closest distance from (mx,my) to any trajectory segment ──
  const distToTrajectory = useCallback(
    (mx: number, my: number, pts: { x: number; y: number }[]): number => {
      let min = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        min = Math.min(min, distToSegment(mx, my, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
      }
      return min;
    },
    [],
  );

  // ── Progress along trajectory (0–1) ──────────────────────────
  const calcProgress = useCallback(
    (mx: number, my: number, pts: { x: number; y: number }[]): number => {
      if (pts.length < 2) return 0;
      let totalLen = 0;
      const segLens: number[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        segLens.push(d);
        totalLen += d;
      }
      // Find closest segment
      let bestSeg = 0, bestT = 0, bestDist = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i].x, ay = pts[i].y;
        const bx = pts[i + 1].x, by = pts[i + 1].y;
        const abx = bx - ax, aby = by - ay;
        const len2 = abx * abx + aby * aby;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((mx - ax) * abx + (my - ay) * aby) / len2));
        const d = Math.hypot(mx - (ax + t * abx), my - (ay + t * aby));
        if (d < bestDist) { bestDist = d; bestSeg = i; bestT = t; }
      }
      let covered = 0;
      for (let i = 0; i < bestSeg; i++) covered += segLens[i];
      covered += bestT * segLens[bestSeg];
      return Math.min(1, covered / totalLen);
    },
    [],
  );

  // ── Canvas mouse coords ───────────────────────────────────────
  const getCanvasXY = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width  / rect.width;
    const scaleY = cv.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  // ── Draw glowing dashed trajectory path ──────────────────────
  const drawTrajectory = useCallback(
    (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], cw: number) => {
      if (pts.length < 2) return;

      // Outer glow
      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur  = 28;
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth   = cw * 0.012;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([cw * 0.028, cw * 0.018]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();

      // Inner bright line
      ctx.save();
      ctx.shadowColor = colors.primary;
      ctx.shadowBlur  = 14;
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth   = cw * 0.006;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.setLineDash([cw * 0.022, cw * 0.015]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
    },
    [colors],
  );

  // ── Draw START marker (pulsing circle) ──────────────────────
  const drawStart = useCallback(
    (ctx: CanvasRenderingContext2D, p: { x: number; y: number }, cw: number, t: number) => {
      const r = cw * 0.025 + Math.sin(t * 0.004) * cw * 0.006;
      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur  = 20;
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = colors.primary + '33';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Label
      ctx.save();
      ctx.fillStyle = colors.primary;
      ctx.font      = `bold ${Math.round(cw * 0.016)}px monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur  = 8;
      ctx.fillText('START HERE ✦', p.x, p.y - r - 8);
      ctx.restore();
    },
    [colors],
  );

  // ── Draw END marker (star) ───────────────────────────────────
  const drawEnd = useCallback(
    (ctx: CanvasRenderingContext2D, p: { x: number; y: number }, cw: number) => {
      const r   = cw * 0.028;
      const pts = 5;
      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur  = 22;
      ctx.fillStyle   = colors.primary;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const angle = (i * Math.PI) / pts - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.42;
        const sx = p.x + Math.cos(angle) * radius;
        const sy = p.y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Label
      ctx.save();
      ctx.fillStyle = colors.primary;
      ctx.font      = `bold ${Math.round(cw * 0.016)}px monospace`;
      ctx.textAlign = 'center';
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur  = 8;
      ctx.fillText('END ✦', p.x, p.y + r + 20);
      ctx.restore();
    },
    [colors],
  );

  // ── Draw glowing trail ──────────────────────────────────────
  const drawTrail = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const now = performance.now();
      const pts = trailPoints.current.filter((p) => now - p.t < TRAIL_FADE_MS);
      trailPoints.current = pts;
      if (pts.length < 2) return;

      ctx.save();
      for (let i = 1; i < pts.length; i++) {
        const age   = (now - pts[i].t) / TRAIL_FADE_MS;
        const alpha = 1 - age;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = `rgba(${colors.rgb},${alpha.toFixed(2)})`;
        ctx.lineWidth   = 7 * alpha;
        ctx.lineCap     = 'round';
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur  = 18 * alpha;
        ctx.stroke();
      }
      ctx.restore();
    },
    [colors],
  );

  // ── Main render loop ────────────────────────────────────────
  const renderLoop = useCallback(() => {
    const cv  = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    pulseT.current += 16;
    const pts = getCanvasPoints();

    ctx.clearRect(0, 0, cv.width, cv.height);

    // Background particles
    // (static — drawn once via CSS; animated particles kept light)

    drawTrajectory(ctx, pts, cv.width);

    if (pts.length > 0) {
      drawStart(ctx, pts[0], cv.width, pulseT.current);
      drawEnd(ctx, pts[pts.length - 1], cv.width);
    }

    // Progress indicator along path
    if (progressRef.current > 0 && progressRef.current < 1) {
      const prog = progressRef.current;
      // Interpolate along segments
      let totalLen = 0;
      const segs: number[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        segs.push(d);
        totalLen += d;
      }
      const target = prog * totalLen;
      let acc = 0;
      let progX = pts[0].x, progY = pts[0].y;
      for (let i = 0; i < segs.length; i++) {
        if (acc + segs[i] >= target) {
          const t2 = (target - acc) / segs[i];
          progX = pts[i].x + t2 * (pts[i + 1].x - pts[i].x);
          progY = pts[i].y + t2 * (pts[i + 1].y - pts[i].y);
          break;
        }
        acc += segs[i];
      }
      // Dot on progress
      ctx.save();
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur  = 16;
      ctx.fillStyle   = colors.primary;
      ctx.beginPath();
      ctx.arc(progX, progY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawTrail(ctx);

    animRef.current = requestAnimationFrame(renderLoop);
  }, [getCanvasPoints, drawTrajectory, drawStart, drawEnd, drawTrail, colors]);

  // ── Start render loop ────────────────────────────────────────
  useEffect(() => {
    animRef.current = requestAnimationFrame(renderLoop);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [renderLoop]);

  // ── Resize canvas ────────────────────────────────────────────
  useEffect(() => {
    const cv   = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const resize = () => {
      cv.width  = wrap.clientWidth;
      cv.height = wrap.clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ── Mouse / Touch handlers ────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (status === 'success') return;
      const native = e.nativeEvent as MouseEvent | TouchEvent;
      const { x, y } = getCanvasXY(native);
      const pts = getCanvasPoints();
      if (pts.length === 0) return;

      const dist = Math.hypot(x - pts[0].x, y - pts[0].y);
      if (dist > START_RADIUS_PX) return; // must start near START

      isDrawing.current   = true;
      trailPoints.current = [{ x, y, t: performance.now() }];
      offPathSince.current = null;
      progressRef.current  = 0;
      setStatus('drawing');
      setProgress(0);
    },
    [status, getCanvasPoints],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (!isDrawing.current) return;
      const native = e.nativeEvent as MouseEvent | TouchEvent;
      const { x, y } = getCanvasXY(native);
      const pts = getCanvasPoints();

      trailPoints.current.push({ x, y, t: performance.now() });

      // Check off-path
      const dist = distToTrajectory(x, y, pts);
      const now  = performance.now();
      if (dist > OFFPATH_TOL_PX) {
        if (offPathSince.current === null) offPathSince.current = now;
        else if (now - offPathSince.current > OFFPATH_FAIL_MS) {
          // FAIL
          isDrawing.current    = false;
          offPathSince.current = null;
          progressRef.current  = 0;
          setStatus('fail');
          setFlashColor('#ff0000');
          setTimeout(() => setFlashColor(null), 300);
          setTimeout(() => setStatus('idle'), 1500);
          return;
        }
      } else {
        offPathSince.current = null;
      }

      // Update progress
      const prog = calcProgress(x, y, pts);
      progressRef.current = prog;
      setProgress(Math.round(prog * 100));

      // Check END reached
      const end = pts[pts.length - 1];
      if (Math.hypot(x - end.x, y - end.y) < END_RADIUS_PX && prog > 0.75) {
        isDrawing.current = false;
        progressRef.current = 1;
        setProgress(100);
        setStatus('success');
        setFlashColor(colors.primary);
        setTimeout(() => {
          setFlashColor(null);
          onClose(true);
        }, 2000);
      }
    },
    [getCanvasPoints, distToTrajectory, calcProgress, colors, onClose],
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing.current) {
      isDrawing.current    = false;
      offPathSince.current = null;
      if (status === 'drawing') {
        setStatus('idle');
        progressRef.current = 0;
        setProgress(0);
      }
    }
  }, [status]);

  // ── Escape key closes ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  const colPrimary = colors.primary;
  const colGlow    = colors.glow;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'radial-gradient(ellipse at 50% 50%, #0d0020 0%, #020008 100%)',
        fontFamily: 'monospace',
        userSelect: 'none',
      }}
    >
      {/* Flash overlay */}
      {flashColor && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: flashColor,
            opacity: 0.22, pointerEvents: 'none',
            animation: 'flashIn 0.3s ease-out',
          }}
        />
      )}

      {/* ── Header ── */}
      <div style={{
        width: '100%', padding: '18px 32px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontSize: 'clamp(22px, 4vw, 44px)', fontWeight: 900, letterSpacing: 8,
            color: colPrimary,
            textShadow: `0 0 24px ${colGlow}, 0 0 60px ${colPrimary}`,
          }}>
            {SPELL_LABELS[spell]}
          </div>
          <div style={{
            fontSize: 'clamp(11px, 1.5vw, 16px)', color: '#aaaacc',
            marginTop: 4, letterSpacing: 2,
          }}>
            Instructor: <span style={{ color: colGlow }}>{INSTRUCTOR_NAMES[spell]}</span>
          </div>
        </div>

        <button
          id="spell-give-up-btn"
          onClick={() => onClose(false)}
          style={{
            background: '#1a0030', border: `1px solid #553366`,
            color: '#bb88cc', padding: '8px 20px',
            borderRadius: 6, cursor: 'pointer', fontSize: 13,
            fontFamily: 'monospace', letterSpacing: 2,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#2a0050';
            (e.currentTarget as HTMLButtonElement).style.color = '#ff88cc';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#1a0030';
            (e.currentTarget as HTMLButtonElement).style.color = '#bb88cc';
          }}
        >
          Give Up
        </button>
      </div>

      {/* ── Instruction ── */}
      <div style={{
        fontSize: 'clamp(11px, 1.5vw, 15px)', color: '#9988bb',
        letterSpacing: 3, marginTop: 8, textAlign: 'center', flexShrink: 0,
      }}>
        Follow the magical path with your mouse
      </div>

      {/* ── Canvas Area ── */}
      <div
        ref={wrapRef}
        style={{
          flex: 1, width: '72%', minHeight: 0,
          position: 'relative', marginTop: 12, marginBottom: 12,
          borderRadius: 18,
          border: `2px solid ${colPrimary}44`,
          boxShadow: `0 0 40px ${colPrimary}22, inset 0 0 60px #0a001888`,
          background: '#0a001488',
          overflow: 'hidden',
        }}
      >
        <canvas
          id="spell-gesture-canvas"
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        />

        {/* Status overlays */}
        {status === 'fail' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 'clamp(18px, 3vw, 32px)', color: '#ff4444', fontWeight: 900,
              textShadow: '0 0 20px #ff4444',
              animation: 'pulseIn 0.3s ease-out',
            }}>
              ✗ Spell path lost!
            </div>
            <div style={{ fontSize: 'clamp(12px, 1.5vw, 16px)', color: '#ff8888', marginTop: 8 }}>
              Try again.
            </div>
          </div>
        )}

        {status === 'success' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: `radial-gradient(ellipse, ${colPrimary}22 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 'clamp(28px, 5vw, 58px)', fontWeight: 900, letterSpacing: 6,
              color: colPrimary,
              textShadow: `0 0 30px ${colGlow}, 0 0 80px ${colPrimary}`,
              animation: 'successPop 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              {SPELL_LABELS[spell]}
            </div>
            <div style={{
              fontSize: 'clamp(18px, 2.5vw, 28px)', color: colGlow,
              letterSpacing: 8, marginTop: 12,
              textShadow: `0 0 16px ${colGlow}`,
            }}>
              ✦ LEARNED! ✦
            </div>
            {/* Sparkle ring */}
            <div style={{
              position: 'absolute', width: 220, height: 220,
              borderRadius: '50%',
              border: `3px solid ${colPrimary}`,
              boxShadow: `0 0 40px ${colPrimary}, inset 0 0 40px ${colPrimary}44`,
              animation: 'ringExpand 1.8s ease-out forwards',
              pointerEvents: 'none',
            }} />
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        width: '72%', flexShrink: 0, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          flex: 1, height: 8, background: '#1a0030',
          borderRadius: 4, overflow: 'hidden',
          border: `1px solid ${colPrimary}44`,
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: `linear-gradient(90deg, ${colPrimary}88, ${colPrimary})`,
            boxShadow: `0 0 12px ${colPrimary}`,
            borderRadius: 4,
            transition: 'width 0.1s linear',
          }} />
        </div>
        <span style={{ color: colGlow, fontSize: 13, minWidth: 40 }}>
          {progress}%
        </span>
      </div>

      {/* ── CSS animations ── */}
      <style>{`
        @keyframes flashIn {
          0%   { opacity: 0.35; }
          100% { opacity: 0; }
        }
        @keyframes pulseIn {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes successPop {
          0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          70%  { transform: scale(1.08) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes ringExpand {
          0%   { transform: scale(0.1); opacity: 1; }
          100% { transform: scale(5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
