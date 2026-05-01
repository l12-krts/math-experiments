import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Customized } from 'recharts';
import { evaluate } from 'mathjs';
import { useCSSVariable } from '@heroui/react';
import { publish } from "../util/events"

const addImplicit = (s) =>
  s
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/\)([0-9a-zA-Z(])/g, ')*$1');

const parseEquation = (raw) => {
  const s = raw.replace(/\s+/g, '');
  const eqIdx = s.indexOf('=');
  if (eqIdx === -1) return { rhsExpr: addImplicit(s), power: 1, twoSided: false };
  const lhs = s.slice(0, eqIdx);
  const rhs = s.slice(eqIdx + 1);
  const powerMatch = lhs.match(/^y\^[\(]?(\d+)[\)]?$/);
  if (powerMatch) {
    const n = parseInt(powerMatch[1], 10);
    return { rhsExpr: addImplicit(rhs), power: n, twoSided: n % 2 === 0 };
  }
  return { rhsExpr: addImplicit(rhs), power: 1, twoSided: false };
};

const solveY = (rhsValue, power) => {
  if (!isFinite(rhsValue)) return [];
  if (power === 1) return [rhsValue];
  if (power % 2 === 0) {
    if (rhsValue < 0) return [];
    const root = Math.pow(rhsValue, 1 / power);
    return [root, -root];
  }
  return [Math.sign(rhsValue) * Math.pow(Math.abs(rhsValue), 1 / power)];
};

const yToFreq = (y) => {
  const c = Math.max(-40, Math.min(40, isFinite(y) ? y : 0));
  return 80 + ((c + 40) / 40) * 1200;
};

const PLAY_DURATION = 6;
const AXIS_DOMAIN = [-10, 10];

const CenterAxesTicks = ({ xAxisMap, yAxisMap }) => {
  try {
    if (!xAxisMap || !yAxisMap) return null;
    const xScale = Object.values(xAxisMap)[0]?.scale;
    const yScale = Object.values(yAxisMap)[0]?.scale;
    if (!xScale || !yScale) return null;
    const ox = xScale(0);
    const oy = yScale(0);
    console.log('origin px:', ox, oy);
    // ... rest
  return (
    <g>
      {ticks.map(v => {
        const px = xScale(v);
        const py = yScale(v);
        return (
          <g key={v}>
            <line x1={px} y1={oy - tickLen} x2={px} y2={oy + tickLen} stroke="var(--accent-dim)" strokeWidth={1} />
            <text x={px} y={oy + 14} textAnchor="middle" fill="var(--accent)" fontSize={10}>{v}</text>
            <line x1={ox - tickLen} y1={py} x2={ox + tickLen} y2={py} stroke="var(--accent-dim)" strokeWidth={1} />
            <text x={ox + 14} y={py + 4} textAnchor="start" fill="var(--accent)" fontSize={10}>{v}</text>
          </g>
        );
      })}
      <text x={ox + 14} y={oy + 14} textAnchor="start" fill="var(--accent)" fontSize={10}>0</text>
    </g>
  );
  } catch {
    return null;
  }
};

const MusicEquation = ({ equation = 'y=sin(x)', isPlaying = false }) => {
  const [data, setData]         = useState([]);
  const [playX, setPlayX]       = useState(-10);
  const [playing, setPlaying]   = useState(false);
  const [twoSided, setTwoSided] = useState(false);

  const audioCtxRef  = useRef(null);
  const oscRef       = useRef(null);
  const rafRef       = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    try {
      const { rhsExpr, power, twoSided: ts } = parseEquation(equation);
      setTwoSided(ts);
      const points = [];

      for (let i = 0; i <= 400; i++) {
        const x = -10 + (i / 400) * 20;
        let rhs;
        try { rhs = evaluate(rhsExpr, { x }); } catch { rhs = NaN; }
        const ys = solveY(typeof rhs === 'number' ? rhs : NaN, power);
        const pt = { x: parseFloat(x.toFixed(3)) };
        if (ts) {
          pt.yPos = ys[0] != null ? parseFloat(ys[0].toFixed(4)) : null;
          pt.yNeg = ys[1] != null ? parseFloat(ys[1].toFixed(4)) : null;
        } else {
          pt.y = ys[0] != null ? parseFloat(ys[0].toFixed(4)) : null;
        }
        points.push(pt);
      }

      setData(points);
    } catch { setData([]); }
  }, [equation]);

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (oscRef.current) { try { oscRef.current.stop(); } catch {} oscRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setPlayX(-10);
    setPlaying(false);
  }, []);

  const startAudio = useCallback(() => {
    stopAudio();
    const { rhsExpr, power } = parseEquation(equation);
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    for (let i = 0; i <= 300; i++) {
      const x = -10 + (i / 300) * 20;
      const t = ctx.currentTime + (i / 300) * PLAY_DURATION;
      let rhs = 0;
      try { rhs = evaluate(rhsExpr, { x }); } catch {}
      const ys = solveY(typeof rhs === 'number' ? rhs : 0, power);
      osc.frequency.setValueAtTime(yToFreq(ys[0] ?? 0), t);
    }
    osc.start();
    oscRef.current = osc;
    startTimeRef.current = performance.now();
    setPlaying(true);
    const tick = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      if (elapsed >= PLAY_DURATION) { stopAudio(); publish("audioStopped"); return; }
      setPlayX(-10 + (elapsed / PLAY_DURATION) * 20);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [equation, stopAudio]);

  useEffect(() => {
    if (isPlaying) startAudio();
    else           stopAudio();
  }, [isPlaying]);

  useEffect(() => () => stopAudio(), []);
  const chartStyle = { outline: 'none', userSelect: 'none' };
  return (
    <div className="absolute top-[5%] left-[28%] w-[90vh] h-[90vh] focus:outline-none outline-none" tabIndex={-1}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 16 }} style={chartStyle}>
          <CartesianGrid strokeDasharray="2 6" stroke="var(--accent-dim)" strokeOpacity={0.3} />
          <XAxis
            dataKey="x"
            type="number"
            domain={AXIS_DOMAIN}
            axisLine={true}
            mirror={true}
            allowDataOverflow={true}
            tick={{color: useCSSVariable("--accent"), textShadow: '0 0 2px black', zIndex: 10000}}
            stroke="var(--accent-dim)"
            tick={{ fill: 'var(--accent)', fontSize: 11 }}
            tickLine={{ stroke: 'var(--accent-dim)' }}
            ticks={[-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10]}
          />
          <YAxis
            type="number"
            domain={AXIS_DOMAIN}
            axisLine={true}
            mirror={true}
            allowDataOverflow={true}
            stroke="var(--accent-dim)"
            tick={{ fill: 'var(--accent)', fontSize: 11 }}
            tickLine={{ stroke: 'var(--accent-dim)' }}
            width={48}
            tickFormatter={v => v.toFixed(0)}
            ticks={[-10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10]}
          />
          {playing && (
            <ReferenceLine
              x={parseFloat(playX.toFixed(3))}
              stroke="var(--accent)"
              strokeWidth={1.5}
            />
          )}
          {twoSided ? (
            <>
              <Line type="monotone" dataKey="yPos" stroke="var(--accent)" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="yNeg" stroke="var(--accent)" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
            </>
          ) : (
            <Line type="monotone" dataKey="y" stroke="var(--accent)" dot={false} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
          )}
          <ReferenceLine y={0} stroke="var(--accent-dim)" strokeWidth={1} strokeDasharray="3 3" />
          <ReferenceLine x={0} stroke="var(--accent-dim)" strokeWidth={1} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MusicEquation;