'use client';

import React from 'react';

// Simplified iOS device chrome for desktop /v2 preview only.
// On the actual device (Capacitor), screens render fullscreen — no frame.
export function IOSFrame({
  children,
  width = 375,
  height = 812,
}: {
  children: React.ReactNode;
  width?: number;
  height?: number;
}) {
  const bezel = 12;
  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        borderRadius: 56,
        padding: bezel,
        background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)',
        boxShadow:
          '0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 0 0 1.5px rgba(255,255,255,0.06)',
        position: 'relative',
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: 44,
          background: '#000',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Dynamic island */}
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 122,
            height: 35,
            borderRadius: 18,
            background: '#000',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        />
        {/* Status bar text */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 30,
            right: 30,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 99,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            pointerEvents: 'none',
          }}
        >
          <span>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Signal */}
            <svg width="16" height="10" viewBox="0 0 17 11" fill="#fff">
              <rect x="0" y="7" width="3" height="4" rx="0.5" />
              <rect x="4.5" y="5" width="3" height="6" rx="0.5" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" />
              <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
            </svg>
            {/* Battery */}
            <svg width="25" height="12" viewBox="0 0 25 12">
              <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="#fff" strokeOpacity="0.5" fill="none" />
              <rect x="2" y="2" width="18" height="8" rx="1.5" fill="#fff" />
              <rect x="22.5" y="3.5" width="1.5" height="5" rx="0.5" fill="#fff" fillOpacity="0.5" />
            </svg>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
