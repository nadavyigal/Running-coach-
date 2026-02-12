'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getLocalizedChallenge } from '@/lib/challengeTemplates';
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
  initialLanguage?: 'en' | 'he';
}

const UI_COPY = {
  en: {
    joinFree: 'Join Free',
    startChallenge: 'Start Challenge Free',
    runnersJoined: 'runners joined',
    yourJourney: 'YOUR JOURNEY',
    first7Days: 'First 7 Days',
    moreDays: '+ 14 more days',
    moreDaysShort: '+ 14 more days of guided coaching',
    whatYoullDo: "What You'll Do",
    yourAiCoach: 'Your AI Coach',
    builtFor: 'BUILT FOR',
    theMethod: 'THE METHOD',
    whyItWorks: 'Why It Works',
    readyToStart: 'Ready to Start',
    day1: 'Day 1?',
    freeEarlyAccess: 'FREE EARLY ACCESS',
    joinersGet50: 'runners already in the challenge. Early adopters get 50% lifetime discount when we launch premium.',
    noCreditCard: 'No credit card required',
    privacy: 'Privacy',
    terms: 'Terms',
    coachingStyleDesc: 'coaching style with clear cues, steady encouragement, and practical next steps tailored to your progress.',
  },
  he: {
    joinFree: 'הצטרפות חינם',
    startChallenge: 'התחל אתגר חינם',
    runnersJoined: 'רצים הצטרפו',
    yourJourney: 'המסע שלכם',
    first7Days: '7 הימים הראשונים',
    moreDays: '+ עוד 14 ימים',
    moreDaysShort: '+ עוד 14 ימים של ריצה מודרכת',
    whatYoullDo: 'מה תעשו',
    yourAiCoach: 'המאמן החכם שלכם',
    builtFor: 'מיועד ל',
    theMethod: 'השיטה',
    whyItWorks: 'למה זה עובד',
    readyToStart: 'מוכנים להתחיל',
    day1: 'יום 1?',
    freeEarlyAccess: 'גישה מוקדמת חינם',
    joinersGet50: 'רצים כבר באתגר. מצטרפים מוקדמים מקבלים 50% הנחה לכל החיים כשנשיק פרימיום.',
    noCreditCard: 'ללא כרטיס אשראי',
    privacy: 'פרטיות',
    terms: 'תנאים',
    coachingStyleDesc: 'סגנון אימון עם רמזים ברורים, עידוד קבוע וצעדים מעשיים המותאמים להתקדמותך.',
  },
} as const;

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

