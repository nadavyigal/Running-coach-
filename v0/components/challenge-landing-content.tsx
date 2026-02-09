'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { ChallengeTemplate } from '@/lib/db';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Flame,
  Heart,
  Target,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

type ChallengeTemplateDisplay =
  | ChallengeTemplate
  | Omit<ChallengeTemplate, 'id' | 'createdAt' | 'updatedAt'>;

interface ChallengeLandingContentProps {
  template: ChallengeTemplateDisplay;
}

const categoryThemes: Record<
  string,
  { accent: string; accentBg: string; glow: string; icon: typeof Flame; label: string }
> = {
  habit: {
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-400',
    glow: 'shadow-emerald-400/20',
    icon: Flame,
    label: 'BUILD HABIT',
  },
  mindful: {
    accent: 'text-violet-400',
    accentBg: 'bg-violet-400',
    glow: 'shadow-violet-400/20',
    icon: Heart,
    label: 'MINDFUL',
  },
  performance: {
    accent: 'text-orange-400',
    accentBg: 'bg-orange-400',
    glow: 'shadow-orange-400/20',
    icon: Zap,
    label: 'PERFORMANCE',
  },
};

const difficultyConfig: Record<string, { label: string; dots: number }> = {
  beginner: { label: 'BEGINNER', dots: 1 },
  intermediate: { label: 'INTERMEDIATE', dots: 2 },
  advanced: { label: 'ADVANCED', dots: 3 },
};

