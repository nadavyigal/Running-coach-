'use client';

import React from 'react';
import { T } from './tokens';

export type V2Tab = 'today' | 'plan' | 'run' | 'profile';

const muted = 'rgba(223,242,233,0.3)';

const Icons = {
  today: (active: boolean) => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? T.mint : muted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  plan: (active: boolean) => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? T.mint : muted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  profile: (active: boolean) => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? T.mint : muted}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

export function TabBar({
  active,
  onChange,
}: {
  active: V2Tab;
  onChange: (id: V2Tab) => void;
}) {
  const tabs: Array<{ id: V2Tab; label: string; special?: boolean }> = [
    { id: 'today', label: 'Today' },
    { id: 'plan', label: 'Plan' },
    { id: 'run', label: 'Run', special: true },
    { id: 'profile', label: 'Profile' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(7,14,9,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: `1px solid ${T.border}`,
        padding: '10px 0 calc(env(safe-area-inset-bottom, 0px) + 16px)',
        display: 'flex',
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: tab.special ? 0 : 3,
              padding: '2px 0',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {tab.special ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: isActive ? T.mint : `linear-gradient(135deg, ${T.mint} 0%, #00C896 100%)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(45,255,193,0.4)',
                  marginTop: -10,
                  gap: 1,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#070E09"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 4v7h7l-9 9v-7H4l9-9z" />
                </svg>
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: T.mono,
                    color: '#070E09',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                  }}
                >
                  RUN
                </span>
              </div>
            ) : (
              <>
                {Icons[tab.id as 'today' | 'plan' | 'profile'](isActive)}
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: T.mono,
                    letterSpacing: '0.04em',
                    color: isActive ? T.mint : muted,
                  }}
                >
                  {tab.label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
