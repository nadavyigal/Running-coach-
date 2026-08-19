'use client';

import React from 'react';
import { T } from '../tokens';

type Goal = { id: string; label: string; icon: string };
type Level = { id: string; label: string; sub: string };

const goals: Goal[] = [
  { id: 'first5k', label: 'Run my first 5K', icon: '🏁' },
  { id: 'halfmarathon', label: 'Half marathon', icon: '🥈' },
  { id: 'marathon', label: 'Full marathon', icon: '🏆' },
  { id: 'speed', label: 'Get faster', icon: '⚡' },
  { id: 'fitness', label: 'Stay fit & healthy', icon: '💚' },
  { id: 'habit', label: 'Build a habit', icon: '🔄' },
];

const levels: Level[] = [
  { id: 'new', label: 'New to running', sub: 'Less than 6 months' },
  { id: 'casual', label: 'Casual runner', sub: '1–3 runs/week' },
  { id: 'regular', label: 'Regular runner', sub: '3–5 runs/week' },
  { id: 'experienced', label: 'Experienced', sub: '5K < 25min' },
];

export function OnboardingScreen({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = React.useState(0);
  const [goal, setGoal] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState<string | null>(null);
  const [days, setDays] = React.useState(4);

  const stepKicker = (text: string) => (
    <p
      style={{
        fontSize: 12,
        fontFamily: T.mono,
        color: T.mint,
        letterSpacing: '0.08em',
        marginBottom: 12,
      }}
    >
      {text}
    </p>
  );

  const stepHeading = (children: React.ReactNode, mb = 24) => (
    <h2
      style={{
        fontSize: 26,
        fontWeight: 700,
        fontFamily: T.f1,
        color: T.text,
        lineHeight: 1.15,
        marginBottom: mb,
      }}
    >
      {children}
    </h2>
  );

  return (
    <div
      style={{
        background: T.bg0,
        minHeight: '100%',
        padding: '72px 20px 40px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= step ? T.mint : T.bg3,
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {step === 0 && (
        <div>
          {stepKicker("WHAT'S YOUR GOAL?")}
          {stepHeading(
            <>
              What do you want
              <br />
              to achieve?
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {goals.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setGoal(g.id);
                  setTimeout(() => setStep(1), 200);
                }}
                style={{
                  background: goal === g.id ? T.mintDim : T.bg3,
                  border: `1px solid ${goal === g.id ? T.mint : T.border}`,
                  borderRadius: 14,
                  padding: '14px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{g.icon}</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: T.f2,
                    color: T.text,
                    lineHeight: 1.3,
                  }}
                >
                  {g.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          {stepKicker('YOUR EXPERIENCE')}
          {stepHeading(
            <>
              How would you describe
              <br />
              yourself?
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {levels.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setLevel(l.id);
                  setTimeout(() => setStep(2), 200);
                }}
                style={{
                  background: level === l.id ? T.mintDim : T.bg3,
                  border: `1px solid ${level === l.id ? T.mint : T.border}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: T.f2,
                      color: T.text,
                    }}
                  >
                    {l.label}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{l.sub}</div>
                </div>
                {level === l.id && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: T.mint,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="#070E09"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {stepKicker('YOUR SCHEDULE')}
          {stepHeading(
            <>
              How many days
              <br />
              can you run?
            </>,
            10
          )}
          <p style={{ fontSize: 13, color: T.textSec, marginBottom: 32, fontFamily: T.f2 }}>
            We&apos;ll build your plan around your life.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <span
              style={{
                fontSize: 80,
                fontWeight: 700,
                fontFamily: T.f1,
                color: T.mint,
                lineHeight: 1,
              }}
            >
              {days}
            </span>
            <span
              style={{
                fontSize: 20,
                color: T.textSec,
                fontFamily: T.f2,
                alignSelf: 'flex-end',
                marginBottom: 12,
                marginLeft: 8,
              }}
            >
              days/week
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
            {[2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid ${days === d ? T.mint : T.border}`,
                  background: days === d ? T.mintDim : T.bg3,
                  color: days === d ? T.mint : T.textSec,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: T.f1,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(3)}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              background: `linear-gradient(135deg, ${T.mint} 0%, #00C896 100%)`,
              color: '#070E09',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: T.f1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Build My Plan
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ textAlign: 'center', paddingTop: 20 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 22,
              background: T.mintDim,
              border: `1px solid ${T.borderMid}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 6L20 13.5H28L22 18.5L24.5 26L16 21L7.5 26L10 18.5L4 13.5H12L16 6Z"
                stroke={T.mint}
                strokeWidth="2"
                strokeLinejoin="round"
                fill={T.mintDim}
              />
            </svg>
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: T.f1,
              color: T.text,
              marginBottom: 12,
              lineHeight: 1.15,
            }}
          >
            Your plan is ready,
            <br />
            Alex.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: T.textSec,
              lineHeight: 1.6,
              fontFamily: T.f2,
              marginBottom: 32,
            }}
          >
            16-week plan · 4 days/week.
            <br />
            First run: Thursday, 8.2km tempo.
          </p>
          <div
            style={{
              background: T.bg2,
              borderRadius: 16,
              padding: 16,
              marginBottom: 28,
              border: `1px solid ${T.border}`,
              textAlign: 'left',
            }}
          >
            {(
              [
                ['Focus', 'Tempo · Build Aerobic Endurance'],
                ['Race day', 'Sun, Oct 12'],
                ['Runs/week', '4 sessions'],
                ['AI coach', 'Coach Spark — Active'],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: `1px solid ${T.border}`,
                }}
              >
                <span style={{ fontSize: 12, color: T.textSec, fontFamily: T.f2 }}>{k}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: T.f2,
                    color: T.text,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onDone}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              background: `linear-gradient(135deg, ${T.mint} 0%, #00C896 100%)`,
              color: '#070E09',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: T.f1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Let&apos;s Go →
          </button>
        </div>
      )}
    </div>
  );
}
