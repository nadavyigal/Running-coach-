'use client';

import React from 'react';
import { T } from '../tokens';

const apps = [
  {
    name: 'Garmin Connect',
    desc: 'Sync runs, HR, sleep & recovery',
    color: '#00A4D3',
    connected: true,
    last: 'Synced 2 min ago',
    icon: 'G',
  },
  {
    name: 'Strava',
    desc: 'Share activities & segments',
    color: '#FC4C02',
    connected: true,
    last: 'Synced 5 min ago',
    icon: 'S',
  },
  {
    name: 'Apple Health',
    desc: 'Steps, workouts & activity rings',
    color: '#FF375F',
    connected: false,
    icon: '♥',
  },
  {
    name: 'Wahoo',
    desc: 'Speed & cadence sensors',
    color: '#009FDA',
    connected: false,
    icon: 'W',
  },
  {
    name: 'Polar Flow',
    desc: 'HR training & recovery data',
    color: '#D9232A',
    connected: false,
    icon: 'P',
  },
  {
    name: 'Whoop',
    desc: 'Recovery & strain scores',
    color: '#00C2FF',
    connected: false,
    icon: 'W',
  },
];

const garminData = [
  { label: 'Last sync', val: '2 min ago' },
  { label: 'Runs imported', val: '128' },
  { label: 'HRV data', val: 'Active' },
  { label: 'Sleep tracking', val: 'Enabled' },
  { label: 'Body Battery', val: 'Syncing' },
];

export function IntegrationsScreen() {
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
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: T.f1, color: T.text }}>
            Connect
          </h1>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.textSec}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        {/* Garmin expanded card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0A1E2E, #071018)',
            border: '1px solid rgba(0,164,211,0.25)',
            borderRadius: 20,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'rgba(0,164,211,0.15)',
                  border: '1px solid rgba(0,164,211,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    fontFamily: T.f1,
                    color: '#00A4D3',
                  }}
                >
                  G
                </span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: T.f1,
                    color: T.text,
                  }}
                >
                  Garmin Connect
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 3,
                  }}
                >
                  <div
                    style={{ width: 6, height: 6, borderRadius: '50%', background: T.mint }}
                  />
                  <span style={{ fontSize: 10, fontFamily: T.mono, color: T.mint }}>
                    Connected · Syncing
                  </span>
                </div>
              </div>
            </div>
            <button
              style={{
                background: 'rgba(255,107,107,0.08)',
                border: '1px solid rgba(255,107,107,0.2)',
                borderRadius: 10,
                padding: '5px 10px',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.coral }}>Disconnect</span>
            </button>
          </div>
          {/* Garmin data rows */}
          <div style={{ background: T.bg3, borderRadius: 14, overflow: 'hidden' }}>
            {garminData.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom:
                    i < garminData.length - 1 ? `1px solid ${T.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 12, color: T.textSec, fontFamily: T.f2 }}>
                  {d.label}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: T.mono,
                    color: T.text,
                  }}
                >
                  {d.val}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              background: 'rgba(45,255,193,0.05)',
              borderRadius: 12,
              border: `1px solid ${T.border}`,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: T.textSec,
                fontFamily: T.f2,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Coach Spark uses your Garmin HRV, sleep score, and training load to personalize
              every session.
            </p>
          </div>
        </div>

        {/* Other apps */}
        <div
          style={{
            fontSize: 10,
            fontFamily: T.mono,
            color: T.textMut,
            letterSpacing: '0.08em',
            marginBottom: 12,
          }}
        >
          ALL INTEGRATIONS
        </div>
        {apps.map((app, i) => (
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
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  background: `${app.color}18`,
                  border: `1px solid ${app.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    fontFamily: T.f1,
                    color: app.color,
                  }}
                >
                  {app.icon}
                </span>
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
                  {app.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: T.textSec,
                    fontFamily: T.f2,
                    marginBottom: app.connected ? 2 : 0,
                  }}
                >
                  {app.desc}
                </div>
                {app.connected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: T.mint,
                      }}
                    />
                    <span style={{ fontSize: 9, fontFamily: T.mono, color: T.textSec }}>
                      {app.last}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              style={{
                background: app.connected ? T.mintDim : T.bg3,
                border: `1px solid ${app.connected ? T.borderMid : T.border}`,
                borderRadius: 12,
                padding: '7px 14px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: T.mono,
                color: app.connected ? T.mint : T.textSec,
                fontWeight: 600,
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {app.connected ? 'Connected' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
