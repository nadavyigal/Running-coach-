'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  Clock,
  Heart,
  MessageSquare,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useBetaSignupCount } from '@/lib/hooks/useBetaSignupCount';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';

interface ProfessionalLandingScreenProps {
  onContinue?: () => void;
  onExistingAccount?: () => void;
}

const COPY = {
  en: {
    existingAccount: 'I already have an account',
    earlyAccessBadge: 'Early Access Beta',
    earlyAccessDeadline: 'Early access available until March 1, 2026',
    heroTitleTop: 'Your AI',
    heroTitleHighlight: 'Running Coach',
    heroSubtitle: 'Join our growing community of runners getting fitter, faster with personalized AI coaching',
    socialProof: {
      plans: 'AI-Powered Plans',
      tracking: 'Real-Time Tracking',
      spots: 'Limited spots available',
    },
    ctaPrimary: 'Get Started Free',
    ctaExisting: 'I already have an account',
    ctaSubtext: 'No credit card required • Cancel anytime',
    betaSectionTitle: 'Get Early Access',
    betaSectionSubtitle:
      'Share your name and email for exclusive beta updates and a lifetime discount (email optional)',
    placeholders: {
      name: 'Your name',
      email: 'you@example.com',
    },
    labels: {
      name: 'Name',
      email: 'Email (optional)',
    },
    continue: 'Continue',
    validation: {
      nameRequiredTitle: 'Name required',
      nameRequiredBody: 'Please enter your name to continue',
      invalidEmailTitle: 'Invalid email',
      invalidEmailBody: 'Please enter a valid email address',
    },
    benefitsTitle: 'Beta Pioneer Benefits:',
    benefits: {
      discount: '50% lifetime discount',
      badge: 'Exclusive Beta Pioneer badge',
      support: 'Priority support from the team',
    },
    challengesTitle: 'Guided Challenges to Kickstart Your Journey',
    challengesSubtitle: 'Three focused 21-day programs to build confidence, consistency, and momentum.',
    challenges: [
      {
        slug: 'start-running',
        name: '21-Day Start Running',
        blurb: 'Build a sustainable run habit from day one.',
      },
      {
        slug: 'morning-ritual',
        name: '21-Day Morning Guided Run',
        blurb: 'Turn your mornings into a calm, consistent ritual.',
      },
      {
        slug: 'plateau-breaker',
        name: '21-Day Plateau Breaker',
        blurb: 'Reignite progress with structured variety and smart intensity.',
      },
    ],
    challengesMore: '...and more coming soon.',
    challengesCta: 'Start Your Plan',
    challengesLink: 'View challenge page',
    featuresTitle: 'Everything You Need to Succeed',
    featuresSubtitle: 'RunSmart combines AI coaching with real-time tracking to help you reach your running goals',
    features: {
      chat: {
        title: 'Chat with AI Coach',
        description:
          'Get real-time advice, ask questions, and receive personalized coaching through natural conversation',
      },
      adaptive: {
        title: 'Adaptive Training Plans',
        description: 'Plans that evolve with you — automatically adjusting to your progress, feedback, and schedule',
      },
      recovery: {
        title: 'Recovery & Injury Prevention',
        description:
          'Smart recovery tracking using sleep, HRV, and wellness data to keep you healthy and running strong',
      },
      goal: {
        title: 'Goal-Based Training',
        description: "Whether it's your first 5K or a marathon PR, train with purpose toward your specific goals",
      },
      race: {
        title: 'Race Readiness',
        description:
          'Pacing strategies, taper plans, and race-day coaching so you show up prepared and confident',
      },
      challenges: {
        title: 'Guided Challenges',
        description:
          '21-Day Start Running, Plateau Breaker, Morning Ritual — structured programs to build momentum',
      },
    },
    footerTagline: 'Your AI Running Coach',
    footerLinks: {
      privacy: 'Privacy',
      terms: 'Terms',
      contact: 'Contact',
    },
  },
  he: {
    existingAccount: 'כבר יש לי חשבון',
    earlyAccessBadge: 'גישה מוקדמת (בטא)',
    earlyAccessDeadline: 'גישה מוקדמת זמינה עד 1 במרץ 2026',
    heroTitleTop: 'המאמן החכם שלך',
    heroTitleHighlight: 'בלי שעון יקר',
    heroSubtitle: 'אימון אישי מבוסס AI שמתאים לך — לא לשעון. הצטרפו לאלפי רצים בארץ שמתקדמים מהר יותר בלי לפגוע בכיס.',
    socialProof: {
      plans: 'תכניות חכמות ו־AI',
      tracking: 'מעקב וניתוח בזמן אמת',
      spots: 'מספר מקומות מוגבל',
    },
    ctaPrimary: 'בואו נתחיל',
    ctaExisting: 'כבר יש לי חשבון',
    ctaSubtext: 'חינם לגמרי • ללא כרטיס אשראי • אפשר לבטל בכל עת',
    betaSectionTitle: 'קבלו גישה מוקדמת + 50% הנחה לכל החיים',
    betaSectionSubtitle: 'השאירו שם ואימייל וקבלו הטבות מיוחדות לחלוצים. (אימייל אופציונלי)',
    placeholders: {
      name: 'שמכם (חובה)',
      email: 'you@example.com',
    },
    labels: {
      name: 'שם',
      email: 'אימייל (אופציונלי)',
    },
    continue: 'המשך',
    validation: {
      nameRequiredTitle: 'חסר שם',
      nameRequiredBody: 'אנא הזן את שמך כדי להמשיך',
      invalidEmailTitle: 'אימייל לא תקין',
      invalidEmailBody: 'אנא הזן כתובת אימייל תקינה',
    },
    benefitsTitle: 'למה להיות אחד מהחלוצים:',
    benefits: {
      discount: '50% הנחה לכל החיים • לא לוותר',
      badge: 'תג חלוץ בטא ייחודי',
      support: 'קשר ישיר עם צוות הפיתוח',
    },
    challengesTitle: 'אתגרים של 21 ימים שישנו את הריצה שלכם',
    challengesSubtitle: 'תוכניות ממוקדות שמבנות בטחון, עקביות והרגלים שנשארים.',
    challenges: [
      {
        slug: 'start-running',
        name: '21 ימים להתחיל לרוץ',
        blurb: 'מאפס ל־30 דקות ריצה רצופה — בלי שיפוט, בלי ברירה.',
      },
      {
        slug: 'morning-ritual',
        name: 'ריצת בוקר מודרכת',
        blurb: 'הפכו את הבוקר לטקס שלכם — רגוע, מרכז, חזק.',
      },
      {
        slug: 'plateau-breaker',
        name: 'פורצי פלטו',
        blurb: 'תקועים באותה רמה? בואו נשבור את זה עם AI חכם.',
      },
    ],
    challengesMore: 'ועוד אתגרים בהמשך.',
    challengesCta: 'התחל אתגר',
    challengesLink: 'לדף הפרטים',
    featuresTitle: 'כל מה שצריך כדי להיות רץ טוב',
    featuresSubtitle: 'מאמן AI שמתאים לך, מעקב של הכל, התעוררות כל בוקר עם תכנית שהוא מכן.',
    features: {
      chat: {
        title: 'שיחה עם מאמן AI שלך',
        description: 'שאלו אותו הכל — מהירות, תזונה, פציעות, לוח זמנים. הוא מכיר אתכם.',
      },
      adaptive: {
        title: 'תכנית שמתאימה לחייכם',
        description: 'התכנית משתנה עם הרוח שלכם, עומס העבודה, השינה ותחושת הגוף.',
      },
      recovery: {
        title: 'התאוששות חכמה — בלי שעון',
        description: 'מעקב אחרי שינה, פעילות, ורווחה כללית. בדיוק כמו Whoop, בלי ₪2000.',
      },
      goal: {
        title: 'אימון עם מטרה',
        description: 'בין 5 ק״מ ראשון או שיא אישי — תלחמו ביעד שלכם עם תוכנית מדעית.',
      },
      race: {
        title: 'מוכנות לתחרויות',
        description: 'קצב חכם, טייפר, ואימון יום המרוץ. כל מה שצריך כדי לתפוס את הרצאה שלכם.',
      },
      challenges: {
        title: 'אתגרים מודרכים של 21 ימים',
        description: 'להתחיל לרוץ, ריצת בוקר, שבירת פלטו — כל אחד מובנה כדי לתוך התקדמות.',
      },
    },
    footerTagline: 'בנויה בארץ, למרצים בארץ',
    footerLinks: {
      privacy: 'פרטיות',
      terms: 'תנאי שימוש',
      contact: 'יצירת קשר',
    },
  },
} as const;

