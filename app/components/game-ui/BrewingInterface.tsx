'use client';
// ============================================================
// BrewingInterface — Immersive Alchemy Table Experience
// Everything on one table: cauldron, potions, recipe book
// ============================================================
import React, { 
  useState, useRef, useCallback, useEffect 
} from 'react';
import { POTIONS } from '../../game/data/potions';
import { INGREDIENTS, INGREDIENT_MAP } from '../../game/data/ingredients';
import { eventBus } from '../../game/EventBus';
import type { Potion, Ingredient } from '../../types/game.types';

interface DragState { id: string; x: number; y: number }
interface Toast { id: number; text: string; kind: 'ok'|'err'|'info' }

let toastSeq = 0;
let brewTimer: ReturnType<typeof setInterval> | null = null;

export default function BrewingInterface({ onClose }: { onClose: () => void }) {
  // Recipe book state
  const [selectedPotion, setSelectedPotion] = useState(POTIONS[0]);
  const [bookOpen, setBookOpen] = useState(false);

  // Brewing state
  const [added, setAdded] = useState<string[]>([]);
  const [pool, setPool] = useState<Record<string,number>>(() => {
    const p: Record<string,number> = {};
    INGREDIENTS.forEach(ing => p[ing.id] = 3);
    return p;
  });
  const [stirMode, setStirMode] = useState(false);
  const [stirPct, setStirPct] = useState(0);
  const [brewing, setBrewing] = useState(false);
  const [brewPct, setBrewPct] = useState(0);
  const [success, setSuccess] = useState<{potion:Potion; xp:number} | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Drag
  const [drag, setDrag] = useState<DragState|null>(null);
  const [ghostPos, setGhostPos] = useState({x:0,y:0});
  const [overCauldron, setOverCauldron] = useState(false);

  // Refs
  const stirPts = useRef<{x:number;y:number}[]>([]);
  const cauldronRef = useRef<HTMLDivElement>(null);

  const required = selectedPotion.ingredients;
  const requiredIngredients = required.map(id => INGREDIENT_MAP[id]).filter(Boolean);

  // Reset when potion changes
  useEffect(() => {
    setAdded([]); setStirMode(false); setStirPct(0);
    setBrewing(false); setBrewPct(0); stirPts.current = [];
    if (brewTimer) { clearInterval(brewTimer); brewTimer = null; }
  }, [selectedPotion.id]);

  useEffect(() => {
    return () => { if (brewTimer) clearInterval(brewTimer); };
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastSeq;
    setToasts(p => [...p, {id, text, kind}]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2500);
  }, []);

  const calcStir = (pts: {x:number;y:number}[]): number => {
    if (pts.length < 8) return 0;
    const cx = pts.reduce((s,p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s,p) => s + p.y, 0) / pts.length;
    const angles = pts.map(p => Math.atan2(p.y - cy, p.x - cx));
    let total = 0;
    for (let i = 1; i < angles.length; i++) {
      let d = angles[i] - angles[i-1];
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      total += Math.abs(d);
    }
    return Math.min(1, (total / (Math.PI * 2)) * 1.2);
  };

  const onMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if ((pool[id] ?? 0) <= 0) return;
    setDrag({id, x: e.clientX, y: e.clientY});
    setGhostPos({x: e.clientX, y: e.clientY});
  }, [pool]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (stirMode) {
      stirPts.current.push({x: e.clientX, y: e.clientY});
      if (stirPts.current.length > 40) stirPts.current.shift();
      const pct = calcStir(stirPts.current);
      setStirPct(pct);
      if (pct >= 1) {
        setStirMode(false); setBrewing(true); setBrewPct(0);
        stirPts.current = [];
        const total = selectedPotion.brewingTime * 1000;
        let elapsed = 0;
        brewTimer = setInterval(() => {
          elapsed += 100;
          const pct = Math.min(1, elapsed / total);
          setBrewPct(pct);
          if (pct >= 1) {
            clearInterval(brewTimer!); brewTimer = null;
            setBrewing(false);
            eventBus.emit('WIZARD_CELEBRATE');
            setSuccess({ potion: selectedPotion, xp: selectedPotion.xpReward });
            eventBus.emit('POTION_BREWED', { potionId: selectedPotion.id, xp: selectedPotion.xpReward });
          }
        }, 100);
      }
    }
    if (!drag) return;
    setGhostPos({x: e.clientX, y: e.clientY});
    if (cauldronRef.current) {
      const r = cauldronRef.current.getBoundingClientRect();
      setOverCauldron(
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom
      );
    }
  }, [drag, stirMode, selectedPotion]);

  const onMouseUp = useCallback(() => {
    if (drag && overCauldron) {
      const id = drag.id;
      const next = required[added.length];
      if (!next) {
        toast('All ingredients added! Stir now!', 'info');
      } else if (id === next) {
        const newAdded = [...added, id];
        setAdded(newAdded);
        setPool(p => ({ ...p, [id]: Math.max(0, (p[id] ?? 3) - 1) }));
        toast(`Added ${INGREDIENT_MAP[id]?.name ?? id}!`, 'ok');
        eventBus.emit('WIZARD_CELEBRATE');
        if (newAdded.length === required.length) {
          setTimeout(() => {
            setStirMode(true);
            toast('Stir the cauldron in circles!', 'info');
          }, 600);
        }
      } else {
        toast(`Wrong! Need ${INGREDIENT_MAP[next]?.name ?? next}`, 'err');
        eventBus.emit('WIZARD_SHAKE');
      }
    }
    setDrag(null); setOverCauldron(false);
  }, [drag, overCauldron, added, required, toast]);

  const reset = useCallback(() => {
    setAdded([]); setStirMode(false); setStirPct(0);
    setBrewing(false); setBrewPct(0); stirPts.current = [];
    const newPool: Record<string,number> = {};
    INGREDIENTS.forEach(ing => newPool[ing.id] = 3);
    setPool(newPool);
    if (brewTimer) { clearInterval(brewTimer); brewTimer = null; }
  }, []);

  const handleClose = useCallback(() => {
    eventBus.emit('CLOSE_BREWING');
    onClose();
  }, [onClose]);

  const draggedIng = drag ? INGREDIENT_MAP[drag.id] : null;
  return (
    <div className="table-backdrop" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      
      {/* Drag ghost */}
      {drag && draggedIng && (
        <div className="drag-ghost" style={{left: ghostPos.x, top: ghostPos.y}}>
          <div className="ghost-bottle" style={{backgroundColor: draggedIng.color}}>
            <span className="ghost-emoji">{draggedIng.emoji}</span>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="table-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`table-toast table-toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Success modal */}
      {success && (
        <div className="success-modal-backdrop">
          <div className="success-modal">
            <div className="success-emoji">{success.potion.emoji}</div>
            <div className="success-title">POTION COMPLETE!</div>
            <div className="success-name">{success.potion.name}</div>
            <div className="success-xp">+{success.xp} XP</div>
            <button className="success-btn" onClick={() => {setSuccess(null); reset();}}>
              BREW ANOTHER
            </button>
          </div>
        </div>
      )}

      {/* MAIN ALCHEMY TABLE */}
      <div className="alchemy-table">
        
        {/* Table surface with wood grain */}
        <div className="table-surface" />

        {/* Recipe Book (Left side - click to open) */}
        <div 
          className={`recipe-book ${bookOpen ? 'open' : 'closed'}`}
          onClick={() => setBookOpen(!bookOpen)}
        >
          {bookOpen ? (
            <div className="book-content">
              <div className="book-header">
                <span className="book-title">Recipe Book</span>
                <span className="book-close" onClick={(e) => {e.stopPropagation(); setBookOpen(false)}}>×</span>
              </div>
              
              {/* Potion selection */}
              <div className="potion-list">
                {POTIONS.map(potion => (
                  <div 
                    key={potion.id}
                    className={`potion-item ${selectedPotion.id === potion.id ? 'selected' : ''}`}
                    onClick={(e) => {e.stopPropagation(); setSelectedPotion(potion);}}
                  >
                    <span className="potion-emoji">{potion.emoji}</span>
                    <span className="potion-name">{potion.name}</span>
                  </div>
                ))}
              </div>

              {/* Selected recipe */}
              <div className="recipe-details">
                <div className="recipe-header">
                  <span className="recipe-emoji">{selectedPotion.emoji}</span>
                  <span className="recipe-name">{selectedPotion.name}</span>
                </div>
                
                <div className="ingredients-section">
                  <h4>Ingredients:</h4>
                  {requiredIngredients.map((ing, i) => {
                    const isAdded = i < added.length;
                    return (
                      <div key={ing.id} className={`ingredient-item ${isAdded ? 'added' : ''}`}>
                        <span className="ingredient-check">{isAdded ? '✓' : '○'}</span>
                        <span className="ingredient-emoji">{ing.emoji}</span>
                        <span className="ingredient-name">{ing.name}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="steps-section">
                  <h4>Steps:</h4>
                  {selectedPotion.recipe.slice(0, 4).map((step, i) => (
                    <div key={i} className="recipe-step">
                      <span className="step-number">{i + 1}.</span>
                      <span className="step-text">{step}</span>
                    </div>
                  ))}
                </div>

                <div className="effect-section">
                  <h4>Effect:</h4>
                  <p className="effect-text">{selectedPotion.effect}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="book-spine">
              <span className="spine-text">RECIPES</span>
              <span className="spine-hint">Click to Open</span>
            </div>
          )}
        </div>
        {/* CAULDRON (Center of table) */}
        <div
          ref={cauldronRef}
          className={`cauldron ${overCauldron ? 'hover' : ''} ${stirMode ? 'stir' : ''} ${brewing ? 'brewing' : ''}`}
        >
          <div className="cauldron-body">
            <div className="cauldron-rim" />
            <div className="cauldron-liquid" style={{backgroundColor: selectedPotion.color}}>
              {/* Bubbles */}
              <div className="bubble bubble-1">○</div>
              <div className="bubble bubble-2">○</div>
              <div className="bubble bubble-3">○</div>
              <div className="bubble bubble-4">○</div>
            </div>
            <div className="cauldron-legs" />
          </div>
          
          {/* Fire underneath */}
          <div className="fire">
            <div className="fire-layer fire-base" />
            <div className="fire-layer fire-mid" />
            <div className="fire-layer fire-bright" />
            <div className="fire-layer fire-core" />
          </div>

          {/* Steam */}
          <div className="steam">
            <div className="steam-wisp steam-1">~</div>
            <div className="steam-wisp steam-2">~</div>
            <div className="steam-wisp steam-3">~</div>
          </div>

          {/* Progress indicators */}
          {stirMode && !brewing && (
            <div className="stir-progress">
              <div className="progress-label">STIR</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${stirPct * 100}%`}} />
              </div>
            </div>
          )}

          {brewing && (
            <div className="brew-progress">
              <div className="progress-label">BREWING</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${brewPct * 100}%`}} />
              </div>
              <div className="progress-percent">{Math.round(brewPct * 100)}%</div>
            </div>
          )}
        </div>

        {/* INGREDIENT POTIONS scattered on table */}
        <div className="ingredient-potions">
          {requiredIngredients.map((ing, i) => {
            const qty = pool[ing.id] ?? 0;
            const isEmpty = qty <= 0;
            const isDone = added.includes(ing.id);
            
            return (
              <div 
                key={ing.id}
                className={`potion-bottle ${isEmpty ? 'empty' : ''} ${isDone ? 'used' : ''} ${drag?.id === ing.id ? 'dragging' : ''}`}
                style={{
                  left: `${30 + (i % 3) * 120}px`,
                  top: `${280 + Math.floor(i / 3) * 100}px`,
                }}
                onMouseDown={e => !isEmpty && onMouseDown(ing.id, e)}
                title={ing.description}
              >
                <div className="bottle-body">
                  <div className="bottle-liquid" style={{backgroundColor: ing.color}} />
                  <div className="bottle-cork" />
                  <div className="bottle-shine" />
                </div>
                <div className="bottle-label">
                  <div className="bottle-emoji">{ing.emoji}</div>
                  <div className="bottle-name">{ing.name}</div>
                  <div className="bottle-qty">×{qty}</div>
                </div>
                {isDone && <div className="bottle-check">✓</div>}
              </div>
            );
          })}
        </div>

        {/* TOOLS on table */}
        <div className="table-tools">
          <div className="tool mortar">
            <div className="mortar-bowl" />
            <div className="pestle" />
            <span className="tool-label">Mortar & Pestle</span>
          </div>
          
          <div className={`tool spoon ${stirMode ? 'active' : ''}`}>
            <div className="spoon-handle" />
            <div className="spoon-bowl" />
            <span className="tool-label">{stirMode ? 'Stir!' : 'Wooden Spoon'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="table-controls">
          <button className="control-btn reset-btn" onClick={reset} disabled={brewing}>
            RESET
          </button>
          <button className="control-btn close-btn" onClick={handleClose}>
            LEAVE TABLE
          </button>
        </div>

        {/* Ingredient order tracker */}
        <div className="ingredient-tracker">
          <div className="tracker-title">Add in Order:</div>
          <div className="tracker-slots">
            {required.map((id, i) => {
              const ing = INGREDIENT_MAP[id];
              const isDone = i < added.length;
              const isCurrent = i === added.length;
              return (
                <div key={id} className={`tracker-slot ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                  <span className="slot-number">{i + 1}</span>
                  <span className="slot-emoji">{isDone ? ing?.emoji : '○'}</span>
                  <span className="slot-name">{ing?.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}