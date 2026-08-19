'use client';

import React from 'react';
import { T } from './tokens';
import { TabBar, type V2Tab } from './tab-bar';
import { OnboardingScreen } from './screens/onboarding';
import { TodayScreen } from './screens/today';
import { PlanScreen } from './screens/plan';
import { RunScreen } from './screens/run';
import { ProfileScreen } from './screens/profile';
import { RoutesScreen } from './screens/routes';
import { GoalsScreen } from './screens/goals';
import { IntegrationsScreen } from './screens/integrations';
import type { V2Screen } from './screen-list';

export { SCREEN_LIST, type V2Screen } from './screen-list';

export function ScreenContent({ screen }: { screen: V2Screen }) {
  switch (screen) {
    case 'onboarding':
      return <OnboardingScreen />;
    case 'today':
      return <TodayScreen />;
    case 'plan':
      return <PlanScreen />;
    case 'run':
      return <RunScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'routes':
      return <RoutesScreen />;
    case 'goals':
      return <GoalsScreen />;
    case 'integrations':
      return <IntegrationsScreen />;
  }
}

const TAB_FOR_SCREEN: Record<V2Screen, V2Tab | null> = {
  onboarding: null,
  today: 'today',
  plan: 'plan',
  run: 'run',
  profile: 'profile',
  routes: 'profile',
  goals: 'profile',
  integrations: 'profile',
};

export function PhoneShell({
  screen,
  onTabChange,
  width,
  height,
}: {
  screen: V2Screen;
  onTabChange?: (id: V2Tab) => void;
  width?: number;
  height?: number;
}) {
  const showTabBar = screen !== 'onboarding';
  const activeTab = TAB_FOR_SCREEN[screen] ?? 'today';
  return (
    <div
      style={{
        height: '100%',
        position: 'relative',
        background: T.bg0,
        overflow: 'hidden',
        width: width ?? '100%',
        ...(height ? { height } : {}),
      }}
    >
      <div
        style={{
          height: showTabBar ? 'calc(100% - 84px)' : '100%',
          overflowY: 'auto',
        }}
      >
        <ScreenContent screen={screen} />
      </div>
      {showTabBar && (
        <TabBar
          active={activeTab}
          onChange={(id) => onTabChange?.(id)}
        />
      )}
    </div>
  );
}