const formatCoachTone = (tone: string) => {
  if (!tone) return 'Supportive';
  return tone.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Deterministic mock number based on slug
const getMockJoinedCount = (slug: string) => {
  const map: Record<string, string> = {
    'start-running': '2,847',
    'morning-ritual': '1,523',
    'plateau-breaker': '1,194',
  };
  return map[slug] ?? '1,247';
};

export function ChallengeLandingContent({ template }: ChallengeLandingContentProps) {
  const router = useRouter();
  const theme = (categoryThemes[template.category] ?? categoryThemes.habit) as NonNullable<typeof categoryThemes[string]>;
  const difficulty = (difficultyConfig[template.difficulty] ?? { label: 'BEGINNER', dots: 1 }) as NonNullable<typeof difficultyConfig[string]>;
  const previewThemes = template.dailyThemes.slice(0, 7);
  const CategoryIcon = theme.icon;
  const joinedCount = getMockJoinedCount(template.slug);

  const handleJoin = () => {
    try {
      localStorage.setItem('preselectedChallenge', template.slug);
    } catch {
      // ignore storage errors
    }
    void trackAnalyticsEvent('challenge_landing_cta', { slug: template.slug });
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20">
      {/* ── NAV BAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className={`w-2 h-2 rounded-full ${theme.accentBg}`} />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/90 group-hover:text-white transition-colors">
              RunSmart
            </span>
          </Link>
          <Button
            onClick={handleJoin}
            size="sm"
            className={`h-8 px-4 rounded-full text-xs font-bold tracking-wider uppercase ${theme.accentBg} text-black hover:opacity-90 transition-opacity border-0`}
          >
            Join Free
          </Button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex flex-col justify-end overflow-hidden pt-14">
        {/* Background texture */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.03)_0%,_transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Giant background number */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 pointer-events-none select-none">
          <span className="text-[20rem] md:text-[32rem] font-black text-white/[0.02] leading-none tracking-tighter">
            21
          </span>
        </div>

        <div className="relative max-w-7xl mx-auto px-5 pb-16 md:pb-24 w-full">
          {/* Category + Difficulty badges */}
          <div className="flex items-center gap-3 mb-8">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-semibold tracking-wider uppercase ${theme.accent}`}>
              <CategoryIcon className="w-3 h-3" />
              {theme.label}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-semibold tracking-wider uppercase text-white/60">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i < difficulty.dots ? theme.accentBg : 'bg-white/20'}`}
                />
              ))}
              <span className="ml-1">{difficulty.label}</span>
            </div>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tight mb-6 max-w-5xl">
            {template.name.split(' ').map((word, i) => (
              <span key={i} className="block">
                {word === '21-Day' ? (
                  <span className={theme.accent}>{word}</span>
                ) : (
                  word
                )}
              </span>
            ))}
          </h1>

          {/* Tagline */}
          <p className="text-lg md:text-xl text-white/50 max-w-xl mb-10 leading-relaxed">
            {template.tagline}
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button
              onClick={handleJoin}
              className={`h-14 px-8 rounded-full text-base font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 transition-all shadow-2xl ${theme.glow} border-0`}
            >
              Start Challenge Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Users className="w-4 h-4" />
              <span>{joinedCount} runners joined</span>
            </div>
          </div>
        </div>

        {/* Bottom edge */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ── PROMISE STRIP ── */}
      <section className="relative border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-16 md:py-20">
          <div className="flex items-start gap-4">
            <div className={`w-1 self-stretch rounded-full ${theme.accentBg} opacity-60 shrink-0`} />
            <blockquote className={`text-2xl md:text-4xl font-bold leading-snug tracking-tight ${theme.accent}`}>
              &ldquo;{template.promise}&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {[
              { value: `${template.durationDays}`, unit: 'DAYS', icon: Calendar },
              { value: difficulty.label, unit: 'LEVEL', icon: Target },
              { value: formatCoachTone(template.coachTone), unit: 'COACH STYLE', icon: Heart },
              { value: joinedCount, unit: 'RUNNERS', icon: Users },
            ].map((stat) => (
              <div key={stat.unit} className="py-8 md:py-10 px-4 md:px-6 text-center">
                <stat.icon className={`w-4 h-4 mx-auto mb-3 ${theme.accent} opacity-60`} />
                <div className="text-2xl md:text-3xl font-black tracking-tight mb-1">{stat.value}</div>
                <div className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">
                  {stat.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7-DAY PREVIEW ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
                YOUR JOURNEY
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                First 7 Days
              </h2>
            </div>
            <p className="text-sm text-white/30 hidden md:block">+ 14 more days</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {previewThemes.map((themeText, index) => {
              const dayLabel = themeText.split(':')[0] ?? `Day ${index + 1}`;
              const dayContent = themeText.includes(':')
                ? themeText.substring(themeText.indexOf(':') + 1).trim()
                : themeText;

              return (
                <div
                  key={index}
                  className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300"
                >
                  {/* Day number */}
                  <div className={`text-4xl font-black ${theme.accent} opacity-20 absolute top-3 right-4 leading-none`}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className={`text-[10px] font-bold tracking-[0.15em] uppercase ${theme.accent} mb-3`}>
                    {dayLabel}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                    {dayContent}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-white/30 mt-6 md:hidden">+ 14 more days of guided coaching</p>
        </div>
      </section>

      {/* ── WHAT YOU'LL DO + COACH STYLE ── */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workout pattern */}
            <div className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-40`} />
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl ${theme.accentBg} bg-opacity-10 flex items-center justify-center`}>
                  <Timer className={`w-5 h-5 ${theme.accent}`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">What You&apos;ll Do</h3>
              </div>
              <p className="text-white/50 leading-relaxed">{template.workoutPattern}</p>
            </div>

            {/* Coach tone */}
            <div className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-40`} />
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl ${theme.accentBg} bg-opacity-10 flex items-center justify-center`}>
                  <Heart className={`w-5 h-5 ${theme.accent}`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">Your AI Coach</h3>
              </div>
              <p className="text-white/50 leading-relaxed">
                A <span className="text-white/80 font-semibold">{formatCoachTone(template.coachTone)}</span> coaching
                style with clear cues, steady encouragement, and practical next steps tailored to
                your progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO IS THIS FOR ── */}
      <section className="border-t border-white/5 py-20 md:py-28 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-5">
          <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
            BUILT FOR
          </p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4 max-w-3xl">
            {template.targetAudience.charAt(0).toUpperCase() + template.targetAudience.slice(1)}
          </h2>
          <p className="text-lg text-white/40 max-w-2xl leading-relaxed">
            {template.description}
          </p>
        </div>
      </section>

      {/* ── WHY IT WORKS ── */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
              THE METHOD
            </p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">
              Why It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: 'Consistency\nYou Can Keep',
                desc: 'Short, structured daily themes remove decision fatigue and make showing up the default.',
              },
              {
                icon: TrendingUp,
                title: 'AI Coaching\nThat Adapts',
                desc: 'Your plan flexes with real life so you stay on track without feeling behind.',
              },
              {
                icon: Users,
                title: 'Community\nMomentum',
                desc: 'Momentum grows when you commit to 21 days of progress and shared energy.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
              >
                <card.icon className={`w-6 h-6 ${theme.accent} mb-6 opacity-60 group-hover:opacity-100 transition-opacity`} />
                <h3 className="text-xl font-bold tracking-tight mb-4 whitespace-pre-line leading-tight">
                  {card.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative border-t border-white/5 overflow-hidden">
        {/* Background glow */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent`} />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px]"
          style={{
            background:
              template.category === 'habit'
                ? '#10b981'
                : template.category === 'mindful'
                  ? '#8b5cf6'
                  : '#f97316',
          }}
        />

        <div className="relative max-w-3xl mx-auto px-5 py-24 md:py-32 text-center">
          <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-4`}>
            FREE EARLY ACCESS
          </p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 leading-[0.9]">
            Ready to Start<br />
            <span className={theme.accent}>Day 1?</span>
          </h2>
          <p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed">
            Join {joinedCount} runners already in the challenge. Early adopters get 50% lifetime
            discount when we launch premium.
          </p>
          <Button
            onClick={handleJoin}
            className={`h-16 px-12 rounded-full text-lg font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 transition-all shadow-2xl ${theme.glow} border-0`}
          >
            Join This Challenge Free
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-xs text-white/20 mt-6">No credit card required</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-white/30">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`} />
            <span className="font-bold tracking-wider text-white/50">RunSmart</span>
            <span>AI Running Coach</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/20">
            <Link href="/privacy" className="hover:text-white/50 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
