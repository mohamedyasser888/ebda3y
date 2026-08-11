'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const PhaserGame = dynamic(() => import('./components/PhaserGame'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0114',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20, color: '#F4D03F', fontFamily: '"Press Start 2P", monospace',
    }}>
      <div style={{ fontSize: 52 }}>⚗️</div>
      <div style={{ fontSize: 20, letterSpacing: 3 }}>✦ Entering the Academy ✦</div>
      <div style={{ fontSize: 14, opacity: 0.6, color: '#f5e6c8' }}>Preparing the laboratory...</div>
    </div>
  ),
});

const GameUI = dynamic(() => import('./components/GameUI'), { ssr: false });

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);

  if (gameStarted) {
    return (
      <main style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0114' }}>
        <PhaserGame />
        <GameUI />
      </main>
    );
  }

  return <LandingPage onStart={() => setGameStarted(true)} />;
}

function LandingPage({ onStart }: { onStart: () => void }) {
  // Generate 60 stars with fixed math to avoid hydration issues
  const stars = Array.from({ length: 60 }, (_, i) => {
    const seedX = Math.sin(i + 1) * 10000;
    const seedY = Math.cos(i + 1) * 10000;
    const left = Math.abs(seedX - Math.floor(seedX)) * 100;
    const top = Math.abs(seedY - Math.floor(seedY)) * 100;
    const duration = 2 + (i % 4);
    const delay = (i % 6) * 0.5;
    return { left, top, duration, delay };
  });

  return (
    <div className="landing-bg">
      {/* Stars layer */}
      <div className="landing-stars">
        {stars.map((star, i) => (
          <div
            key={i}
            className="landing-star-dot"
            style={{
              position: 'absolute',
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: '4px',
              height: '4px',
              backgroundColor: '#fff',
              borderRadius: '50%',
              animation: `twinkle ${star.duration}s infinite ease-in-out`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Crescent Moon */}
      <div className="landing-moon" />

      {/* Main content */}
      <div className="landing-content">
        {/* Academy Icon */}
        <div className="landing-icon">🏰</div>

        {/* Title & Subtitle */}
        <h1 className="landing-title">Magical Potion Academy</h1>
        <h2 className="landing-subtitle">Master the Art of Alchemy</h2>

        {/* Feature Badges */}
        <div className="landing-badges">
          <div className="landing-badge">10 Unique Potions</div>
          <div className="landing-badge">13 Magical Ingredients</div>
          <div className="landing-badge">Walk & Explore</div>
          <div className="landing-badge">Earn XP & Level Up</div>
        </div>

        {/* Enter Button */}
        <button className="landing-enter-btn" onClick={onStart}>
          ✦ ENTER THE ACADEMY ✦
        </button>
      </div>
    </div>
  );
}
