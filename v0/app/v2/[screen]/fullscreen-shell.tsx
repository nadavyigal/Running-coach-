'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PhoneShell, type V2Screen } from '@/components/v2/screen-shell';
import type { V2Tab } from '@/components/v2/tab-bar';

// Fullscreen render — used on actual iOS device via Capacitor.
// No phone frame; safe-area handled by the screens' top padding (52px ≈ status bar).
export function FullscreenShell({ screen }: { screen: V2Screen }) {
  const router = useRouter();
  const onTabChange = (id: V2Tab) => {
    router.push(`/v2/${id}`);
  };
  return (
    <div className="rs-v2-fullscreen">
      <PhoneShell screen={screen} onTabChange={onTabChange} />
    </div>
  );
}
