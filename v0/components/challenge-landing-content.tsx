'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trackAnalyticsEvent } from '@/lib/analytics';
import type { ChallengeTemplate } from '@/lib/db';
import { ArrowRight, Calendar, Users } from 'lucide-react';

type ChallengeTemplateDisplay =
  | ChallengeTemplate
  | Omit<ChallengeTemplate, 'id' | 'createdAt' | 'updatedAt'>;

interface ChallengeLandingContentProps {
  template: ChallengeTemplateDisplay;
}

const categoryThemes: Record<string, { gradient: string; badge: string; accent: string }> = {
  habit: {
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    accent: 'text-emerald-600',
  },
  mindful: {
    gradient: 'from-purple-500 via-fuchsia-500 to-pink-500',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    accent: 'text-purple-600',
  },
  performance: {
    gradient: 'from-orange-500 via-amber-500 to-yellow-500',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    accent: 'text-orange-600',
  },
};

const difficultyLabels: Record<string, { label: string; className: string }> = {
  beginner: { label: 'Beginner', className: 'bg-green-100 text-green-800 border-green-200' },
  intermediate: { label: 'Intermediate', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  advanced: { label: 'Advanced', className: 'bg-red-100 text-red-800 border-red-200' },
};

const formatCoachTone = (tone: string) => {
  if (!tone) return 'Supportive';
  return tone.charAt(0).toUpperCase() + tone.slice(1);
};

export function ChallengeLandingContent({ template }: ChallengeLandingContentProps) {
  const router = useRouter();
  const theme = categoryThemes[template.category] ?? categoryThemes.habit;
  const difficulty = difficultyLabels[template.difficulty] ?? {
    label: template.difficulty,
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  const previewThemes = template.dailyThemes.slice(0, 7);

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
    <div className="min-h-screen bg-white text-gray-900">
      <section className={`relative overflow-hidden bg-gradient-to-br ${theme.gradient} text-white`}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_55%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Badge className={`border ${theme.badge}`}>21-Day Challenge</Badge>
            <Badge className={`border ${difficulty.className}`}>{difficulty.label}</Badge>
            <Badge variant="outline" className="border-white/40 text-white/90">
              {template.durationDays} days
            </Badge>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4">{template.name}</h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-3xl mb-6">{template.tagline}</p>
          <div className="flex flex-wrap items-center gap-4 text-white/85">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>For {template.targetAudience}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>Structured daily guidance</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8 md:p-10">
          <p className={`text-2xl md:text-3xl font-semibold leading-relaxed ${theme.accent}`}>
            &quot;{template.promise}&quot;
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-3xl font-bold mb-6">Your 21-Day Journey</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {previewThemes.map((themeText, index) => (
            <div key={themeText} className="rounded-2xl border border-gray-200 p-4 bg-white shadow-sm">
              <div className="text-sm font-semibold text-gray-500 mb-2">Day {index + 1}</div>
              <p className="text-gray-800">{themeText}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-4">...and 14 more days to build momentum.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-gray-200 p-8 bg-white shadow-sm">
          <h3 className="text-xl font-semibold mb-3">What You Will Do</h3>
          <p className="text-gray-700 leading-relaxed">{template.workoutPattern}</p>
        </div>
        <div className="rounded-3xl border border-gray-200 p-8 bg-white shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Coach Tone</h3>
          <p className="text-gray-700 leading-relaxed">
            Expect a {formatCoachTone(template.coachTone)} coaching style with clear cues, steady encouragement, and
            practical next steps.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-3xl font-bold mb-6">Why It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-gray-200 p-6 bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">Consistency You Can Keep</h3>
            <p className="text-gray-700">
              Short, structured daily themes remove decision fatigue and make showing up the default.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-6 bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">AI Coaching That Adapts</h3>
            <p className="text-gray-700">
              Your plan flexes with real life so you stay on track without feeling behind.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-6 bg-gray-50">
            <h3 className="text-lg font-semibold mb-2">Community Momentum</h3>
            <p className="text-gray-700">
              Momentum grows when you commit to 21 days of progress and shared energy.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-14 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Join This Challenge Free</h2>
          <p className="text-white/80 max-w-2xl mx-auto mb-8">
            Early access is available until March 1, 2026. Early adopters receive a 50% lifetime discount.
          </p>
          <Button
            size="lg"
            onClick={handleJoin}
            className="h-12 px-8 bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-semibold rounded-xl"
          >
            Join This Challenge Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="bg-gray-950 text-white/70">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            <span className="font-semibold text-white">RunSmart</span> AI Running Coach
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
