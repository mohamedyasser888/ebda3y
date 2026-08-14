'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const PhaserGame = dynamic(() => import('./components/PhaserGame'), {
  ssr: false,
  loading: () => (
    <div style={{
      position: 'fixed', inset: 0, background: '#060010',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20, color: '#e8c97a',
      fontFamily: '"Cinzel", "Press Start 2P", serif',
    }}>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🏰</div>
      <div style={{ fontSize: 28, letterSpacing: 6, fontWeight: 700 }}>What If</div>
      <div style={{ fontSize: 13, opacity: 0.5, color: '#c8a96e', letterSpacing: 2, marginTop: 4 }}>Entering the Academy...</div>
    </div>
  ),
});

const GameUI = dynamic(() => import('./components/GameUI'), { ssr: false });

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false);

  // Set up background music
  useEffect(() => {
    const introAudio = document.getElementById('bg-music-intro') as HTMLAudioElement | null;
    if (introAudio) {
      introAudio.volume = 0.05; // Keep it very low so video voiceover is clear
      introAudio.play().catch(() => {
        // Browsers block autoplay until interaction. It's okay, it will 
        // play when the user clicks 'Enter'. Or we can listen to first click.
        const onInteract = () => {
          introAudio.play().catch(() => {});
          document.removeEventListener('click', onInteract);
        };
        document.addEventListener('click', onInteract);
      });
    }

    const gameAudio = document.getElementById('bg-music-game') as HTMLAudioElement | null;
    if (gameAudio) {
      gameAudio.volume = 0.05;
    }
  }, []);

  return (
    <>
      <audio id="bg-music-intro" src="/music.mp3" loop autoPlay />
      <audio id="bg-music-game" src="/game_light.mp3" loop />
      {gameStarted ? (
        <main style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0a0114' }}>
          <PhaserGame />
          <GameUI />
        </main>
      ) : (
        <LandingPage onStart={() => setGameStarted(true)} />
      )}
    </>
  );
}

function LandingPage({ onStart }: { onStart: () => void }) {
  // Keyboard Enter support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') onStart(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  const stars = Array.from({ length: 80 }, (_, i) => {
    const seedX = Math.sin(i + 1) * 10000;
    const seedY = Math.cos(i + 1) * 10000;
    const left = Math.abs(seedX - Math.floor(seedX)) * 100;
    const top = Math.abs(seedY - Math.floor(seedY)) * 100;
    const size = 1.5 + (i % 3) * 1.2;
    const duration = 2.5 + (i % 5);
    const delay = (i % 7) * 0.4;
    return { left, top, size, duration, delay };
  });

  return (
    <div className="landing-bg">
      {/* Stars */}
      <div className="landing-stars">
        {stars.map((star, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              backgroundColor: i % 4 === 0 ? '#ffd580' : '#ffffff',
              borderRadius: '50%',
              animation: `twinkle ${star.duration}s infinite ease-in-out`,
              animationDelay: `${star.delay}s`,
              opacity: 0.15,
            }}
          />
        ))}
      </div>

      {/* Ambient orb glow */}
      <div className="landing-orb landing-orb--left" />
      <div className="landing-orb landing-orb--right" />

      {/* Main content */}
      <div className="landing-content">
        {/* Eyebrow */}
        <div className="landing-eyebrow">✦ &nbsp; A Magical Journey Awaits &nbsp; ✦</div>

        {/* Castle icon */}
        <div className="landing-icon">🏰</div>

        {/* Title */}
        <h1 className="landing-title">What If</h1>

        {/* Subtitle */}
        <p className="landing-subtitle">Enter the Academy. Begin Your Adventure.</p>

        {/* Divider */}
        <div className="landing-divider">
          <span className="landing-divider__line" />
          <span className="landing-divider__gem">◆</span>
          <span className="landing-divider__line" />
        </div>

        {/* CTA */}
        <button className="landing-enter-btn" onClick={onStart}>
          <span className="landing-enter-btn__inner">
            Begin Your Adventure
          </span>
        </button>

        <p className="landing-hint">Press Enter or click to start</p>
      </div>
    </div>
  );
}
