'use client';

import React from 'react';
import { T } from '../tokens';
import { RSBadge } from '../primitives';

type RouteType = 'Tempo' | 'Interval' | 'Strength' | 'Easy';

const typeColor: Record<RouteType, string> = {
  Tempo: T.mint,
  Interval: T.coral,
  Strength: T.gold,
  Easy: T.blue,
};

const routes: Array<{
  name: string;
  dist: string;
  elev: string;
  type: RouteType;
  last: string;
  fav: boolean;
  path: string;
}> = [
  {
    name: 'Riverside Loop',
    dist: '8.2 km',
    elev: '+64 m',
    type: 'Tempo',
    last: '2 days ago',
    fav: true,
    path: 'M20,70 C40,50 60,55 80,40 C100,25 120,35 150,28 C170,22 190,30 210,20',
  },
  {
    name: 'Park Intervals',
    dist: '5.4 km',
    elev: '+18 m',
    type: 'Interval',
    last: '5 days ago',
    fav: false,
    path: 'M20,65 C35,60 50,62 65,55 C80,48 95,50 115,45 C135,40 150,42 170,38',
  },
  {
    name: 'Hill Repeats — North',
    dist: '6.1 km',
    elev: '+210 m',
    type: 'Strength',
    last: '1 week ago',
    fav: false,
    path: 'M20,72 C30,65 38,50 50,38 C60,28 65,35 75,30 C88,24 100,40 115,35 C130,30 145,20 160,18',
  },
  {
    name: 'Easy Recovery Path',
    dist: '4.8 km',
    elev: '+12 m',
    type: 'Easy',
    last: 'Yesterday',
    fav: true,
    path: 'M20,68 C45,65 70,62 95,60 C115,58 135,60 160,58',
  },
];

const filters = ['All', 'Tempo', 'Interval', 'Easy', 'Strength', 'Favourites'];

export function RoutesScreen() {
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
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: T.f1, color: T.text }}>Routes</h1>
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
              New
            </span>
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.textMut}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span style={{ fontSize: 13, color: T.textMut, fontFamily: T.f2 }}>Search routes…</span>
        </div>

        {/* Filter pills */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 20,
            overflowX: 'auto',
            paddingBottom: 2,
          }}
        >
          {filters.map((f, i) => (
            <button
              key={f}
              style={{
                flex: '0 0 auto',
                background: i === 0 ? T.mintDim : T.bg2,
                border: `1px solid ${i === 0 ? T.borderMid : T.border}`,
                borderRadius: 20,
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: T.mono,
                color: i === 0 ? T.mint : T.textSec,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Coach suggestion */}
        <div
          style={{
            background: T.bg2,
            border: `1px solid ${T.borderMid}`,
            borderRadius: 16,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1L7.5 4.5H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4.5H4.5L6 1Z"
              fill={T.mint}
            />
          </svg>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: T.mono,
                color: T.mint,
                letterSpacing: '0.07em',
                marginBottom: 2,
              }}
            >
              COACH SPARK SUGGESTS
            </div>
            <p
              style={{
                fontSize: 12,
                color: T.textSec,
                fontFamily: T.f2,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Riverside Loop is perfect for today&apos;s tempo session. Flat sections match your
              target pace.
            </p>
          </div>
        </div>

        {/* Route cards */}
        {routes.map((r, i) => (
          <div
            key={i}
            style={{
              background: T.bg2,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            {/* Map preview */}
            <div style={{ height: 80, background: T.bg3, position: 'relative' }}>
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 240 80"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <pattern
                    id={`rs-route-grid-${i}`}
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M20 0L0 0 0 20"
                      fill="none"
                      stroke="rgba(45,255,193,0.04)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="240" height="80" fill={`url(#rs-route-grid-${i})`} />
                <path
                  d={r.path}
                  fill="none"
                  stroke={typeColor[r.type]}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="20"
                  cy={parseInt(r.path.split(',')[1] ?? '70', 10)}
                  r="4"
                  fill={typeColor[r.type]}
                  opacity="0.7"
                />
              </svg>
              <div
                style={{ position: 'absolute', top: 8, left: 10, display: 'flex', gap: 5 }}
              >
                <RSBadge small color={typeColor[r.type]}>
                  {r.type}
                </RSBadge>
              </div>
              <div style={{ position: 'absolute', top: 8, right: 10 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={r.fav ? T.gold : 'none'}
                  stroke={r.fav ? T.gold : T.textMut}
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
            </div>
            {/* Info */}
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: T.text,
                    marginBottom: 3,
                  }}
                >
                  {r.name}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec }}>
                    {r.dist}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textSec }}>
                    {r.elev}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textMut }}>
                    {r.last}
                  </span>
                </div>
              </div>
              <button
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: `linear-gradient(135deg,${T.mint},#00C896)`,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#070E09"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M13 4v7h7l-9 9v-7H4l9-9z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
