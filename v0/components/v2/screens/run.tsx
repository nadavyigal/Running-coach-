'use client';

import React from 'react';
import { T } from '../tokens';
import { LogoMark } from '../primitives';

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function RunScreen() {
  const [isRunning, setIsRunning] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(26 * 60 + 54);

  React.useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  return (
    <div
      style={{
        background: T.bg0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '52px 20px 0', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <LogoMark size={22} />
          <span style={{ fontSize: 17, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
            Run
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.textSec}
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `linear-gradient(135deg,${T.mint}30,${T.bg3})`,
                border: `1px solid ${T.borderMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.f1, color: T.mint }}>
                A
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Coach cue banner */}
      <div
        style={{
          margin: '0 16px 12px',
          background: T.bg2,
          border: `1px solid ${T.borderMid}`,
          borderRadius: 18,
          padding: '14px 16px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: `linear-gradient(135deg,${T.mint}20,${T.bg3})`,
            border: `1px solid ${T.borderMid}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1L7.5 4.5H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4.5H4.5L6 1Z"
              fill={T.gold}
            />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.gold,
              letterSpacing: '0.07em',
              marginBottom: 3,
            }}
          >
            COACH CUE
          </div>
          <p style={{ fontSize: 13, color: T.text, fontFamily: T.f2, lineHeight: 1.4, margin: 0 }}>
            Ease your shoulders. Hold 5:10 pace for the next minute.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {[3, 5, 7, 5, 4, 6, 5, 7, 5, 4].map((h, i) => (
            <div
              key={i}
              style={{
                width: 2,
                height: h,
                borderRadius: 1,
                background: `${T.mint}${i > 6 ? 'ff' : '50'}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div
        style={{
          margin: '0 16px 12px',
          background: T.bg2,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          padding: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              DISTANCE
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}
            >
              5.24
              <span style={{ fontSize: 14, color: T.textMut, marginLeft: 2 }}>km</span>
            </div>
          </div>
          {/* Center ring */}
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke={T.bg3} strokeWidth="3" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke={T.mint}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28 * 0.65} ${2 * Math.PI * 28}`}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.mint}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M13 4v7h7l-9 9v-7H4l9-9z" />
              </svg>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
              }}
            >
              PACE
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}
            >
              5:08
              <span style={{ fontSize: 12, color: T.textMut, marginLeft: 2 }}>/km</span>
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              TIME
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}
            >
              {fmt(elapsed)}
            </div>
          </div>
          <div />
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 4,
              }}
            >
              HEART RATE
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.coral}
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <div
              style={{ fontSize: 32, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}
            >
              154
              <span style={{ fontSize: 12, color: T.textMut, marginLeft: 2 }}>bpm</span>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Map */}
      <div
        style={{
          margin: '0 16px 12px',
          background: T.bg2,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          overflow: 'hidden',
          height: 110,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="rs-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M24 0L0 0 0 24"
                fill="none"
                stroke="rgba(45,255,193,0.05)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rs-grid)" />
          <polyline
            points="20,85 50,70 80,75 110,55 150,60 190,40 230,50 265,30 290,35 310,25"
            fill="none"
            stroke={T.mint}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="85" r="5" fill={T.mint} opacity="0.6" />
          <circle cx="310" cy="25" r="5" fill="#fff" />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <div
            style={{
              background: T.bg3,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '3px 8px',
              display: 'flex',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <svg width="8" height="8" viewBox="0 0 24 24" fill={T.mint}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            </svg>
            <span style={{ fontSize: 9, fontFamily: T.mono, color: T.mint }}>GPS</span>
            <div style={{ display: 'flex', gap: 1 }}>
              {[4, 7, 10, 7].map((h, i) => (
                <div key={i} style={{ width: 2, height: h, borderRadius: 1, background: T.mint }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 8, right: 10 }}>
          <div
            style={{
              background: 'rgba(7,14,9,0.7)',
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: '4px 6px',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.textSec}
              strokeWidth="2"
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Coach cue + cadence */}
      <div style={{ margin: '0 16px 10px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <div
          style={{
            flex: 1.6,
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1L7.5 4.5H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4.5H4.5L6 1Z"
                fill={T.gold}
              />
            </svg>
            <span
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                letterSpacing: '0.06em',
              }}
            >
              COACH CUE
            </span>
          </div>
          <p style={{ fontSize: 12, color: T.text, fontFamily: T.f2, lineHeight: 1.4, margin: 0 }}>
            Hold steady. Relax your shoulders.
          </p>
        </div>
        <div
          style={{
            flex: 1,
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.textMut,
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            CADENCE
          </div>
          <div
            style={{ fontSize: 22, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}
          >
            172
            <span style={{ fontSize: 10, color: T.textMut, marginLeft: 2 }}>spm</span>
          </div>
          <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
            {[4, 6, 5, 7, 6, 8, 7, 6, 7, 8].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h * 1.4,
                  borderRadius: 1,
                  background: `${T.mint}${i > 6 ? 'ff' : '60'}`,
                  alignSelf: 'flex-end',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Elevation, Zone, Pace trend */}
      <div style={{ margin: '0 16px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
        {/* Elevation */}
        <div
          style={{
            flex: 1,
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 10px 8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontFamily: T.mono,
              color: T.textMut,
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            ELEVATION
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}>
            28<span style={{ fontSize: 9, color: T.textMut, marginLeft: 2 }}>m</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <svg width="50" height="16" viewBox="0 0 50 16">
              <polyline points="0,14 8,10 18,8 28,12 38,5 50,8" fill="none" stroke={T.blue} strokeWidth="1.5" />
            </svg>
          </div>
        </div>
        {/* Zone */}
        <div
          style={{
            flex: 1,
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 10px 8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontFamily: T.mono,
              color: T.textMut,
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            ZONE
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}>
            4<span style={{ fontSize: 9, color: T.textMut, marginLeft: 2 }}>Threshold</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 2, marginTop: 4 }}>
            {['#5B9BFF', '#2DFFC1', '#FFD166', '#FF6B6B', '#C084FC'].map((c, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: c,
                  opacity: i === 3 ? 1 : 0.35,
                }}
              />
            ))}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                left: 'calc(68% - 4px)',
                top: -2,
              }}
            />
          </div>
        </div>
        {/* Pace trend */}
        <div
          style={{
            flex: 1,
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 10px 8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontFamily: T.mono,
              color: T.textMut,
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            PACE TREND
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: T.f1, color: T.text, lineHeight: 1 }}>
            −0:03
            <span style={{ fontSize: 9, color: T.textMut, marginLeft: 2 }}>/km</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <svg width="50" height="16" viewBox="0 0 50 16">
              <polyline
                points="0,12 10,11 20,10 30,8 40,6 50,5"
                fill="none"
                stroke={T.mint}
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div style={{ fontSize: 9, color: T.textMut, fontFamily: T.mono, marginTop: 2 }}>
            vs last km
          </div>
        </div>
      </div>

      {/* Run controls */}
      <div
        style={{
          margin: '0 16px 16px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Audio */}
        <button
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            width: 56,
            height: 48,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.textSec}
            strokeWidth="2"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
            <path d="M15.54 8.46a5 5 0 010 7.07" />
          </svg>
          <span
            style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec, letterSpacing: '0.04em' }}
          >
            Audio
          </span>
        </button>
        {/* Lap */}
        <button
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            width: 56,
            height: 48,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.textSec}
            strokeWidth="2"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <span
            style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec, letterSpacing: '0.04em' }}
          >
            Lap
          </span>
        </button>
        {/* Pause/Resume */}
        <button
          onClick={() => setIsRunning((r) => !r)}
          style={{
            background: T.mint,
            border: 'none',
            borderRadius: '50%',
            width: 56,
            height: 56,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            boxShadow: '0 0 20px rgba(45,255,193,0.35)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {isRunning ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#070E09">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#070E09">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          <span
            style={{ fontSize: 9, fontFamily: T.mono, color: '#070E09', letterSpacing: '0.04em' }}
          >
            {isRunning ? 'Pause' : 'Resume'}
          </span>
        </button>
        {/* Finish */}
        <button
          style={{
            background: 'rgba(255,107,107,0.15)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 14,
            width: 56,
            height: 48,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 3, background: T.coral }} />
          <span
            style={{ fontSize: 9, fontFamily: T.mono, color: T.coral, letterSpacing: '0.04em' }}
          >
            Finish
          </span>
        </button>
      </div>
    </div>
  );
}
