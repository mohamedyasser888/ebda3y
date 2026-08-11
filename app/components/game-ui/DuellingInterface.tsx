'use client';


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { eventBus } from '../../game/EventBus';

interface Props { onClose: () => void; }

const P_MAX_HP = 150;
const A_MAX_HP = 130;

type Tab = 'attack' | 'defense' | 'heal';
type GameResult = 'playerWon' | 'aiWon' | null;

interface SpellDef {
  id: string; name: string; tab: Tab;
  kind: 'attack' | 'defense' | 'heal';
  dmg?: number; heal?: number;
  color: string; icon: string; desc: string;
}

// ── Spells — 4 attack, 3 defense, 3 heal ─────────────────────────────────
const SPELLS: SpellDef[] = [
  { id:'expelliarmus', name:'Expelliarmus', tab:'attack',  kind:'attack',  dmg:18,  color:'#ef4444', icon:'⚡', desc:'Disarms — 18 dmg, strips opponent shield' },
  { id:'stupefy',      name:'Stupefy',      tab:'attack',  kind:'attack',  dmg:22,  color:'#f97316', icon:'💥', desc:'Stun blast — 22 dmg' },
  { id:'bombarda',     name:'Bombarda',     tab:'attack',  kind:'attack',  dmg:30,  color:'#dc2626', icon:'💣', desc:'Explosive — 30 dmg, high force' },
  { id:'sectumsempra', name:'Sectumsempra', tab:'attack',  kind:'attack',  dmg:26,  color:'#7c3aed', icon:'⚔️', desc:'Dark slash — 26 dmg + 8 bleed next turn' },
  { id:'protego',      name:'Protego',      tab:'defense', kind:'defense',          color:'#3b82f6', icon:'🛡️', desc:'Shield — blocks the next attack completely' },
  { id:'finite',       name:'Finite',       tab:'defense', kind:'defense',          color:'#8b5cf6', icon:'✨', desc:'Cancels opponent\'s active effects' },
  { id:'impedimenta',  name:'Impedimenta',  tab:'defense', kind:'defense',          color:'#6366f1', icon:'🚧', desc:'Slow — opponent deals -30% damage next turn' },
  { id:'episkey',      name:'Episkey',      tab:'heal',    kind:'heal',    heal:20, color:'#22c55e', icon:'💚', desc:'Minor healing — restore 20 HP' },
  { id:'vulnera',      name:'Vulnera San.', tab:'heal',    kind:'heal',    heal:35, color:'#16a34a', icon:'🌿', desc:'Wound healing — restore 35 HP' },
  { id:'reparifors',   name:'Reparifors',   tab:'heal',    kind:'heal',    heal:25, color:'#15803d', icon:'🍃', desc:'Cure wounds and remove debuffs — 25 HP' },
];

interface Fighter { hp: number; maxHp: number; shield: boolean; slowed: boolean; bleed: number; }
const mkF = (hp: number): Fighter => ({ hp, maxHp: hp, shield: false, slowed: false, bleed: 0 });

