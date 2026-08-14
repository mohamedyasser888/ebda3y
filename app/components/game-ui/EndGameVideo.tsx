'use client';

// ============================================================
// EndGameVideo — Plays the final sequence of videos and shows
// a closing screen.
// Sequence: [happy/sad].mp4 → end.mp4 → Closing Screen
// ============================================================
import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  path: 'good' | 'evil';
}

export default function EndGameVideo({ path }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const endScheduled = useRef(false);

  // Correct paths: happy.mp4 for good, sad.mp4 for evil
  const video1Src = path === 'evil' ? 'https://res.cloudinary.com/wjmuvpvo/video/upload/sad.mp4' : 'https://res.cloudinary.com/wjmuvpvo/video/upload/happy.mp4';

  useEffect(() => {
    // Hide the Phaser game container to save GPU and prevent lag
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.style.display = 'none';
    }

    // Stop any game music
    const gameAudio = document.getElementById('bg-music-game') as HTMLAudioElement | null;
    if (gameAudio) gameAudio.pause();
    const introAudio = document.getElementById('bg-music-intro') as HTMLAudioElement | null;
    if (introAudio) introAudio.pause();

    return () => {
      // Show it again if unmounted
      if (gameContainer) {
        gameContainer.style.display = 'block';
      }
    };
  }, []);

  // Robust: play end.mp4 when step becomes 2
  const playEndVideo = useCallback(() => {
    if (endScheduled.current) return;
    endScheduled.current = true;
    setStep(2);
  }, []);

  // When step changes to 2, play end.mp4 explicitly with full fallback chain
  useEffect(() => {
    if (step !== 2) return;
    const vid = video2Ref.current;
    if (!vid) return;

    const tryPlay = () => {
      const p = vid.play();
      if (p !== undefined) {
        p.catch(() => {
          // Autoplay blocked — try muted first, then unmute
          vid.muted = true;
          vid.play()
            .then(() => { vid.muted = false; })
            .catch(() => {
              // Absolute last resort: wait for a click then play
              const onClick = () => {
                vid.muted = false;
                vid.play().catch(() => setStep(3));
                document.removeEventListener('click', onClick);
              };
              document.addEventListener('click', onClick, { once: true });
            });
        });
      }
    };

    if (vid.readyState >= 3) {
      tryPlay();
    } else {
      vid.addEventListener('canplay', tryPlay, { once: true });
      // If still not loading, force it
      if (vid.networkState === HTMLMediaElement.NETWORK_IDLE ||
          vid.networkState === HTMLMediaElement.NETWORK_EMPTY) {
        vid.load();
      }
    }
  }, [step]);

  if (step === 3) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#060010',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '30px'
      }}>
        <h1 style={{
          fontFamily: '"Cinzel", Georgia, serif',
          fontSize: '48px',
          color: '#f4d03f',
          textShadow: '0 0 20px rgba(244,208,63,0.5)',
          margin: 0
        }}>
          You were amazing!
        </h1>
        <p style={{
          fontFamily: '"Cinzel", Georgia, serif',
          fontSize: '18px',
          color: '#9b7ed4',
          letterSpacing: '2px',
          marginTop: '-10px'
        }}>
          Thank you for playing What If
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '16px 32px',
            background: 'rgba(0, 0, 0, 0.6)',
            border: '2px solid #F4D03F',
            color: '#F4D03F',
            fontFamily: '"Cinzel", Georgia, serif',
            fontWeight: 'bold',
            fontSize: '18px',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.3s ease',
            boxShadow: '0 0 15px rgba(244,208,63,0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(244, 208, 63, 0.15)';
            e.currentTarget.style.boxShadow = '0 0 25px rgba(244,208,63,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(244,208,63,0.2)';
          }}
        >
          Return Home
        </button>
      </div>
    );
  }

  const skipVideo = () => {
    if (step === 1) playEndVideo();
    else if (step === 2) setStep(3);
  };

  const baseVideoStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    transform: 'translateZ(0)', // Hardware acceleration
    backgroundColor: '#000',
    transition: 'opacity 0.3s ease'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column'
    }}>

      {/* Video 1: happy.mp4 (good path) or sad.mp4 (evil path) */}
      <video
        ref={video1Ref}
        src={video1Src}
        style={{
          ...baseVideoStyle,
          opacity: step === 1 ? 1 : 0,
          zIndex: step === 1 ? 2 : 1,
          pointerEvents: step === 1 ? 'auto' : 'none'
        }}
        autoPlay
        playsInline
        preload="auto"
        onEnded={playEndVideo}
        onError={playEndVideo}
      />

      {/* Video 2: end.mp4 — preloaded immediately, shown on step 2 */}
      <video
        ref={video2Ref}
        src="https://res.cloudinary.com/wjmuvpvo/video/upload/end.mp4"
        style={{
          ...baseVideoStyle,
          opacity: step === 2 ? 1 : 0,
          zIndex: step === 2 ? 2 : 1,
          pointerEvents: step === 2 ? 'auto' : 'none'
        }}
        playsInline
        preload="auto"
        onEnded={() => setStep(3)}
        onError={() => setStep(3)}
      />

      {/* Skip button overlay */}
      <button
        onClick={skipVideo}
        style={{
          position: 'absolute', bottom: 40, right: 40, zIndex: 10,
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
