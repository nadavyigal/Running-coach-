'use client';

import React from 'react';
import { IOSFrame } from '@/components/v2/ios-frame';
import {
  PhoneShell,
  SCREEN_LIST,
  type V2Screen,
} from '@/components/v2/screen-shell';
import { T } from '@/components/v2/tokens';
import type { V2Tab } from '@/components/v2/tab-bar';

export default function V2PreviewPage() {
  const [screen, setScreen] = React.useState<V2Screen>('today');

  const onTabChange = (id: V2Tab) => {
    setScreen(id as V2Screen);
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 30% 0%, #0E1911 0%, #040A06 60%)',
        color: T.text,
        fontFamily: T.f2,
        padding: '24px 16px 80px',
      }}
    >
      <header style={{ maxWidth: 920, margin: '0 auto 24px' }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: T.mono,
            color: T.mint,
            letterSpacing: '0.12em',
            marginBottom: 8,
          }}
        >
          RUNSMART · V2 PREVIEW
        </div>
        <h1
          style={{
            fontSize: 32,
            fontFamily: T.f1,
            fontWeight: 700,
            color: T.text,
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Forest Intelligence
          <span style={{ color: T.mint }}>.</span>
        </h1>
        <p
          style={{
            fontSize: 14,
            color: T.textSec,
            fontFamily: T.f2,
            margin: '8px 0 0',
            maxWidth: 560,
          }}
        >
          New iOS-tuned UI for RunSmart. Use the screen switcher to jump between flows. The
          existing app is untouched at <code style={{ color: T.mint, fontFamily: T.mono }}>/</code>.
        </p>
      </header>

      {/* Screen switcher */}
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto 32px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {SCREEN_LIST.map((s) => {
          const active = s.id === screen;
          return (
            <button
              key={s.id}
              onClick={() => setScreen(s.id)}
              style={{
                background: active ? T.mintDim : T.bg2,
                border: `1px solid ${active ? T.mint : T.border}`,
                borderRadius: 10,
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: T.mono,
                color: active ? T.mint : T.textSec,
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Phone preview */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <IOSFrame width={375} height={812}>
          <PhoneShell screen={screen} onTabChange={onTabChange} />
        </IOSFrame>
      </div>

      <footer
        style={{
          maxWidth: 920,
          margin: '32px auto 0',
          textAlign: 'center',
          fontSize: 11,
          fontFamily: T.mono,
          color: T.textMut,
        }}
      >
        On a real iOS device, open{' '}
        <code style={{ color: T.mint }}>/v2/{screen}</code> for fullscreen rendering.
      </footer>
    </main>
  );
}
