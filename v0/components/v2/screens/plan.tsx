'use client';

import React from 'react';
import { T } from '../tokens';

type WorkoutType = 'easy' | 'interval' | 'tempo' | 'strength' | 'rest' | 'long';

const typeColor: Record<WorkoutType, string> = {
  easy: T.blue,
  interval: T.coral,
  tempo: T.mint,
  strength: T.gold,
  rest: T.textMut,
  long: '#C084FC',
};

const typeIcon: Record<WorkoutType, React.ReactNode> = {
  easy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8l4 4-4 4" />
    </svg>
  ),
  interval: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  tempo: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  strength: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="12" x2="18" y2="12" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
    </svg>
  ),
  rest: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  long: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
};

type WeekDay = {
  d: string;
  n: number;
  type: WorkoutType;
  dist: string;
  done?: boolean;
  active?: boolean;
  note?: boolean;
};

const weekDays: WeekDay[] = [
  { d: 'MON', n: 28, type: 'easy', dist: '5 km', done: true },
  { d: 'TUE', n: 29, type: 'interval', dist: '8×400m', done: true },
  { d: 'WED', n: 30, type: 'tempo', dist: '8.2 km', active: true, note: true },
  { d: 'THU', n: 1, type: 'strength', dist: '45 min' },
  { d: 'FRI', n: 2, type: 'rest', dist: 'Recovery' },
  { d: 'SAT', n: 3, type: 'easy', dist: '6 km' },
  { d: 'SUN', n: 4, type: 'long', dist: '14 km', note: true },
];

const monthDays = [28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const dotColors: Array<string | null> = [
  T.blue,
  T.coral,
  T.mint,
  T.gold,
  null,
  T.blue,
  '#C084FC',
  T.blue,
  T.mint,
  T.gold,
  null,
  T.blue,
  '#C084FC',
];

const coachNotes = [
  {
    title: 'Wednesday: Tempo Run',
    sub: "We're targeting threshold. Keep the effort controlled and finish strong. You've got this.",
    dot: true,
  },
  {
    title: 'Sunday: Long Run',
    sub: 'Build endurance, not speed. Stay easy, fuel well, and enjoy the rhythm.',
    dot: true,
  },
];

export function PlanScreen() {
  const [activeDay, setActiveDay] = React.useState(2);

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
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: T.f1, color: T.text }}>Plan</h1>
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
                  background: T.gold,
                }}
              />
            </div>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: `linear-gradient(135deg,${T.mint}30,${T.bg3})`,
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

        {/* AI Coach Briefing */}
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.borderMid}`,
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: T.bg3,
                border: `2px solid ${T.mint}`,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="9" cy="12" r="3" fill={T.mint} opacity="0.85" />
                <circle cx="17" cy="12" r="3" fill={T.mint} opacity="0.85" />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: T.bg0,
                  border: `1px solid ${T.borderMid}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1L6.5 4H9.5L7 6L8 9L5 7L2 9L3 6L0.5 4H3.5L5 1Z"
                    fill={T.mint}
                  />
                </svg>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: T.mono,
                  color: T.mint,
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                }}
              >
                AI COACH BRIEFING
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: T.text,
                  fontFamily: T.f2,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                Strong week ahead, Alex. Your recovery is on point and last week&apos;s tempo
                looked solid. We&apos;re building fitness with a tempo focus midweek and a
                steady long run on Sunday.
              </p>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, fontFamily: T.mono, color: T.mint }}>Focus: </span>
                <span style={{ fontSize: 11, fontFamily: T.mono, color: T.mint }}>
                  Tempo · Build Aerobic Endurance
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* This week */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
            This Week
          </span>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textMut }}>Apr 28 – May 4</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 20,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {weekDays.map((day, i) => {
            const c = typeColor[day.type];
            const isActive = day.active;
            return (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                style={{
                  flex: '0 0 auto',
                  width: 46,
                  background: isActive ? T.bg3 : activeDay === i ? T.bg2 : 'transparent',
                  border: `1px solid ${
                    isActive ? T.mint : activeDay === i ? T.border : 'transparent'
                  }`,
                  borderRadius: 14,
                  padding: '10px 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: T.mono,
                    color: isActive ? T.mint : T.textMut,
                  }}
                >
                  {day.d}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: isActive ? T.text : T.textSec,
                  }}
                >
                  {day.n}
                </span>
                <div style={{ color: c, opacity: day.type === 'rest' ? 0.4 : 1 }}>
                  {typeIcon[day.type]}
                </div>
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: T.mono,
                    color: T.textMut,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {day.dist}
                </span>
                <div style={{ display: 'flex', gap: 3 }}>
                  {day.done && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: T.mint,
                      }}
                    />
                  )}
                  {day.note && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: T.textMut,
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* May overview */}
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
              May Overview
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textSec}
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.textSec}
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 8,
                  fontFamily: T.mono,
                  color: T.textMut,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {monthDays.map((n, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: n === 30 ? T.mint : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: T.f1,
                      fontWeight: n === 30 ? 700 : 400,
                      color: n === 30 ? '#070E09' : n < 30 ? T.textSec : T.text,
                    }}
                  >
                    {n}
                  </span>
                </div>
                {dotColors[i] ? (
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: dotColors[i] as string,
                    }}
                  />
                ) : (
                  <div style={{ width: 4, height: 4 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* This week from coach */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
            This Week from Your Coach
          </span>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.mint, cursor: 'pointer' }}>
            View all
          </span>
        </div>
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          {coachNotes.map((note, i) => (
            <div
              key={i}
              style={{
                padding: '14px 16px',
                borderBottom: i < coachNotes.length - 1 ? `1px solid ${T.border}` : 'none',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: T.bg3,
                  border: `1px solid ${T.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: T.mint,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: T.f2,
                    color: T.text,
                    marginBottom: 3,
                  }}
                >
                  {note.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textSec,
                    fontFamily: T.f2,
                    lineHeight: 1.5,
                  }}
                >
                  {note.sub}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 6,
                }}
              >
                {note.dot && (
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: T.mint,
                    }}
                  />
                )}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={T.textMut}
                  strokeWidth="1.8"
                >
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Coach notes */}
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 20,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1L7.5 4.5H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4.5H4.5L6 1Z"
              fill={T.mint}
            />
          </svg>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: T.mono,
                color: T.mint,
                letterSpacing: '0.06em',
                marginBottom: 3,
              }}
            >
              COACH NOTES
            </div>
            <p
              style={{
                fontSize: 12,
                color: T.textSec,
                fontFamily: T.f2,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Great consistency lately. Your aerobic base is improving—keep stacking quality weeks.
            </p>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.textMut}
            strokeWidth="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
