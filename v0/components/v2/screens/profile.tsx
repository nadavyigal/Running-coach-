'use client';

import React from 'react';
import { T } from '../tokens';

const achievements = [
  { label: 'Threshold PR', icon: '⚡', isNew: true, color: T.mint },
  { label: 'Early Riser', icon: '🌅', color: T.blue },
  { label: 'Consistency', icon: '10K', color: T.mint },
  { label: 'Long Run', icon: '15K', color: T.gold },
  { label: 'Week Warrior', icon: '★', color: '#C084FC' },
];

const coachSettings = [
  { label: 'Voice Coaching', val: 'On', icon: '🔊' },
  { label: 'Coaching Tone', val: 'Motivating', icon: '📊' },
  { label: 'Goal Focus', val: '10K Improvement', icon: '🎯' },
  { label: 'Check-in Cadence', val: 'Every 3 Days', icon: '📅' },
];

const stats: Array<[string, string, string, string]> = [
  ['14', 'LEVEL', T.mint, 'Peak Performer'],
  ['128', 'TOTAL RUNS', T.text, ''],
  ['842 km', 'DISTANCE', T.text, ''],
  ['83h 21m', 'TOTAL TIME', T.text, ''],
];

export function ProfileScreen() {
  return (
    <div style={{ background: T.bg0, minHeight: '100%', paddingBottom: 90, overflowY: 'auto' }}>
      <div style={{ padding: '52px 20px 0' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
            Profile
          </h1>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.textSec}
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </div>

        {/* Profile hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: `linear-gradient(135deg,${T.mint}20,${T.bg3})`,
              border: `3px solid ${T.mint}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, fontFamily: T.f1, color: T.mint }}>A</span>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: T.mint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${T.bg0}`,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path
                  d="M5 1L6.5 4H9.5L7 6L8 9L5 7L2 9L3 6L0.5 4H3.5L5 1Z"
                  fill="#070E09"
                />
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
              Alex Morgan
            </div>
            <div style={{ fontSize: 12, color: T.textSec, fontFamily: T.f2 }}>
              10K focused · 11-week streak
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '12px 0',
            marginBottom: 16,
            display: 'flex',
          }}
        >
          {stats.map(([val, label, color, sub], i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                borderRight: i < 3 ? `1px solid ${T.border}` : 'none',
                padding: '0 8px',
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontFamily: T.mono,
                  color: T.textMut,
                  letterSpacing: '0.06em',
                  marginBottom: 3,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: T.f1,
                  color,
                  lineHeight: 1,
                }}
              >
                {val}
              </div>
              {sub && (
                <div style={{ fontSize: 9, fontFamily: T.mono, color: T.mint, marginTop: 2 }}>
                  {sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Coach Spark card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0E2018 0%, #0A1A10 100%)',
            border: `1px solid ${T.borderMid}`,
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -10,
              top: -10,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${T.mint}15 0%, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: 0.15,
            }}
          >
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke={T.mint} strokeWidth="1" />
              <circle cx="40" cy="40" r="28" stroke={T.mint} strokeWidth="0.8" />
              <path
                d="M40 10L45 28H63L49 38L54 56L40 46L26 56L31 38L17 28H35L40 10Z"
                stroke={T.mint}
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.mint,
              letterSpacing: '0.08em',
              marginBottom: 8,
              position: 'relative',
            }}
          >
            YOUR AI COACH
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
              Coach Spark
            </span>
            <div
              style={{
                background: T.mintDim,
                border: `1px solid ${T.borderMid}`,
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.mint }}>AI</span>
            </div>
          </div>
          <p
            style={{
              fontSize: 12,
              color: T.textSec,
              fontFamily: T.f2,
              lineHeight: 1.5,
              margin: '0 0 6px',
              position: 'relative',
            }}
          >
            Adaptive. Motivating. Data-driven.
          </p>
          <p
            style={{
              fontSize: 11,
              color: T.textMut,
              fontFamily: T.f2,
              lineHeight: 1.5,
              margin: '0 0 12px',
              position: 'relative',
            }}
          >
            I analyze your data, adapt your plan in real-time, and coach you to be your best.
          </p>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.mint }} />
            <span style={{ fontSize: 11, fontFamily: T.mono, color: T.mint }}>
              Active · Chat on Today tab
            </span>
          </div>
        </div>

        {/* Coach settings */}
        <div
          style={{
            fontSize: 10,
            fontFamily: T.mono,
            color: T.textMut,
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          COACH SETTINGS
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}
        >
          {coachSettings.map((s) => (
            <button
              key={s.label}
              style={{
                background: T.bg2,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: '10px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <div
                style={{
                  fontSize: 10,
                  color: T.textMut,
                  fontFamily: T.mono,
                  letterSpacing: '0.04em',
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.mint,
                  fontFamily: T.f2,
                  fontWeight: 600,
                }}
              >
                {s.val}
              </div>
            </button>
          ))}
        </div>

        {/* Coach optimizing for */}
        <div
          style={{
            fontSize: 10,
            fontFamily: T.mono,
            color: T.textMut,
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          COACH OPTIMIZING FOR
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, marginBottom: 16 }}
        >
          <div
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: T.f2,
                color: T.text,
                marginBottom: 4,
              }}
            >
              10K Improvement
            </div>
            <svg width="100%" height="28" viewBox="0 0 80 28">
              <polyline
                points="0,24 12,20 24,18 36,16 48,12 60,8 72,5 80,4"
                fill="none"
                stroke={T.mint}
                strokeWidth="1.8"
              />
            </svg>
            <div style={{ fontSize: 10, color: T.textMut, fontFamily: T.mono }}>
              49:12 → 46:30
            </div>
            <div style={{ fontSize: 9, color: T.textMut, fontFamily: T.mono }}>Target PR</div>
          </div>
          <div
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: T.f2,
                color: T.text,
                marginBottom: 4,
              }}
            >
              Consistency
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                alignItems: 'flex-end',
                height: 28,
                marginBottom: 4,
              }}
            >
              {[3, 5, 4, 6, 5, 7, 6].map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: 2,
                    height: h * 3.5,
                    background: i === 6 ? T.mint : `${T.mint}50`,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
              92%
            </div>
            <div style={{ fontSize: 9, color: T.mint, fontFamily: T.mono }}>On track</div>
          </div>
          <div
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: T.f2,
                color: T.text,
                marginBottom: 4,
              }}
            >
              Recovery
            </div>
            <div style={{ position: 'relative', width: 40, height: 40, margin: '4px auto' }}>
              <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="20" cy="20" r="17" fill="none" stroke={T.bg3} strokeWidth="3" />
                <circle
                  cx="20"
                  cy="20"
                  r="17"
                  fill="none"
                  stroke={T.mint}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 17 * 0.85} ${2 * Math.PI * 17}`}
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill={T.mint}>
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
              85%
            </div>
            <div style={{ fontSize: 9, color: T.mint, fontFamily: T.mono }}>Optimal</div>
          </div>
        </div>

        {/* Achievements */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: T.mono,
              color: T.textMut,
              letterSpacing: '0.08em',
            }}
          >
            ACHIEVEMENTS
          </div>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.mint, cursor: 'pointer' }}>
            View all
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {achievements.map((a, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: T.bg2,
                  border: `1px solid ${a.isNew ? T.mint : T.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    fontSize: a.icon.length > 1 ? 11 : 18,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: a.color || T.mint,
                  }}
                >
                  {a.icon}
                </span>
                {a.isNew && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      background: T.mint,
                      borderRadius: 6,
                      padding: '1px 4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 7,
                        fontFamily: T.mono,
                        color: '#070E09',
                        fontWeight: 700,
                      }}
                    >
                      NEW
                    </span>
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 8,
                  fontFamily: T.mono,
                  color: T.textMut,
                  textAlign: 'center',
                  maxWidth: 48,
                  lineHeight: 1.2,
                }}
              >
                {a.label}
              </span>
            </div>
          ))}
        </div>

        {/* Connected apps */}
        <div
          style={{
            fontSize: 10,
            fontFamily: T.mono,
            color: T.textMut,
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          CONNECTED
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}
        >
          {[
            { name: 'Garmin Connect', color: '#00A4D3' },
            { name: 'Strava', color: '#FC4C02' },
          ].map((app) => (
            <div
              key={app.name}
              style={{
                background: T.bg2,
                border: `1px solid ${T.border}`,
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: app.color,
                    marginBottom: 4,
                  }}
                >
                  {app.name.split(' ')[0]}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{ width: 5, height: 5, borderRadius: '50%', background: T.mint }}
                  />
                  <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec }}>
                    Connected
                  </span>
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textMut}
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
