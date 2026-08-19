'use client';

import React from 'react';
import { T } from '../tokens';
import { LogoMark, Ring } from '../primitives';

type Msg = { role: 'user' | 'ai'; text: string; time: string };

const initialMessages: Msg[] = [
  {
    role: 'user',
    text: "Hey Coach, should I do today's workout or take more recovery?",
    time: '9:30 AM',
  },
  {
    role: 'ai',
    text: "Great question, Alex. Your readiness is high (82) and your sleep was solid. You're good to go for today's Tempo Builder.\n\nIt's a quality session that will improve your threshold and endurance.",
    time: '9:31 AM',
  },
  { role: 'user', text: 'What should I focus on during the run?', time: '9:32 AM' },
  {
    role: 'ai',
    text: 'Focus on steady effort and controlled breathing. Aim to keep your pace around 5’15"/km and hold strong on the climbs. You’ve got this! 💪',
    time: '9:32 AM',
  },
];

export function TodayScreen() {
  const [inputVal, setInputVal] = React.useState('');
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages);
  const [loading, setLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = () => {
    if (!inputVal.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: inputVal, time: 'Just now' }]);
    setInputVal('');
    setLoading(true);
    // Mock reply (no real AI in v2 preview)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: "I'm here to help — keep moving forward, Alex!",
          time: 'Just now',
        },
      ]);
      setLoading(false);
    }, 900);
  };

  return (
    <div
      style={{
        background: T.bg0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '52px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogoMark size={24} />
            <span style={{ fontSize: 17, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
              RunSmart
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
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
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: T.mint,
                }}
              />
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${T.mint}30, ${T.bg3})`,
                border: `2px solid ${T.borderMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.f1, color: T.mint }}>
                A
              </span>
            </div>
          </div>
        </div>

        {/* AI Coach intro */}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 1L7.5 4.5H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4.5H4.5L6 1Z"
                  fill={T.mint}
                />
              </svg>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: T.mono,
                  color: T.mint,
                  letterSpacing: '0.08em',
                }}
              >
                AI COACH
              </span>
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: T.f1,
                color: T.text,
                lineHeight: 1.2,
                marginBottom: 2,
              }}
            >
              Hi Alex, I&apos;m here to help you
              <br />
              run stronger and smarter.
            </h2>
            <p style={{ fontSize: 12, color: T.textSec, fontFamily: T.f2 }}>
              What would you like to know?
            </p>
          </div>
          {/* Coach Spark avatar */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: T.bg2,
              border: `2px solid ${T.borderMid}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke={T.mint} strokeWidth="1.2" opacity="0.3" />
              <circle cx="9" cy="12" r="2.5" fill={T.mint} opacity="0.9" />
              <circle cx="19" cy="12" r="2.5" fill={T.mint} opacity="0.9" />
            </svg>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: T.mint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#070E09',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 8 }}>
          {/* Readiness */}
          <div
            style={{
              background: T.bg2,
              borderRadius: 14,
              padding: '10px 12px',
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                letterSpacing: '0.07em',
                marginBottom: 6,
              }}
            >
              READINESS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ring pct={0.82} size={36} stroke={3} color={T.mint} label="82" />
            </div>
            <div
              style={{
                fontSize: 10,
                color: T.mint,
                fontFamily: T.f2,
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              High
            </div>
          </div>
          {/* Next workout */}
          <div
            style={{
              background: T.bg2,
              borderRadius: 14,
              padding: '10px 12px',
              border: `1px solid ${T.borderMid}`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.mint,
                letterSpacing: '0.07em',
                marginBottom: 4,
              }}
            >
              NEXT WORKOUT
            </div>
            <div style={{ fontSize: 9, color: T.textMut, fontFamily: T.f2, marginBottom: 2 }}>
              Tomorrow · 8:00 AM
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: T.f1,
                color: T.text,
                lineHeight: 1.2,
                marginBottom: 4,
              }}
            >
              Tempo Builder
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textSec}
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: 9, color: T.textSec, fontFamily: T.mono }}>8.2 km</span>
              <span style={{ fontSize: 9, color: T.textMut, fontFamily: T.mono }}>
                · 5&apos;15&quot;/km
              </span>
            </div>
            <div style={{ marginTop: 4 }}>
              <span
                style={{
                  fontSize: 8,
                  fontFamily: T.mono,
                  background: T.goldDim,
                  color: T.gold,
                  borderRadius: 4,
                  padding: '2px 5px',
                }}
              >
                Quality
              </span>
            </div>
          </div>
          {/* Recovery */}
          <div
            style={{
              background: T.bg2,
              borderRadius: 14,
              padding: '10px 12px',
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontFamily: T.mono,
                color: T.textMut,
                letterSpacing: '0.07em',
                marginBottom: 6,
              }}
            >
              RECOVERY
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: T.f1, color: T.mint }}>
              Good
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textMut}
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
              <span style={{ fontSize: 9, color: T.textSec, fontFamily: T.mono }}>7h 48m</span>
            </div>
            <div style={{ display: 'flex', gap: 2, marginTop: 5 }}>
              {[3, 4, 5, 5, 4, 5, 4, 3].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    borderRadius: 2,
                    height: h * 2,
                    background: i > 5 ? T.mint : `${T.mint}40`,
                    alignSelf: 'flex-end',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            {m.role === 'ai' && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: T.bg2,
                  border: `1px solid ${T.borderMid}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="4" cy="5" r="1.8" fill={T.mint} opacity="0.9" />
                  <circle cx="8" cy="5" r="1.8" fill={T.mint} opacity="0.9" />
                </svg>
              </div>
            )}
            <div style={{ maxWidth: '80%' }}>
              <div
                style={{
                  background: m.role === 'user' ? T.mintDim : T.bg2,
                  border: `1px solid ${m.role === 'user' ? T.borderMid : T.border}`,
                  borderRadius:
                    m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  padding: '10px 14px',
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: m.role === 'user' ? T.mint : T.textSec,
                    lineHeight: 1.6,
                    fontFamily: T.f2,
                    margin: 0,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {m.text}
                </p>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: T.textMut,
                  fontFamily: T.mono,
                  marginTop: 3,
                  textAlign: m.role === 'user' ? 'right' : 'left',
                }}
              >
                {m.time} {m.role === 'user' && <span style={{ color: T.mint }}>✓✓</span>}
              </div>
            </div>
            {m.role === 'user' && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${T.mint}30, ${T.bg3})`,
                  border: `1px solid ${T.borderMid}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: T.f1, color: T.mint }}>
                  A
                </span>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: T.bg2,
                border: `1px solid ${T.borderMid}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="4" cy="5" r="1.8" fill={T.mint} opacity="0.9" />
                <circle cx="8" cy="5" r="1.8" fill={T.mint} opacity="0.9" />
              </svg>
            </div>
            <div
              style={{
                background: T.bg2,
                border: `1px solid ${T.border}`,
                borderRadius: '4px 16px 16px 16px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: T.mint,
                      opacity: 0.6,
                      animation: `rs-bounce 1s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        <div style={{ height: 8 }} />
      </div>

      {/* Quick actions */}
      <div style={{ padding: '8px 16px 4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {['Adjust Workout', 'Explain Tempo', 'Recovery Tips'].map((chip) => (
            <button
              key={chip}
              onClick={() => setInputVal(chip)}
              style={{
                background: T.bg2,
                border: `1px solid ${T.border}`,
                borderRadius: 20,
                padding: '6px 12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: 11,
                color: T.textSec,
                fontFamily: T.f2,
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Voice + text input */}
      <div style={{ padding: '8px 16px 16px', flexShrink: 0 }}>
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, color: T.textMut, fontFamily: T.f2, flex: 1 }}>
            {inputVal || 'Tap to talk'}
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[2, 4, 6, 4, 3, 5, 4, 3, 5, 4].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: h * 2,
                  borderRadius: 1,
                  background: `${T.mint}40`,
                }}
              />
            ))}
          </div>
          <button
            onClick={() => {
              if (inputVal) sendMessage();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: `linear-gradient(135deg, ${T.mint} 0%, #00C896 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 0 16px rgba(45,255,193,0.4)`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#070E09">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[4, 5, 3, 6, 4, 5, 3, 4, 6, 3].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 2,
                  height: h * 2,
                  borderRadius: 1,
                  background: `${T.mint}40`,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: T.mint,
              }}
            />
            <span style={{ fontSize: 9, fontFamily: T.mono, color: T.mint }}>listening</span>
          </div>
        </div>
        <p
          style={{
            fontSize: 9,
            color: T.textMut,
            fontFamily: T.mono,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          Coach responses may not be perfect. Always listen to your body.
        </p>
      </div>
    </div>
  );
}