export function ProfessionalLandingScreen({
  onContinue: _onContinue,
  onExistingAccount,
}: ProfessionalLandingScreenProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'en' | 'he'>('en');
  const betaSignups = useBetaSignupCount();
  const { toast } = useToast();
  const isHebrew = language === 'he';
  const copy = isHebrew ? COPY.he : COPY.en;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    const storedLang = localStorage.getItem('landing_lang');
    const initial =
      urlLang === 'he' || urlLang === 'en'
        ? urlLang
        : storedLang === 'he' || storedLang === 'en'
          ? storedLang
          : 'en';
    setLanguage(initial as 'en' | 'he');
    if (initial !== urlLang) {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', initial);
      window.history.replaceState({}, '', url.toString());
    }
    void trackAnalyticsEvent('page_viewed', {
      referrer_source: document.referrer || 'direct',
      page: 'professional_landing',
    });
  }, []);

  const setLanguagePreference = (nextLanguage: 'en' | 'he') => {
    setLanguage(nextLanguage);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', nextLanguage);
      window.history.replaceState({}, '', url.toString());
      localStorage.setItem('landing_lang', nextLanguage);
    } catch {
      // ignore
    }
  };

  const trackCtaClick = (buttonText: string, buttonLocation: string, extra?: Record<string, unknown>) => {
    void trackAnalyticsEvent('cta_clicked', {
      button_text: buttonText,
      button_location: buttonLocation,
      ...extra,
    });
  };

  const saveEmailOptionally = async (email: string, nameValue?: string) => {
    if (!email.trim()) return;

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = nameValue?.trim();

      // Save to localStorage first
      localStorage.setItem('beta_signup_email', normalizedEmail);
      if (trimmedName) {
        localStorage.setItem('beta_signup_name', trimmedName);
      }

      // Try to save to Supabase if configured
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const metadata: Record<string, unknown> = {
          signup_count: betaSignups.count,
          spots_remaining: betaSignups.spotsRemaining,
        };
        if (trimmedName) {
          metadata.name = trimmedName;
        }
        await supabase.from('beta_signups').insert([
          {
            email: normalizedEmail,
            source: 'landing_page',
            metadata,
          },
        ]);
      }

      trackAnalyticsEvent('beta_signup_success', {
        source: 'professional_landing',
        email: normalizedEmail,
        name: trimmedName,
      });
    } catch (error) {
      console.error('Error saving email:', error);
      // Non-fatal - email is still saved locally
    }
  };

  const handleGenericStart = async () => {
    trackCtaClick('Start Without Challenge', 'challenge_section');

    // Save email if provided
    if (email) {
      void trackAnalyticsEvent('form_submitted', { form_type: 'beta_email', source: 'professional_landing' });
      await saveEmailOptionally(email, name);
    }

    localStorage.setItem('beta_signup_complete', 'true');

    trackAnalyticsEvent('generic_onboarding_started', {
      source: 'professional_landing',
    });

    // Navigate to onboarding without challenge
    window.location.href = '/onboarding';
  };

  const revealChallenges = () => {
    const challengesSection = document.getElementById('challenges-section');
    if (challengesSection) {
      challengesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHeroCta = () => {
    trackCtaClick('Get Started Free', 'hero');
    revealChallenges();
  };

  const handleExistingAccount = () => {
    trackCtaClick('I already have an account', 'hero');
    try {
      localStorage.setItem('beta_signup_complete', 'true');
    } catch {
      // ignore storage errors
    }
    if (onExistingAccount) {
      onExistingAccount();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/today';
    }
  };

  // Animation variants for staggered reveals
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  const featureCards = [
    {
      title: copy.features.chat.title,
      description: copy.features.chat.description,
      icon: MessageSquare,
      tone: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: copy.features.adaptive.title,
      description: copy.features.adaptive.description,
      icon: Calendar,
      tone: 'bg-sky-100 text-sky-700',
    },
    {
      title: copy.features.recovery.title,
      description: copy.features.recovery.description,
      icon: Heart,
      tone: 'bg-rose-100 text-rose-700',
    },
    {
      title: copy.features.goal.title,
      description: copy.features.goal.description,
      icon: Target,
      tone: 'bg-amber-100 text-amber-700',
    },
    {
      title: copy.features.race.title,
      description: copy.features.race.description,
      icon: Trophy,
      tone: 'bg-indigo-100 text-indigo-700',
    },
    {
      title: copy.features.challenges.title,
      description: copy.features.challenges.description,
      icon: Zap,
      tone: 'bg-lime-100 text-lime-700',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'}>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-28 right-[-10%] h-80 w-80 rounded-full bg-[oklch(90%_0.06_150)] blur-3xl opacity-70" />
          <div className="absolute -bottom-36 left-[-10%] h-96 w-96 rounded-full bg-[oklch(88%_0.05_210)] blur-3xl opacity-60" />
          <div className="absolute inset-0 noise-overlay opacity-[0.25]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-black/5">
                <img src="/images/runsmart-logo-1.png" alt="RunSmart" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">RunSmart</div>
                <div className="text-xs text-foreground/60">{copy.earlyAccessBadge}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher language={language} onChange={setLanguagePreference} variant="default" />
              <button
                type="button"
                onClick={handleExistingAccount}
                className="text-sm font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {copy.existingAccount}
              </button>
            </div>
          </div>

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1">
                  <Zap className="h-4 w-4 mr-2" />
                  {copy.earlyAccessBadge}
                </Badge>
                <Badge className="bg-white/70 text-foreground border-border px-3 py-1">
                  <Clock className="h-4 w-4 mr-2" />
                  {copy.earlyAccessDeadline}
                </Badge>
              </div>

              <motion.h1 variants={itemVariants} className="text-5xl md:text-6xl font-black text-foreground leading-tight">
                {copy.heroTitleTop} <span className="text-primary">{copy.heroTitleHighlight}</span>
              </motion.h1>

              <motion.p variants={itemVariants} className="text-lg md:text-xl text-foreground/70 leading-relaxed max-w-xl">
                {copy.heroSubtitle}
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="h-14 px-8 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={handleHeroCta}
                >
                  {copy.ctaPrimary}
                  <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
                <span className="text-sm text-foreground/60">{copy.ctaSubtext}</span>
              </motion.div>

              <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2 text-sm">
                  <Activity className="h-4 w-4 text-primary" />
                  {copy.socialProof.plans}
                </div>
                <div className="flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-2 text-sm">
                  <Target className="h-4 w-4 text-primary" />
                  {copy.socialProof.tracking}
                </div>
                <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                  <Award className="h-4 w-4" />
                  {copy.socialProof.spots}
                </div>
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants} initial="hidden" animate="show" className="relative">
              <div className="absolute -top-8 right-6 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
              <div className="rounded-[32px] border border-border bg-white/80 backdrop-blur p-8 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-foreground/50">Today</p>
                    <p className="text-lg font-semibold">Tempo Progression</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20">Personalized</Badge>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-border bg-[oklch(var(--surface-2))] p-4">
                    <p className="text-xs text-foreground/50">Target distance</p>
                    <p className="text-2xl font-semibold">6.2 km</p>
                    <div className="mt-3 h-2 rounded-full bg-border/70">
                      <div className="h-full w-2/3 rounded-full bg-primary" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <p className="text-xs text-foreground/50">Coach cue</p>
                      <p className="text-sm font-semibold">Hold 6:05/km</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white p-4">
                      <p className="text-xs text-foreground/50">Recovery</p>
                      <p className="text-sm font-semibold">Green zone</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-foreground/50">Coach message</p>
                    <p className="text-sm font-medium">Short strides on the hills today.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Optional Beta Signup Section */}
      <section className="py-16 bg-[oklch(var(--surface-2))]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white/90 rounded-[32px] shadow-lg p-8 md:p-12 border border-border">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">{copy.betaSectionTitle}</h2>
              <p className="text-base md:text-lg text-foreground/70">{copy.betaSectionSubtitle}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end mb-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                  {copy.labels.name}
                </label>
                <Input
                  type="text"
                  placeholder={copy.placeholders.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 rounded-2xl border-border text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
                  {copy.labels.email}
                </label>
                <Input
                  type="email"
                  placeholder={copy.placeholders.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-2xl border-border text-base"
                />
              </div>
              <Button
                size="lg"
                onClick={() => {
                  if (!name.trim()) {
                    toast({
                      title: copy.validation.nameRequiredTitle,
                      description: copy.validation.nameRequiredBody,
                      variant: 'destructive',
                    });
                    return;
                  }
                  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    toast({
                      title: copy.validation.invalidEmailTitle,
                      description: copy.validation.invalidEmailBody,
                      variant: 'destructive',
                    });
                    return;
                  }
                  localStorage.setItem('beta_signup_name', name.trim());
                  trackCtaClick('Continue', 'beta_signup');
                  if (email) {
                    void trackAnalyticsEvent('form_submitted', { form_type: 'beta_email', source: 'professional_landing' });
                  }
                  revealChallenges();
                }}
                className="h-14 px-6 bg-primary text-primary-foreground rounded-full font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {copy.continue}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Benefits */}
            <div className="mt-8 pt-8 border-t border-border">
              <p className="text-sm font-semibold text-foreground mb-4">{copy.benefitsTitle}</p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li className="flex items-start gap-2">
                  <Trophy className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>
                    <strong>{copy.benefits.discount}</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{copy.benefits.badge}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>{copy.benefits.support}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Challenges Section */}
      <section id="challenges-section" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">{copy.challengesTitle}</h2>
            <p className="text-base md:text-lg text-foreground/70 max-w-3xl mx-auto leading-relaxed">{copy.challengesSubtitle}</p>
          </div>

          <div className="max-w-3xl mx-auto bg-[oklch(var(--surface-2))] rounded-3xl p-8 border border-border">
            <ul className="space-y-5 text-lg text-foreground/80">
              {copy.challenges.map((challenge) => (
                <li key={challenge.slug} className="flex flex-col gap-1">
                  <span className="font-semibold text-foreground">
                    <Link href={`/challenges/${challenge.slug}`} className="hover:text-primary transition-colors">
                      {challenge.name}
                    </Link>
                  </span>
                  <span className="text-foreground/70">{challenge.blurb}</span>
                  <Link
                    href={`/challenges/${challenge.slug}`}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    {copy.challengesLink}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-foreground/60">{copy.challengesMore}</p>

            <div className="mt-8 text-center">
              <Button
                size="lg"
                onClick={handleGenericStart}
                className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {copy.challengesCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 bg-[oklch(var(--surface-2))]">
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">{copy.featuresTitle}</h2>
            <p className="text-base md:text-lg text-foreground/70 max-w-2xl mx-auto leading-relaxed">{copy.featuresSubtitle}</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* Row 1: Chat (1 col) + Adaptive (2 cols) */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-1 bg-white rounded-3xl p-8 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`h-16 w-16 ${featureCards[0].tone} rounded-2xl flex items-center justify-center mb-6`}>
                <MessageSquare className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3 leading-tight">{featureCards[0].title}</h3>
              <p className="text-base text-foreground/70 leading-relaxed">{featureCards[0].description}</p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="md:col-span-2 bg-white rounded-3xl p-8 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`h-16 w-16 ${featureCards[1].tone} rounded-2xl flex items-center justify-center mb-6`}>
                <Calendar className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3 leading-tight">{featureCards[1].title}</h3>
              <p className="text-base text-foreground/70 leading-relaxed">{featureCards[1].description}</p>
            </motion.div>

            {/* Row 2: Recovery (full width, giant icon) */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-3 bg-white rounded-3xl p-10 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className={`h-24 w-24 ${featureCards[2].tone} rounded-3xl flex items-center justify-center flex-shrink-0`}>
                  <Heart className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 leading-tight">{featureCards[2].title}</h3>
                  <p className="text-base md:text-lg text-foreground/70 leading-relaxed">{featureCards[2].description}</p>
                </div>
              </div>
            </motion.div>

            {/* Row 3: Goal (2 cols) + Race (1 col) */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-2 bg-white rounded-3xl p-8 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`h-16 w-16 ${featureCards[3].tone} rounded-2xl flex items-center justify-center mb-6`}>
                <Target className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3 leading-tight">{featureCards[3].title}</h3>
              <p className="text-base text-foreground/70 leading-relaxed">{featureCards[3].description}</p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="md:col-span-1 bg-white rounded-3xl p-8 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`h-16 w-16 ${featureCards[4].tone} rounded-2xl flex items-center justify-center mb-6`}>
                <Trophy className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3 leading-tight">{featureCards[4].title}</h3>
              <p className="text-base text-foreground/70 leading-relaxed">{featureCards[4].description}</p>
            </motion.div>

            {/* Row 4: Challenges (full width) */}
            <motion.div
              variants={itemVariants}
              className="md:col-span-3 bg-white rounded-3xl p-10 border border-border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className={`h-24 w-24 ${featureCards[5].tone} rounded-3xl flex items-center justify-center flex-shrink-0`}>
                  <Zap className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 leading-tight">{featureCards[5].title}</h3>
                  <p className="text-base md:text-lg text-foreground/70 leading-relaxed">{featureCards[5].description}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[oklch(var(--black))] text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo and tagline */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center">
                <img
                  src="/images/runsmart-logo-1.png"
                  alt="RunSmart"
                  className="h-6 w-6 object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-lg">RunSmart</p>
                <p className="text-sm text-white/60">{copy.footerTagline}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-white/70 hover:text-white transition-colors">
                {copy.footerLinks.privacy}
              </Link>
              <Link href="/terms" className="text-white/70 hover:text-white transition-colors">
                {copy.footerLinks.terms}
              </Link>
              <a
                href="mailto:nadav.yigal@runsmart-ai.com"
                className="text-white/70 hover:text-white transition-colors"
              >
                {copy.footerLinks.contact}
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-white/50">
            <p>© {new Date().getFullYear()} RunSmart. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

