'use client';

// ============================================================
// PhaserGame — Mounts the Phaser canvas into the React app
// ============================================================
import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

export default function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Intercept browser zoom keys/wheel during the capture phase
    // so they do not propagate to Phaser, allowing the browser zoom to function normally.
    const handleZoomKeys = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        (e.key === '=' ||
          e.key === '-' ||
          e.key === '+' ||
          e.key === '0' ||
          e.keyCode === 187 ||
          e.keyCode === 189 ||
          e.keyCode === 48 ||
          e.keyCode === 96 ||
          e.keyCode === 107 ||
          e.keyCode === 109)
      ) {
        e.stopPropagation();
      }
    };

    const handleZoomWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleZoomKeys, true);
    window.addEventListener('wheel', handleZoomWheel, { capture: true, passive: true });

    if (gameRef.current) return; // already mounted

    // Import Phaser only on client side to avoid SSR issues
    const initGame = async () => {
      const Phaser = (await import('phaser')).default;
      const { GameConfig } = await import('../game/GameConfig');

      if (!containerRef.current) return;

      gameRef.current = new Phaser.Game({
        ...GameConfig,
        parent: containerRef.current,
      });
    };

    initGame();

    return () => {
      window.removeEventListener('keydown', handleZoomKeys, true);
      window.removeEventListener('wheel', handleZoomWheel, { capture: true });
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="game-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
