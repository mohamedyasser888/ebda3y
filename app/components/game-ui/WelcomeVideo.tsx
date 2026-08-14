'use client';

// ============================================================
// WelcomeVideo — Plays a full-screen video after path selection
// ============================================================
import { useRef, useEffect } from 'react';

interface Props {
  onVideoEnd: () => void;
}

export default function WelcomeVideo({ onVideoEnd }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Attempt to auto-play
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('Auto-play prevented:', err);
      });
    }
    
    // Hide the Phaser game container to save GPU and prevent lag
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.style.display = 'none';
    }
    
    return () => {
      // Show it again when video ends
      if (gameContainer) {
        gameContainer.style.display = 'block';
      }
    };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <video
        ref={videoRef}
        src="https://res.cloudinary.com/wjmuvpvo/video/upload/final.mp4"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
        autoPlay
        playsInline
        preload="auto"
        onEnded={onVideoEnd}
      />
      
      {/* Skip button overlay */}
      <button
        onClick={onVideoEnd}
        style={{
          position: 'absolute', bottom: 40, right: 40,
          padding: '12px 24px',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid #F4D03F',
          color: '#F4D03F',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '14px',
          cursor: 'pointer',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(244, 208, 63, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
        }}
      >
        SKIP VIDEO {'>'}
      </button>
    </div>
  );
}
