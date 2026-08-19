'use client';

import React from 'react';
import { T } from './tokens';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" fill="#0D2116" />
      <path
        d="M16 7 L19.5 14.5 L27 14.5 L21 19 L23.5 26.5 L16 22 L8.5 26.5 L11 19 L5 14.5 L12.5 14.5 Z"
        fill="none"
        stroke={T.mint}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="10" r="2" fill={T.mint} opacity="0.7" />
      <circle cx="11" cy="9" r="1.2" fill={T.mint} opacity="0.5" />
    </svg>
  );
}

export function RSBadge({
  children,
  color = T.mint,
  small,
}: {
  children: React.ReactNode;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: `${color}14`,
        color,
        borderRadius: 100,
        padding: small ? '2px 8px' : '3px 10px',
        fontSize: small ? 10 : 11,
        fontWeight: 600,
        fontFamily: T.mono,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        border: `1px solid ${color}22`,
      }}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  style = {},
  glow,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: boolean;
}) {
  return (
    <div
      style={{
        background: T.bg2,
        borderRadius: 18,
        border: `1px solid ${glow ? T.borderMid : T.border}`,
        ...(glow ? { boxShadow: `0 0 40px rgba(45,255,193,0.04)` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatPill({
  label,
  value,
  unit,
  color = T.text,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: T.bg3,
        borderRadius: 14,
        padding: '10px 14px',
        flex: 1,
        minWidth: 0,
        border: `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: T.mono,
          color: T.textMut,
          letterSpacing: '0.06em',
          marginBottom: 5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: T.f1, color, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 10, color: T.textMut, fontFamily: T.mono }}>{unit}</span>}
      </div>
    </div>
  );
}

export function Ring({
  pct,
  size = 52,
  stroke = 4,
  color = T.mint,
  label,
  sublabel,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.bg3} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
        />
      </svg>
      {label && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: size > 60 ? 18 : 13,
              fontWeight: 700,
              fontFamily: T.f1,
              color,
              lineHeight: 1,
            }}
          >
            {label}
          </span>
          {sublabel && (
            <span
              style={{
                fontSize: 8,
                color: T.textMut,
                fontFamily: T.mono,
                marginTop: 2,
                letterSpacing: '0.04em',
              }}
            >
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AIBubble({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${T.bg2} 0%, ${T.bg3} 100%)`,
        border: `1px solid ${T.borderMid}`,
        borderRadius: 16,
        padding: compact ? '10px 14px' : '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: compact ? 5 : 8,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${T.mint} 0%, #00C896 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M5 1L6.5 4H9.5L7 6L8 9L5 7L2 9L3 6L0.5 4H3.5L5 1Z" fill="#000" />
          </svg>
        </div>
        <span
          style={{ fontSize: 10, fontFamily: T.mono, color: T.mint, letterSpacing: '0.07em' }}
        >
          AI COACH
        </span>
      </div>
      <p
        style={{
          fontSize: compact ? 12 : 13,
          color: T.textSec,
          lineHeight: 1.65,
          fontFamily: T.f2,
          margin: 0,
        }}
      >
        {text}
      </p>
    </div>
  );
}

type WeekDayType = 'easy' | 'tempo' | 'strength' | 'interval' | 'rest' | 'long';

export function WeekStrip() {
  const days: Array<{ d: string; n: number; type: WeekDayType; done?: boolean; active?: boolean }> = [
    { d: 'M', n: 14, type: 'easy', done: true },
    { d: 'T', n: 15, type: 'tempo', done: true },
    { d: 'W', n: 16, type: 'strength', done: true },
    { d: 'T', n: 17, type: 'interval', active: true },
    { d: 'F', n: 18, type: 'rest' },
    { d: 'S', n: 19, type: 'easy' },
    { d: 'S', n: 20, type: 'long' },
  ];
  const typeColor: Record<WeekDayType, string> = {
    easy: T.blue,
    tempo: T.mint,
    strength: T.gold,
    interval: T.coral,
    rest: T.textMut,
    long: '#C084FC',
  };
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'space-between' }}>
      {days.map((day, i) => {
        const c = typeColor[day.type];
        return (
          <div
            key={i}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
          >
            <span
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: day.active ? T.mint : T.textMut,
                letterSpacing: '0.04em',
              }}
            >
              {day.d}
            </span>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: day.active ? T.mint : day.done ? T.bg4 : T.bg2,
                border: `1px solid ${
                  day.active ? T.mint : day.done ? T.borderMid : T.border
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: T.f1,
                  color: day.active ? '#070E09' : day.done ? T.textSec : T.textMut,
                }}
              >
                {day.n}
              </span>
              {day.done && !day.active && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: T.mint,
                    border: `2px solid ${T.bg0}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="5" height="4" viewBox="0 0 6 5">
                    <path
                      d="M1 2.5l1.5 1.5L5 1"
                      stroke="#000"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: day.type === 'rest' ? 'transparent' : c,
                opacity: day.done ? 0.35 : 0.8,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
