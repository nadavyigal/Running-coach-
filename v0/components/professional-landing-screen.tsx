'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  ChevronRight,
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

  const featureCards = [
    {
      title: copy.features.chat.title,
      description: copy.features.chat.description,
      icon: MessageSquare,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: copy.features.adaptive.title,
      description: copy.features.adaptive.description,
      icon: Calendar,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: copy.features.recovery.title,
      description: copy.features.recovery.description,
      icon: Heart,
      gradient: 'from-rose-500 to-pink-500',
    },
    {
      title: copy.features.goal.title,
      description: copy.features.goal.description,
      icon: Target,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      title: copy.features.race.title,
      description: copy.features.race.description,
      icon: Trophy,
      gradient: 'from-violet-500 to-indigo-500',
    },
    {
      title: copy.features.challenges.title,
      description: copy.features.challenges.description,
      icon: Zap,
      gradient: 'from-emerald-600 to-lime-500',
    },
  ];

  return (
    <div className="min-h-screen bg-white" dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'}>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
          <div className="absolute inset-0 bg-[url('/images/runsmart-intro-bg.jpg')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 text-center">
          <div className={`flex items-center justify-between mb-10 text-sm ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <LanguageSwitcher
              language={language}
              onChange={setLanguagePreference}
              variant="default"
            />
            <button
              type="button"
              onClick={handleExistingAccount}
              className="text-emerald-700 hover:text-emerald-800 font-medium"
            >
              {copy.existingAccount}
            </button>
          </div>
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/80 backdrop-blur-sm border-2 border-emerald-200 shadow-xl">
              <img
                src="/images/runsmart-logo-1.png"
                alt="RunSmart"
                className="h-12 w-12 object-contain"
              />
            </div>
          </div>

          {/* Beta Badge */}
          <div className="flex justify-center mb-6 flex-wrap gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-300 px-4 py-2 text-sm font-medium">
              <Zap className="h-4 w-4 mr-2 fill-current" />
              {copy.earlyAccessBadge}
            </Badge>
            <Badge className="bg-white/80 text-gray-700 border-gray-300 px-4 py-2 text-sm font-medium">
              <Clock className="h-4 w-4 mr-2" />
              {copy.earlyAccessDeadline}
            </Badge>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
            {copy.heroTitleTop}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
              {copy.heroTitleHighlight}
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
            {copy.heroSubtitle}
          </p>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
            <Badge variant="outline" className="bg-white/80 text-gray-700 border-gray-300 px-4 py-2">
              <Activity className="h-4 w-4 mr-2" />
              {copy.socialProof.plans}
            </Badge>
            <Badge variant="outline" className="bg-white/80 text-gray-700 border-gray-300 px-4 py-2">
              <Target className="h-4 w-4 mr-2" />
              {copy.socialProof.tracking}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 px-4 py-2">
              <Award className="h-4 w-4 mr-2" />
              {copy.socialProof.spots}
            </Badge>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <Button
              size="lg"
              className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={handleHeroCta}
            >
              {copy.ctaPrimary}
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>

            <p className="text-sm text-gray-500">{copy.ctaSubtext}</p>
            <button
              type="button"
              onClick={handleExistingAccount}
              className="text-sm text-emerald-700 hover:text-emerald-800 font-medium"
            >
              {copy.ctaExisting}
            </button>
          </div>
        </div>
      </section>

      {/* Optional Beta Signup Section */}
      <section className="py-16 bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-emerald-100">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">{copy.betaSectionTitle}</h2>
              <p className="text-gray-600">{copy.betaSectionSubtitle}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder={copy.placeholders.name}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl border-gray-300 text-base"
                />
              </div>
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder={copy.placeholders.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-gray-300 text-base"
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
                className="h-12 px-8 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold"
              >
                {copy.continue}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Benefits */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-4">{copy.benefitsTitle}</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <Trophy className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span>
                    <strong>{copy.benefits.discount}</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span>{copy.benefits.badge}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="h-5 w-5 text-emerald-500 flex-shrink-0" />
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
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">{copy.challengesTitle}</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">{copy.challengesSubtitle}</p>
          </div>

          <div className="max-w-3xl mx-auto bg-gray-50 rounded-3xl p-8 border border-gray-200">
            <ul className="space-y-5 text-lg text-gray-700">
              {copy.challenges.map((challenge) => (
                <li key={challenge.slug} className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-900">
                    <Link href={`/challenges/${challenge.slug}`} className="hover:text-emerald-700 transition-colors">
                      {challenge.name}
                    </Link>
                  </span>
                  <span className="text-gray-600">{challenge.blurb}</span>
                  <Link
                    href={`/challenges/${challenge.slug}`}
                    className="text-sm text-emerald-700 hover:text-emerald-800 font-medium"
                  >
                    {copy.challengesLink}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-gray-500">{copy.challengesMore}</p>

            <div className="mt-8 text-center">
              <Button
                size="lg"
                onClick={handleGenericStart}
                className="h-12 px-8 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold"
              >
                {copy.challengesCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{copy.featuresTitle}</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">{copy.featuresSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                  <div className={`h-14 w-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white">
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
                <p className="text-sm text-gray-400">{copy.footerTagline}</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                {copy.footerLinks.privacy}
              </Link>
              <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">
                {copy.footerLinks.terms}
              </Link>
              <a
                href="mailto:nadav.yigal@runsmart-ai.com"
                className="text-gray-300 hover:text-white transition-colors"
              >
                {copy.footerLinks.contact}
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>© {new Date().getFullYear()} RunSmart. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
