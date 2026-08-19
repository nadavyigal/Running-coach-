import { notFound } from 'next/navigation';
import { FullscreenShell } from './fullscreen-shell';
import { SCREEN_LIST, type V2Screen } from '@/components/v2/screen-list';

const VALID = new Set<V2Screen>(SCREEN_LIST.map((s) => s.id));

export function generateStaticParams() {
  return SCREEN_LIST.map((s) => ({ screen: s.id }));
}

export default function V2ScreenPage({ params }: { params: { screen: string } }) {
  const screen = params.screen as V2Screen;
  if (!VALID.has(screen)) notFound();
  return <FullscreenShell screen={screen} />;
}
