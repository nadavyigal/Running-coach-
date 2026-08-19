'use client';

import React from 'react';
import { T } from '../tokens';
import { RSBadge } from '../primitives';

const goals = [
  {
    title: 'Break 47:00 in 10K',
    progress: 0.72,
    current: '49:12',
    target: '47:00',
    deadline: 'Jun 15',
    color: T.mint,
    type: 'Goal',
  },
  {
    title: 'Run 150 km in May',
    progress: 0.41,
    current: '61 km',
    target: '150 km',
    deadline: 'May 31',
    color: T.blue,
    type: 'Goal',
  },
  {
    title: '30-day Streak',
    progress: 0.37,
    current: '11 days',
    target: '30 days',
    deadline: '19 days left',
    color: T.gold,
    type: 'Challenge',
  },
];

const challenges = [
  {
    title: 'Spring Speed Series',
    desc: '4-week interval challenge',
    participants: '1,204',
    joined: true,
    color: T.coral,
  },
  {
    title: 'May Distance Badge',
    desc: 'Run 100km in May',
    participants: '3,891',
    joined: false,
    color: '#C084FC',
  },
  {
    title: 'Elevation Hunter',
    desc: 'Climb 2,000m this month',
    participants: '654',
    joined: false,
    color: T.gold,
  },
];

export function GoalsScreen() {
  return (
    <div style={{ background: T.bg0, minHeight: '100%', paddingBottom: 90, overflowY: 'auto' }}>
      <div style={{ padding: '52px 20px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: T.f1, color: T.text }}>Goals</h1>
          <button
            style={{
              background: T.mintDim,
              border: `1px solid ${T.borderMid}`,
              borderRadius: 12,
              padding: '7px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.mint}
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span
              style={{
                fontSize: 12,
                fontFamily: T.f2,
                fontWeight: 600,
                color: T.mint,
              }}
            >
              Add Goal
            </span>
          </button>
        </div>

        {/* Coach insight */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0E2018, #0A1A10)',
            border: `1px solid ${T.borderMid}`,
            borderRadius: 18,
            padding: '14px 16px',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontFamily: T.mono,
              color: T.mint,
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            COACH SPARK INSIGHT
          </div>
          <p style={{ fontSize: 13, color: T.text, fontFamily: T.f2, lineHeight: 1.55, margin: 0 }}>
            You&apos;re on pace to break 47:00 by end of June. Keep stacking quality tempo
            sessions — 3 more like last Tuesday will do it.
          </p>
        </div>

        {/* My Goals */}
        <div
          style={{
            fontSize: 10,
            fontFamily: T.mono,
            color: T.textMut,
            letterSpacing: '0.08em',
            marginBottom: 12,
          }}
        >
          MY GOALS
        </div>
        {goals.map((g, i) => (
          <div
            key={i}
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    marginBottom: 5,
                  }}
                >
                  <RSBadge small color={g.color}>
                    {g.type}
                  </RSBadge>
                  <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textMut }}>
                    {g.deadline}
                  </span>
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 700, fontFamily: T.f1, color: T.text }}
                >
                  {g.title}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: g.color,
                    lineHeight: 1,
                  }}
                >
                  {Math.round(g.progress * 100)}
                  <span style={{ fontSize: 12 }}>%</span>
                </div>
              </div>
            </div>
            <div
              style={{
                height: 5,
                background: T.bg4,
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: `${g.progress * 100}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${g.color}, ${g.color}cc)`,
                  borderRadius: 3,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSec }}>
                Current: {g.current}
              </span>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textSec }}>
                Target: {g.target}
              </span>
            </div>
          </div>
        ))}

        {/* Challenges */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            marginTop: 8,
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
            CHALLENGES
          </div>
          <span style={{ fontSize: 11, fontFamily: T.mono, color: T.mint, cursor: 'pointer' }}>
            Explore all
          </span>
        </div>
        {challenges.map((c, i) => (
          <div
            key={i}
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: `${c.color}18`,
                  border: `1px solid ${c.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={c.color}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="8" r="6" />
                  <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: T.text,
                    marginBottom: 2,
                  }}
                >
                  {c.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textSec,
                    fontFamily: T.f2,
                    marginBottom: 3,
                  }}
                >
                  {c.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={T.textMut}
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                  <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textMut }}>
                    {c.participants}
                  </span>
                </div>
              </div>
            </div>
            <button
              style={{
                background: c.joined ? T.mintDim : T.bg3,
                border: `1px solid ${c.joined ? T.borderMid : T.border}`,
                borderRadius: 12,
                padding: '7px 14px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: T.mono,
                color: c.joined ? T.mint : T.textSec,
                fontWeight: 600,
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {c.joined ? 'Joined ✓' : 'Join'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
