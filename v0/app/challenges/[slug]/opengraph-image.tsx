import { ImageResponse } from 'next/og';
import { getChallengeTemplateBySlug } from '@/lib/challengeTemplates';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

const gradients: Record<string, { from: string; to: string }> = {
  habit: { from: '#10b981', to: '#06b6d4' },
  mindful: { from: '#8b5cf6', to: '#ec4899' },
  performance: { from: '#f97316', to: '#facc15' },
};

export default function OpenGraphImage({ params }: { params: { slug: string } }) {
  const template = getChallengeTemplateBySlug(params.slug);
  const fallback = {
    name: 'RunSmart Challenge',
    tagline: '21 days to build momentum',
    category: 'habit',
  };
  const challenge = template ?? fallback;
  const gradient = gradients[challenge.category] ?? gradients.habit;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          color: '#ffffff',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1 }}>RunSmart</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{challenge.name}</div>
          <div style={{ fontSize: 30, opacity: 0.9 }}>{challenge.tagline}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              fontSize: 22,
              fontWeight: 600,
            }}
          >
            21-Day Challenge
          </div>
          <div style={{ fontSize: 20, opacity: 0.85 }}>AI Running Coach</div>
        </div>
      </div>
    ),
    size
  );
}
