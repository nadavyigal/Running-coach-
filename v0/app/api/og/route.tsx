import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #0f1f0f 50%, #0a1a0a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 25% 25%, rgba(34,197,94,0.08) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(34,197,94,0.05) 0%, transparent 50%)',
            display: 'flex',
          }}
        />

        {/* Glowing orb top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.06) 40%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Subtle bottom-left orb */}
        <div
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '300px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Left content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '52px 60px 52px 60px',
            flex: 1,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* RS Icon */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontWeight: '800',
                  fontSize: '22px',
                  letterSpacing: '-0.5px',
                }}
              >
                RS
              </span>
            </div>
            <span
              style={{
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '28px',
                letterSpacing: '-0.3px',
              }}
            >
              RunSmart
            </span>
            {/* AI badge */}
            <div
              style={{
                marginLeft: '4px',
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.4)',
                borderRadius: '20px',
                padding: '4px 12px',
                display: 'flex',
              }}
            >
              <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '600' }}>
                AI Powered
              </span>
            </div>
          </div>

          {/* Main headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '60px',
                  lineHeight: '1.1',
                  letterSpacing: '-2px',
                }}
              >
                Your AI Running
              </span>
              <span
                style={{
                  color: '#22c55e',
                  fontWeight: '800',
                  fontSize: '60px',
                  lineHeight: '1.1',
                  letterSpacing: '-2px',
                }}
              >
                Coach
              </span>
            </div>
            <p
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: '22px',
                fontWeight: '400',
                lineHeight: '1.4',
                margin: 0,
                maxWidth: '480px',
              }}
            >
              Personalized training plans that adapt when life gets in the way.
            </p>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {['Adaptive Plans', 'Recovery Tracking', 'Garmin Sync', 'Offline-First'].map(
              (feature) => (
                <div
                  key={feature}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '20px',
                    padding: '7px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ color: '#22c55e', fontSize: '13px' }}>✓</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: '500' }}>
                    {feature}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right visual — stylized training card mockup */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            paddingRight: '60px',
            paddingTop: '52px',
            paddingBottom: '52px',
            gap: '16px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Today's Workout Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '20px',
              padding: '24px',
              width: '260px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Today&apos;s Run
              </span>
              <div style={{ background: 'rgba(34,197,94,0.2)', borderRadius: '6px', padding: '2px 8px', display: 'flex' }}>
                <span style={{ color: '#4ade80', fontSize: '11px', fontWeight: '600' }}>Easy</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: '800', letterSpacing: '-1px' }}>
                8 km
              </span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                Target pace 5:30 /km
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Week 3 of 12</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>24%</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', display: 'flex' }}>
                <div style={{ width: '24%', height: '4px', background: '#22c55e', borderRadius: '2px', display: 'flex' }} />
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              width: '260px',
            }}
          >
            {[
              { label: 'Weekly km', value: '32' },
              { label: 'Readiness', value: '87%' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ color: '#22c55e', fontSize: '20px', fontWeight: '700' }}>
                  {stat.value}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* URL watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '60px',
            display: 'flex',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
            runsmart-ai.com
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