export function ChallengeLandingContent({ template, initialLanguage = 'en' }: ChallengeLandingContentProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<'en' | 'he'>(initialLanguage);
  const isHebrew = language === 'he';
  const copy = UI_COPY[language];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    const storedLang = localStorage.getItem('challenge_lang');
    const initial =
      urlLang === 'he' || urlLang === 'en'
        ? urlLang
        : storedLang === 'he' || storedLang === 'en'
          ? storedLang
          : initialLanguage;
    setLanguage(initial as 'en' | 'he');
    if (initial !== urlLang) {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', initial);
      window.history.replaceState({}, '', url.toString());
    }
  }, [initialLanguage]);

  const setLanguagePreference = (nextLanguage: 'en' | 'he') => {
    setLanguage(nextLanguage);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', nextLanguage);
      window.history.replaceState({}, '', url.toString());
      localStorage.setItem('challenge_lang', nextLanguage);
      void trackAnalyticsEvent('language_changed', {
        from: language,
        to: nextLanguage,
        location: 'challenge_landing',
        challenge_slug: template.slug,
      });
    } catch {
      // ignore
    }
  };

  // Get localized template if Hebrew selected
  let displayTemplate = template;
  if (isHebrew) {
    const localized = getLocalizedChallenge(template.slug, 'he');
    if (localized) {
      displayTemplate = { ...template, ...localized } as ChallengeTemplateDisplay;
    }
  }

  const theme = (categoryThemes[displayTemplate.category] ?? categoryThemes.habit) as NonNullable<typeof categoryThemes[string]>;
  const difficulty = (difficultyConfig[displayTemplate.difficulty] ?? { label: 'BEGINNER', dots: 1 }) as NonNullable<typeof difficultyConfig[string]>;
  const previewThemes = displayTemplate.dailyThemes.slice(0, 7);
  const CategoryIcon = theme.icon;
  const joinedCount = getMockJoinedCount(displayTemplate.slug);

  const handleJoin = () => {
    try {
      localStorage.setItem('preselectedChallenge', displayTemplate.slug);
    } catch {
      // ignore storage errors
    }
    void trackAnalyticsEvent('challenge_landing_cta', {
      slug: displayTemplate.slug,
      language: language,
      button_location: 'hero',
    });
    router.push('/');
  };

  return (
    <div
      className={`min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20 ${isHebrew ? 'font-hebrew' : ''}`}
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={isHebrew ? 'he' : 'en'}
    >
      {/* ── NAV BAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
        <div className={`max-w-7xl mx-auto px-5 h-14 flex items-center ${isHebrew ? 'flex-row-reverse' : ''} justify-between`}>
          <Link href="/" className="flex items-center gap-2 group">
            <div className={`w-2 h-2 rounded-full ${theme.accentBg}`} />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/90 group-hover:text-white transition-colors">
              RunSmart
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher
              language={language}
              onChange={setLanguagePreference}
              variant="dark"
              className="text-xs"
            />
            <Button
              onClick={handleJoin}
              size="sm"
              className={`h-8 px-4 rounded-full text-xs font-bold tracking-wider uppercase ${theme.accentBg} text-black hover:opacity-90 transition-opacity border-0`}
            >
              {copy.joinFree}
            </Button>
          </div>
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
            {displayTemplate.name.split(' ').map((word, i) => (
              <span key={i} className="block">
                {word === '21-Day' || word === '21' || word === 'יום' ? (
                  <span className={theme.accent}>{word}</span>
                ) : (
                  word
                )}
              </span>
            ))}
          </h1>

          {/* Tagline */}
          <p className="text-lg md:text-xl text-white/50 max-w-xl mb-10 leading-relaxed">
            {displayTemplate.tagline}
          </p>

          {/* CTA row */}
          <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <Button
              onClick={handleJoin}
              className={`h-14 px-8 rounded-full text-base font-bold tracking-wide ${theme.accentBg} text-black hover:opacity-90 transition-all shadow-2xl ${theme.glow} border-0`}
            >
              {copy.startChallenge}
              <ArrowRight className={`${isHebrew ? 'mr-2' : 'ml-2'} h-5 w-5`} />
            </Button>
            <div className={`flex items-center gap-2 text-white/40 text-sm ${isHebrew ? 'flex-row-reverse' : ''}`}>
              <Users className="w-4 h-4" />
              <span>{joinedCount} {copy.runnersJoined}</span>
            </div>
          </div>
        </div>

        {/* Bottom edge */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </section>

      {/* ── PROMISE STRIP ── */}
      <section className="relative border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 py-16 md:py-20">
          <div className={`flex items-start gap-4 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <div className={`w-1 self-stretch rounded-full ${theme.accentBg} opacity-60 shrink-0`} />
            <blockquote className={`text-2xl md:text-4xl font-bold leading-snug tracking-tight ${theme.accent}`}>
              &ldquo;{displayTemplate.promise}&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="border-b border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
            {[
              { value: `${displayTemplate.durationDays}`, unit: 'DAYS', icon: Calendar },
              { value: difficulty.label, unit: 'LEVEL', icon: Target },
              { value: formatCoachTone(displayTemplate.coachTone), unit: 'COACH STYLE', icon: Heart },
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
          <div className={`flex items-end ${isHebrew ? 'flex-row-reverse' : ''} justify-between mb-12`}>
            <div>
              <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${theme.accent} mb-3`}>
                {copy.yourJourney}
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">
                {copy.first7Days}
              </h2>
            </div>
            <p className="text-sm text-white/30 hidden md:block">{copy.moreDays}</p>
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

          <p className="text-sm text-white/30 mt-6 md:hidden">{copy.moreDaysShort}</p>
        </div>
      </section>

      {/* ── WHAT YOU'LL DO + COACH STYLE ── */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workout pattern */}
            <div className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-40`} />
              <div className={`flex items-center gap-3 mb-6 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl ${theme.accentBg} bg-opacity-10 flex items-center justify-center`}>
                  <Timer className={`w-5 h-5 ${theme.accent}`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{copy.whatYoullDo}</h3>
              </div>
              <p className="text-white/50 leading-relaxed">{displayTemplate.workoutPattern}</p>
            </div>

            {/* Coach tone */}
            <div className="relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 md:p-10 overflow-hidden group hover:border-white/10 transition-all">
              <div className={`absolute top-0 left-0 w-full h-px ${theme.accentBg} opacity-40`} />
              <div className={`flex items-center gap-3 mb-6 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <div className={`w-10 h-10 rounded-xl ${theme.accentBg} bg-opacity-10 flex items-center justify-center`}>
                  <Heart className={`w-5 h-5 ${theme.accent}`} />
                </div>
                <h3 className="text-lg font-bold tracking-tight">{copy.yourAiCoach}</h3>
              </div>
              <p className="text-white/50 leading-relaxed">
                A <span className="text-white/80 font-semibold">{formatCoachTone(displayTemplate.coachTone)}</span> {copy.coachingStyleDesc}
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