export default function DuellingInterface({ onClose }: Props) {
  const [player,  setPlayer]  = useState<Fighter>(() => mkF(P_MAX_HP));
  const [ai,      setAi]      = useState<Fighter>(() => mkF(A_MAX_HP));
  const [turn,    setTurn]    = useState<'player'|'ai'>('player');
  const [busy,    setBusy]    = useState(false);
  const [round,   setRound]   = useState(1);
  const [result,  setResult]  = useState<GameResult>(null);
  const [tab,     setTab]     = useState<Tab>('attack');
  const [log,     setLog]     = useState<{who:string;spell:string;result:string;color:string}[]>([]);
  const [proj,    setProj]    = useState<{color:string;dir:'lr'|'rl'}|null>(null);
  const [float,   setFloat]   = useState<{txt:string;side:'left'|'right'}|null>(null);
  const [shake,   setShake]   = useState<'player'|'ai'|null>(null);
  const [status,  setStatus]  = useState('✦ Your turn — pick a spell');
  const logRef = useRef<HTMLDivElement>(null);
  const aiPending  = useRef(false);
  const aiHealUsed = useRef(0); // cap at 3

  useEffect(() => { logRef.current?.scrollIntoView({ behavior:'smooth' }); }, [log]);

  useEffect(() => {
    if (result) return;
    if (player.hp <= 0) { setResult('aiWon');     eventBus.emit('DUEL_LOST'); }
    if (ai.hp     <= 0) { setResult('playerWon'); eventBus.emit('DUEL_WON'); }
  }, [player.hp, ai.hp, result]);

  useEffect(() => {
    if (turn !== 'ai' || busy || result || aiPending.current) return;
    aiPending.current = true;
    setStatus('⏳ Opponent thinking…');
    const t = window.setTimeout(() => {
      aiPending.current = false;
      execSpell(pickAI(), false);
    }, 950 + Math.random() * 550);
    return () => { window.clearTimeout(t); aiPending.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, busy, result]);

  function pickAI(): SpellDef {
    const atk  = SPELLS.filter(s => s.tab === 'attack');
    const def  = SPELLS.filter(s => s.tab === 'defense');
    const heal = SPELLS.filter(s => s.tab === 'heal');
    const r = Math.random();
    // Only heal if under threshold AND heal uses remaining
    if (ai.hp < 40 && heal.length && r < 0.75 && aiHealUsed.current < 3) return heal[Math.floor(Math.random()*heal.length)];
    if (!ai.shield && def.length && r < 0.28)  return def[Math.floor(Math.random()*def.length)];
    if (atk.length && r < 0.60) return [...atk].sort((a,b)=>(b.dmg??0)-(a.dmg??0))[0];
    const all = SPELLS; return all[Math.floor(Math.random()*all.length)];
  }

  const execSpell = useCallback((spell: SpellDef, isPlayer: boolean) => {
    setBusy(true);
    setProj({ color: spell.color, dir: isPlayer ? 'lr' : 'rl' });
    setStatus(`⚡ ${isPlayer ? 'You cast' : 'Opponent casts'} ${spell.name}…`);
    setTimeout(() => setProj(null), 440);

    setTimeout(() => {
      setShake(isPlayer ? 'ai' : 'player');
      setTimeout(() => setShake(null), 280);

      let resTxt = ''; let resCol = '#fff';

      if (spell.kind === 'attack') {
        const targetShielded = isPlayer ? ai.shield : player.shield;
        if (targetShielded) {
          resTxt = 'BLOCKED!'; resCol = '#60a5fa';
          if (isPlayer) setAi(p => ({ ...p, shield: false }));
          else setPlayer(p => ({ ...p, shield: false }));
        } else {
          let dmg = spell.dmg ?? 0;
          if (!isPlayer) dmg = Math.max(1, Math.floor(dmg * (player.slowed ? 0.7 : 0.9)));
          if (isPlayer)  dmg = Math.max(1, Math.floor(dmg * (ai.slowed    ? 0.7 : 1.0)));
          resTxt = `-${dmg} HP`; resCol = '#f87171';
          setFloat({ txt: resTxt, side: isPlayer ? 'right' : 'left' });
          if (isPlayer) setAi(p     => ({ ...p, hp: Math.max(0, p.hp - dmg), bleed: spell.id==='sectumsempra'?1:p.bleed }));
          else          setPlayer(p => ({ ...p, hp: Math.max(0, p.hp - dmg) }));
        }
      } else if (spell.kind === 'defense') {
        if (spell.id === 'protego') {
          resTxt = 'SHIELDED'; resCol = '#60a5fa';
          if (isPlayer) setPlayer(p => ({ ...p, shield: true }));
          else          setAi(p     => ({ ...p, shield: true }));
        } else if (spell.id === 'finite') {
          resTxt = 'CLEANSED'; resCol = '#a78bfa';
          if (isPlayer) setAi(p     => ({ ...p, shield: false, slowed: false, bleed: 0 }));
          else          setPlayer(p => ({ ...p, shield: false, slowed: false, bleed: 0 }));
        } else if (spell.id === 'impedimenta') {
          resTxt = 'SLOWED'; resCol = '#818cf8';
          if (isPlayer) setAi(p     => ({ ...p, slowed: true }));
          else          setPlayer(p => ({ ...p, slowed: true }));
        }
        setFloat({ txt: resTxt, side: isPlayer ? 'left' : 'right' });
      } else if (spell.kind === 'heal') {
        const h = spell.heal ?? 0;
        resTxt = `+${h} HP`; resCol = '#4ade80';
        setFloat({ txt: resTxt, side: isPlayer ? 'left' : 'right' });
        if (isPlayer) setPlayer(p => ({ ...p, hp: Math.min(P_MAX_HP, p.hp + h), bleed: 0 }));
        else        { setAi(p     => ({ ...p, hp: Math.min(A_MAX_HP, p.hp + h), bleed: 0 })); if (!isPlayer) aiHealUsed.current += 1; }
      }

      setLog(prev => [...prev, { who: isPlayer?'You':'Opponent', spell:spell.name, result:resTxt, color:resCol }]);
      setTimeout(() => setFloat(null), 900);

      setTimeout(() => {
        setBusy(false);
        if (isPlayer) { setTurn('ai'); }
        else          { setRound(r => r+1); setTurn('player'); setStatus('✦ Your turn — pick a spell'); }
      }, 480);
    }, 460);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, ai]);

  function handleReset() {
    setPlayer(mkF(P_MAX_HP)); setAi(mkF(A_MAX_HP));
    setTurn('player'); setBusy(false); setRound(1); setResult(null);
    setLog([]); setStatus('✦ Your turn — pick a spell');
    aiPending.current = false;
    aiHealUsed.current = 0;
  }

  const tabSpells   = SPELLS.filter(s => s.tab === tab);
  const playerTurn  = turn === 'player' && !busy && !result;
  const TABS: {id:Tab;label:string}[] = [{ id:'attack',label:'Attacking' },{ id:'defense',label:'Defense' },{ id:'heal',label:'Healing' }];

  function HpBar({ hp, max }: { hp:number; max:number }) {
    const pct = Math.max(0, (hp/max)*100);
    const col = hp > max*0.55 ? '#22c55e' : hp > max*0.28 ? '#eab308' : '#ef4444';
    return (
      <div style={{ width:'100%', height:18, background:'rgba(0,0,0,0.55)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)', position:'relative' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:`linear-gradient(90deg,${col}cc,${col})`, borderRadius:10, transition:'width 0.55s ease', boxShadow:`0 0 10px ${col}88` }} />
        <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', fontFamily:'monospace', textShadow:'1px 1px 2px #000' }}>{hp} / {max}</span>
      </div>
    );
  }

  function Panel({ f, name, emoji, side }: { f:Fighter; name:string; emoji:string; side:'left'|'right' }) {
    const shaking = shake === (side==='left'?'player':'ai');
    const glowColor = f.shield ? '#60a5fa' : f.bleed > 0 ? '#ef4444' : '#b8860b';
    return (
      <div style={{ width:210, display:'flex', flexDirection:'column', alignItems:'center', padding:'18px 14px 10px', gap:8, background:'linear-gradient(160deg,#1e1b4b 0%,#0f0c2e 100%)', borderRight:side==='left'?'1px solid rgba(184,134,11,0.35)':undefined, borderLeft:side==='right'?'1px solid rgba(184,134,11,0.35)':undefined, position:'relative', flexShrink:0, overflow:'hidden' }}>
        {/* rune bg */}
        <div style={{ position:'absolute', fontSize:180, opacity:0.035, color:'#a78bfa', userSelect:'none', pointerEvents:'none', top:'50%', left:'50%', transform:'translate(-50%,-50%)' }}>⟁</div>
        <div style={{ fontSize:11, color:'#e2e8f0', letterSpacing:2, zIndex:1 }}>{name}</div>
        <HpBar hp={f.hp} max={f.maxHp} />
        {/* Big avatar */}
        <div style={{ width:88, height:88, borderRadius:'50%', border:`3px solid ${glowColor}`, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, margin:'4px 0', zIndex:1, boxShadow:`0 0 18px ${glowColor}55`, transform:shaking?(side==='left'?'translateX(-8px)':'translateX(8px)'):'none', transition:'transform 0.1s,box-shadow 0.3s,border-color 0.3s' }}>{emoji}</div>
        <HpBar hp={f.hp} max={f.maxHp} />
        {/* Status */}
        <div style={{ fontSize:9, color:f.shield?'#60a5fa':f.bleed>0?'#f87171':f.slowed?'#a78bfa':'#475569', marginTop:2, zIndex:1, fontFamily:'sans-serif', textAlign:'center' }}>
          {f.shield ? '🛡️ Shielded' : f.bleed > 0 ? '🩸 Bleeding' : f.slowed ? '🐢 Slowed' : 'No Status Effects'}
        </div>
        <div style={{ fontSize:8, color:'#f0c04066', zIndex:1, fontFamily:'sans-serif', marginTop:'auto', paddingTop:6, textAlign:'center' }}>Step onto platform to duel</div>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:1060, height:600, background:'linear-gradient(145deg,#0f0c2e 0%,#130f38 60%,#0a0818 100%)', border:'1.5px solid #b8860b', borderRadius:10, boxShadow:'0 0 80px rgba(0,0,0,0.95), 0 0 30px rgba(184,134,11,0.2)', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'"Press Start 2P",monospace', position:'relative' }}>

        {/* TOP BAR */}
        <div style={{ height:46, background:'rgba(0,0,0,0.4)', borderBottom:'1px solid rgba(184,134,11,0.4)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', flexShrink:0 }}>
          <button onClick={onClose} style={{ background:'rgba(239,68,68,0.12)', border:'1px solid #ef4444', color:'#fca5a5', fontSize:9, padding:'7px 16px', cursor:'pointer', borderRadius:6, fontFamily:'inherit', letterSpacing:1 }}>✕ Leave Duel</button>
          <div style={{ fontSize:9, color:turn==='player'&&!busy&&!result?'#4ade80':'#f0c040', border:'1px solid rgba(184,134,11,0.4)', padding:'7px 18px', borderRadius:6, background:'rgba(0,0,0,0.3)', letterSpacing:1 }}>
            {result ? (result==='playerWon'?'⚡ VICTORY!':'💀 DEFEATED!') : status}
          </div>
        </div>

        {/* MIDDLE: panels + battle */}
        <div style={{ display:'flex', flex:'0 0 230px', borderBottom:'1px solid rgba(184,134,11,0.3)' }}>
          <Panel f={player} name="Player 1" emoji="🧙" side="left" />

          {/* BATTLE SCENE */}
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            {/* Sky gradient */}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#1a1060 0%,#2d1b8e 25%,#1e3a8a 55%,#1e40af 70%,#2d6a1f 85%,#1a4010 100%)' }} />
            {/* Stars */}
            {[...Array(18)].map((_,i) => <div key={i} style={{ position:'absolute', width:2, height:2, borderRadius:'50%', background:'#fff', opacity:0.5+Math.random()*0.5, top:`${5+Math.random()*45}%`, left:`${Math.random()*100}%` }} />)}
            {/* Moon */}
            <div style={{ position:'absolute', top:12, right:'18%', width:36, height:36, borderRadius:'50%', background:'#fef3c7', boxShadow:'0 0 20px #fef3c788' }} />
            {/* Castle silhouette */}
            <div style={{ position:'absolute', bottom:52, left:'10%', display:'flex', gap:0, alignItems:'flex-end' }}>
              {[{w:18,h:52},{w:30,h:38},{w:22,h:60},{w:28,h:42},{w:16,h:48}].map((t,i)=>(
                <div key={i} style={{ width:t.w, height:t.h, background:'#0f0c20', borderTop:'2px solid #1e1b4b', display:'flex', flexDirection:'column', alignItems:'center' }}>
                  {i%2===0 && <div style={{ width:t.w+4, height:12, background:'#0f0c20', clipPath:'polygon(0 100%,50% 0,100% 100%)', marginTop:-12 }} />}
                </div>
              ))}
            </div>
            <div style={{ position:'absolute', bottom:52, right:'10%', display:'flex', gap:0, alignItems:'flex-end' }}>
              {[{w:16,h:48},{w:28,h:36},{w:20,h:58},{w:26,h:40},{w:18,h:50}].map((t,i)=>(
                <div key={i} style={{ width:t.w, height:t.h, background:'#0f0c20', borderTop:'2px solid #1e1b4b', display:'flex', flexDirection:'column', alignItems:'center' }}>
                  {i%2===0 && <div style={{ width:t.w+4, height:10, background:'#0f0c20', clipPath:'polygon(0 100%,50% 0,100% 100%)', marginTop:-10 }} />}
                </div>
              ))}
            </div>
            {/* Ground */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:54, background:'linear-gradient(180deg,#1a4010 0%,#0f2808 100%)', borderTop:'2px solid #22c55e44' }} />
            {/* Magical circle on ground */}
            <div style={{ position:'absolute', bottom:18, left:'50%', transform:'translateX(-50%)', width:200, height:28, border:'2px solid #7c3aed55', borderRadius:'50%', boxShadow:'0 0 18px #7c3aed44' }} />
            {/* Rune particles */}
            {['15%','45%','75%'].map((l,i) => <div key={i} style={{ position:'absolute', bottom:30, left:l, color:'#a78bfa', fontSize:14, opacity:0.35, animation:'floatUp 3s ease-in-out infinite', animationDelay:`${i*0.8}s` }}>✦</div>)}
            {/* PLAYER WIZARD — large */}
            <div style={{ position:'absolute', bottom:52, left:'15%', fontSize:72, filter:`drop-shadow(0 0 14px #7c3aed88) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`, transform:shake==='player'?'translateX(-10px) scale(1.05)':'scale(1)', transition:'transform 0.12s', userSelect:'none' }}>🧙</div>
            {/* AI WIZARD — large */}
            <div style={{ position:'absolute', bottom:52, right:'15%', fontSize:72, filter:`drop-shadow(0 0 14px #ef444488) drop-shadow(0 4px 8px rgba(0,0,0,0.8))`, transform:shake==='ai'?'translateX(10px) scale(1.05)':'scale(1)', transition:'transform 0.12s', userSelect:'none' }}>🧙‍♂️</div>
            {/* Projectile */}
            {proj && <div style={{ position:'absolute', bottom:92, left:proj.dir==='lr'?'22%':'60%', width:22, height:22, borderRadius:'50%', background:proj.color, boxShadow:`0 0 22px ${proj.color}, 0 0 8px #fff`, transform:proj.dir==='lr'?'translateX(340px)':'translateX(-340px)', transition:'transform 440ms ease-in' }} />}
            {/* Float text */}
            {float && <div style={{ position:'absolute', bottom:110, left:float.side==='right'?'60%':'14%', fontSize:14, color:'#fff', fontFamily:'inherit', textShadow:'0 0 10px #000, 2px 2px 0 #000', animation:'floatUp 900ms ease-out forwards', pointerEvents:'none', zIndex:10 }}>{float.txt}</div>}
          </div>

          <Panel f={ai} name="Player 2" emoji="🧙‍♂️" side="right" />
        </div>

        {/* BOTTOM: spells + log */}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Spell panel */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Tabs */}
            <div style={{ display:'flex', height:38, borderBottom:'1px solid rgba(184,134,11,0.35)', flexShrink:0, background:'rgba(0,0,0,0.25)' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, height:'100%', fontSize:9, fontFamily:'inherit', cursor:'pointer', border:'none', borderRight:'1px solid rgba(184,134,11,0.2)', background:tab===t.id?'rgba(184,134,11,0.22)':'transparent', color:tab===t.id?'#f0c040':'#475569', letterSpacing:1, transition:'all 0.18s', fontWeight:tab===t.id?'bold':'normal', borderBottom:tab===t.id?'2px solid #b8860b':'none' }}>
                  {t.label}
                </button>
              ))}
            </div>
            {/* Spell cards */}
            <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:`repeat(${tabSpells.length <= 3 ? tabSpells.length : 4},1fr)`, gap:10, padding:12, alignContent:'start' }}>
              {tabSpells.map(s => {
                const off = !playerTurn;
                return (
                  <div key={s.id} onClick={()=>!off&&execSpell(s,true)}
                    style={{ border:`1.5px solid ${off?'#1e293b':s.color+'aa'}`, background:off?'rgba(0,0,0,0.15)':`linear-gradient(145deg,${s.color}14,${s.color}08)`, borderRadius:8, padding:'12px', cursor:off?'not-allowed':'pointer', opacity:off?0.35:1, transition:'transform 0.18s,box-shadow 0.18s,opacity 0.2s', display:'flex', flexDirection:'column', gap:6, minHeight:100, position:'relative', overflow:'hidden' }}
                    onMouseEnter={e=>{ if(!off){(e.currentTarget as HTMLElement).style.transform='translateY(-4px)';(e.currentTarget as HTMLElement).style.boxShadow=`0 8px 24px ${s.color}44`;}}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='none';(e.currentTarget as HTMLElement).style.boxShadow='none';}}
                  >
                    <div style={{ position:'absolute', top:8, right:10, fontSize:22, opacity:0.85 }}>{s.icon}</div>
                    <div style={{ fontSize:9, color:off?'#475569':s.color, fontWeight:'bold', letterSpacing:0.5, paddingRight:30 }}>{s.name}</div>
                    {s.dmg  && <div style={{ fontSize:10, color:'#f87171', fontFamily:'monospace' }}>DMG: {s.dmg}</div>}
                    {s.heal && <div style={{ fontSize:10, color:'#4ade80', fontFamily:'monospace' }}>HEAL: {s.heal}</div>}
                    {!s.dmg && !s.heal && <div style={{ fontSize:10, color:'#60a5fa', fontFamily:'monospace' }}>DEFEND</div>}
                    <div style={{ fontSize:8, color:'#64748b', lineHeight:1.5, fontFamily:'sans-serif' }}>{s.desc}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ height:28, borderTop:'1px solid rgba(184,134,11,0.25)', display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 14px', fontSize:8, color:'#334155', flexShrink:0, fontFamily:'sans-serif' }}>Round: {round} / 30</div>
          </div>

          {/* Battle log */}
          <div style={{ width:232, display:'flex', flexDirection:'column', background:'#f5e6c8', borderLeft:'1px solid rgba(184,134,11,0.4)', flexShrink:0 }}>
            <div style={{ padding:'8px 12px', fontSize:9, color:'#5a3010', borderBottom:'1px solid #c8a060', background:'#e8d5a8' }}>Battle Log</div>
            <div style={{ flex:1, overflowY:'auto', padding:'10px', display:'flex', flexDirection:'column', gap:5 }}>
              {log.length===0 && <div style={{ fontSize:8, color:'#aaa', textAlign:'center', marginTop:18, fontFamily:'sans-serif' }}>No actions yet…</div>}
              {log.map((e,i) => (
                <div key={i} style={{ fontSize:8, color:'#3a2010', lineHeight:1.6, borderBottom:'1px solid rgba(0,0,0,0.07)', paddingBottom:4, fontFamily:'sans-serif' }}>
                  <span style={{ color:e.who==='You'?'#7c2020':'#1a3a7c', fontWeight:'bold' }}>{e.who}</span>
                  {' '}<span style={{ color:'#5a3a10' }}>{e.spell}</span>
                  {' '}<span style={{ color:e.color, fontWeight:'bold' }}>{e.result}</span>
                </div>
              ))}
              <div ref={logRef} />
            </div>
          </div>
        </div>

        {/* RESULT OVERLAY */}
        {result && (
          <div style={{ position:'absolute', inset:0, background:result==='playerWon'?'radial-gradient(circle,rgba(74,222,128,0.18) 0%,rgba(15,12,46,0.97) 65%)':'radial-gradient(circle,rgba(239,68,68,0.18) 0%,rgba(10,8,24,0.97) 65%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:60, backdropFilter:'blur(3px)' }}>
            <div style={{ fontSize:22, color:result==='playerWon'?'#4ade80':'#ef4444', marginBottom:14, textShadow:`0 0 30px ${result==='playerWon'?'#4ade80':'#ef4444'}` }}>{result==='playerWon'?'⚡ VICTORY! ⚡':'💀 DEFEATED 💀'}</div>
            <div style={{ fontSize:9, color:'#e2e8f0', marginBottom:26, textAlign:'center', lineHeight:2.5, fontFamily:'sans-serif' }}>
              {result==='playerWon'?'You defeated the opponent!':'You were bested in battle!'}<br/>Rounds: {round}  ·  Actions: {log.length}
            </div>
            <div style={{ display:'flex', gap:14 }}>
              <button onClick={handleReset} style={{ padding:'12px 28px', fontSize:9, fontFamily:'inherit', cursor:'pointer', border:`2px solid ${result==='playerWon'?'#4ade80':'#ef4444'}`, background:`rgba(${result==='playerWon'?'74,222,128':'239,68,68'},0.15)`, color:result==='playerWon'?'#4ade80':'#ef4444', borderRadius:6, letterSpacing:1 }}>{result==='playerWon'?'DUEL AGAIN':'TRY AGAIN'}</button>
              <button onClick={onClose} style={{ padding:'12px 28px', fontSize:9, fontFamily:'inherit', cursor:'pointer', border:'2px solid #475569', background:'rgba(71,85,105,0.15)', color:'#94a3b8', borderRadius:6, letterSpacing:1 }}>LEAVE</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
