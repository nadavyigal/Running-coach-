// RunSmart v2 — Design tokens
// Direction: "Forest Intelligence" — obsidian + electric mint
// Pulled from /tmp design bundle: runsmart-v2-components.jsx

export const T = {
  bg0: '#070E09',
  bg1: '#0E1911',
  bg2: '#162019',
  bg3: '#1D2B22',
  bg4: '#243325',
  mint: '#2DFFC1',
  mintDim: 'rgba(45,255,193,0.10)',
  mintMid: 'rgba(45,255,193,0.18)',
  gold: '#FFD166',
  goldDim: 'rgba(255,209,102,0.12)',
  coral: '#FF6B6B',
  coralDim: 'rgba(255,107,107,0.12)',
  blue: '#5B9BFF',
  blueDim: 'rgba(91,155,255,0.12)',
  text: '#DFF2E9',
  textSec: 'rgba(223,242,233,0.52)',
  textMut: 'rgba(223,242,233,0.25)',
  border: 'rgba(45,255,193,0.07)',
  borderMid: 'rgba(45,255,193,0.14)',
  // Fonts resolved via CSS variables set by next/font in app/v2/layout.tsx
  f1: 'var(--font-syne), system-ui, sans-serif',
  f2: 'var(--font-outfit), system-ui, sans-serif',
  mono: 'var(--font-dm-mono), ui-monospace, monospace',
} as const;

export type Token = typeof T;
