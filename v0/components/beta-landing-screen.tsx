"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Users,
  Zap,
  CheckCircle2,
  Loader2,
  UserPlus,
  Trophy,
  BarChart3,
  Heart,
  Award,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useBetaSignupCount } from "@/lib/hooks/useBetaSignupCount";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@supabase/supabase-js";

interface BetaLandingScreenProps {
  onContinue?: () => void;
  showLegalLinks?: boolean;
  legalLinks?: {
    privacyHref?: string;
    termsHref?: string;
    contactEmail?: string;
  };
}

const DEFAULT_LEGAL_LINKS = {
  privacyHref: "/privacy",
  termsHref: "/terms",
  contactEmail: "firstname.lastname@runsmart-ai.com",
};

const COPY = {
  en: {
    earlyAccessBadge: 'Early Access Beta',
    heroTitle: 'Your AI Running Coach',
    heroSubtitle: 'runners getting fitter, faster with personalized AI coaching',
    joinCount: 'Join',
    valueProps: {
      aiPlans: 'AI-Powered Plans',
      tracking: 'Real-time Tracking',
      recovery: 'Recovery Insights',
      pioneer: 'Beta Pioneer',
    },
    runSmartTagline: 'Your AI Running Coach',
    claimSpot: 'Claim Your Beta Spot',
    joinBeta: 'Join the Beta',
    earlyAccess: 'Get exclusive early access to RunSmart',
    benefits: {
      title: 'Beta Pioneer Benefits',
      discount: '50% lifetime discount',
      badge: 'Exclusive Beta Pioneer badge',
      influence: 'Direct influence on future features',
      support: 'Priority support from the team',
    },
    form: {
      emailLabel: 'Email Address',
      emailRequired: '(required)',
      emailPlaceholder: 'you@example.com',
      nameLabel: 'Name',
      nameOptional: '(optional)',
      namePlaceholder: 'Your name',
      register: 'Complete Registration',
      joining: 'Joining...',
      back: '← Back',
    },
    trust: {
      secure: '🔒 Your data is private and secure',
      noCard: 'No credit card required • Cancel anytime',
    },
    welcome: {
      title: 'Welcome to RunSmart! 🎉',
      subtitle: "You're all set. Let's create your personalized running plan...",
    },
    validation: {
      emailRequired: 'Email required',
      emailRequiredDesc: 'Please enter your email to continue',
      invalidEmail: 'Invalid email',
      invalidEmailDesc: 'Please enter a valid email address',
    },
    privacy: 'Privacy',
    terms: 'Terms',
  },
  he: {
    earlyAccessBadge: 'גישה מוקדמת (בטא)',
    heroTitle: 'המאמן החכם שלך לריצה',
    heroSubtitle: 'רצים מתקדמים מהר יותר עם אימון AI אישי',
    joinCount: 'הצטרפו ל',
    valueProps: {
      aiPlans: 'תוכניות AI חכמות',
      tracking: 'מעקב בזמן אמת',
      recovery: 'ניתוח התאוששות',
      pioneer: 'חלוץ בטא',
    },
    runSmartTagline: 'המאמן החכם שלך לריצה',
    claimSpot: 'תפסו את המקום שלכם',
    joinBeta: 'הצטרפו לבטא',
    earlyAccess: 'קבלו גישה מוקדמת בלעדית ל-RunSmart',
    benefits: {
      title: 'הטבות לחלוצי הבטא',
      discount: '50% הנחה לכל החיים',
      badge: 'תג חלוץ בטא ייחודי',
      influence: 'השפעה ישירה על פיצ׳רים עתידיים',
      support: 'תמיכה עדיפה מהצוות',
    },
    form: {
      emailLabel: 'כתובת אימייל',
      emailRequired: '(חובה)',
      emailPlaceholder: 'you@example.com',
      nameLabel: 'שם',
      nameOptional: '(אופציונלי)',
      namePlaceholder: 'השם שלכם',
      register: 'השלמת רישום',
      joining: 'מצטרפים...',
      back: '→ חזרה',
    },
    trust: {
      secure: '🔒 המידע שלכם פרטי ומאובטח',
      noCard: 'ללא כרטיס אשראי • ניתן לבטל בכל עת',
    },
    welcome: {
      title: '!ברוכים הבאים ל-RunSmart 🎉',
      subtitle: 'הכל מוכן. בואו ניצור את תוכנית הריצה האישית שלכם...',
    },
    validation: {
      emailRequired: 'נדרש אימייל',
      emailRequiredDesc: 'אנא הזן את כתובת האימייל שלך כדי להמשיך',
      invalidEmail: 'אימייל לא תקין',
      invalidEmailDesc: 'אנא הזן כתובת אימייל תקינה',
    },
    privacy: 'פרטיות',
    terms: 'תנאים',
  },
} as const;

export function BetaLandingScreen({
  onContinue,
  showLegalLinks = false,
  legalLinks,
}: BetaLandingScreenProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [language, setLanguage] = useState<'en' | 'he'>('en');
  const betaSignups = useBetaSignupCount();
  const { toast } = useToast();
  const isHebrew = language === 'he';
  const copy = isHebrew ? COPY.he : COPY.en;
  const mergedLegalLinks = useMemo(
    () => ({ ...DEFAULT_LEGAL_LINKS, ...(legalLinks ?? {}) }),
    [legalLinks]
  );

  // Load language preference from URL or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    const storedLang = localStorage.getItem('beta_landing_lang');
    const initial =
      urlLang === 'he' || urlLang === 'en'
        ? urlLang
        : storedLang === 'he' || storedLang === 'en'
          ? storedLang
          : 'en';
    setLanguage(initial as 'en' | 'he');
  }, []);

  const setLanguagePreference = (nextLanguage: 'en' | 'he') => {
    setLanguage(nextLanguage);
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', nextLanguage);
      window.history.replaceState({}, '', url.toString());
      localStorage.setItem('beta_landing_lang', nextLanguage);
      void trackAnalyticsEvent('language_changed', {
        from: language,
        to: nextLanguage,
        location: 'beta_landing',
      });
    } catch {
      // ignore
    }
  };

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    }
  };

  const handleBetaSignup = async () => {
    if (!email.trim()) {
      toast({
        title: copy.validation.emailRequired,
        description: copy.validation.emailRequiredDesc,
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: copy.validation.invalidEmail,
        description: copy.validation.invalidEmailDesc,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn("Supabase not configured, proceeding without signup");
        trackAnalyticsEvent("beta_signup_attempted", {
          source: "landing_page",
          email,
          name: name || undefined,
          supabase_configured: false,
        });

        localStorage.setItem("beta_signup_email", email);
        if (name) localStorage.setItem("beta_signup_name", name);

        setSignupComplete(true);
        setTimeout(() => {
          handleContinue();
        }, 1500);
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase.from("beta_signups").insert([
        {
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          source: "landing_page",
          metadata: {
            signup_count: betaSignups.count,
            spots_remaining: betaSignups.spotsRemaining,
          },
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already registered!",
            description: "This email is already on the beta list. Welcome back!",
          });
          trackAnalyticsEvent("beta_signup_duplicate", {
            source: "landing_page",
            email,
          });
        } else {
          throw error;
        }
      } else {
        trackAnalyticsEvent("beta_signup_success", {
          source: "landing_page",
          email,
          name: name || undefined,
          signup_count: betaSignups.count,
          spots_remaining: betaSignups.spotsRemaining,
        });
      }

      localStorage.setItem("beta_signup_email", email);
      if (name) localStorage.setItem("beta_signup_name", name);

      setSignupComplete(true);

      setTimeout(() => {
        handleContinue();
      }, 1500);
    } catch (error) {
      console.error("Beta signup error:", error);

      // Still save email locally and proceed even if Supabase fails
      localStorage.setItem("beta_signup_email", email);
      if (name) localStorage.setItem("beta_signup_name", name);

      toast({
        title: "Signup saved locally",
        description: "We couldn't sync with the server, but your info is saved. You can continue!",
      });
      trackAnalyticsEvent("beta_signup_error_fallback", {
        source: "landing_page",
        error: error instanceof Error ? error.message : "Unknown error",
        fallback_used: true,
      });

      setSignupComplete(true);
      setTimeout(() => {
        handleContinue();
      }, 1500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const _handleSkip = () => {
    trackAnalyticsEvent("beta_signup_skipped", {
      source: "landing_page",
    });
    handleContinue();
  };

  const legalLinksMarkup = showLegalLinks ? (
    <div className={`mt-6 text-center text-xs text-white/60 ${isHebrew ? 'space-x-reverse space-x-3' : 'space-x-3'}`}>
      <Link href={mergedLegalLinks.privacyHref} className="hover:text-white/80 transition-colors">
        {copy.privacy}
      </Link>
      <span>|</span>
      <Link href={mergedLegalLinks.termsHref} className="hover:text-white/80 transition-colors">
        {copy.terms}
      </Link>
      <span>|</span>
      <a
        href={`mailto:${mergedLegalLinks.contactEmail}`}
        className="hover:text-white/80 transition-colors"
      >
        {mergedLegalLinks.contactEmail}
      </a>
    </div>
  ) : null;

  // Hero screen (like onboarding intro)
  if (!showForm && !signupComplete) {
    return (
      <div
        className="relative min-h-screen bg-[#1a1a1a] text-white flex flex-col"
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={isHebrew ? 'he' : 'en'}
      >
        {/* Full-screen Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/images/runsmart-intro-bg.jpg"
            alt="Runner at sunset"
            fill
            className="object-cover"
            priority
          />
          {/* Dark overlay for better text visibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          {/* Subtle noise texture for depth */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Giant Beta symbol for visual interest */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
            <span className="text-[20rem] md:text-[32rem] font-black text-white/[0.02] leading-none tracking-tighter">
              β
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between px-6 pb-6 pt-12">
          {/* Top section - Language Switcher & Badge */}
          <div className={`flex items-center justify-between pt-8 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <Badge
              variant="secondary"
              className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 px-4 py-2"
            >
              <Zap className={`h-4 w-4 ${isHebrew ? 'ml-2' : 'mr-2'} fill-current`} />
              {copy.earlyAccessBadge}
            </Badge>
            <LanguageSwitcher
              language={language}
              onChange={setLanguagePreference}
              variant="dark"
              className="text-xs"
            />
          </div>

          {/* Middle section - Hero text */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6 max-w-sm">
              <h1 className="text-5xl font-bold tracking-tight leading-tight">
                {copy.heroTitle}
              </h1>
              <p className="text-xl text-white/80 leading-relaxed">
                {copy.joinCount} {betaSignups.loading ? "200+" : `${betaSignups.count}+`}{" "}
                {copy.heroSubtitle}
              </p>

              {/* Social proof stats */}
              <div className={`flex items-center justify-center gap-2 text-sm ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-2 text-emerald-300 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                  <Users className="h-4 w-4" />
                  <span className="font-medium">
                    {betaSignups.loading
                      ? "Loading..."
                      : `${betaSignups.count}+ runners`}
                  </span>
                </div>
                <span className="text-white/40">•</span>
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-300 border-amber-400/30"
                >
                  {betaSignups.loading
                    ? "..."
                    : betaSignups.isNearCapacity
                      ? `Only ${betaSignups.spotsRemaining} left!`
                      : `${betaSignups.spotsRemaining} spots`}
                </Badge>
              </div>

              {/* Value props grid */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <Trophy className="h-8 w-8 text-emerald-400 mb-2" />
                  <p className="text-sm font-medium">{copy.valueProps.aiPlans}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <BarChart3 className="h-8 w-8 text-blue-400 mb-2" />
                  <p className="text-sm font-medium">{copy.valueProps.tracking}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <Heart className="h-8 w-8 text-purple-400 mb-2" />
                  <p className="text-sm font-medium">{copy.valueProps.recovery}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <Award className="h-8 w-8 text-orange-400 mb-2" />
                  <p className="text-sm font-medium">{copy.valueProps.pioneer}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom section - Logo and CTA */}
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex flex-col items-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-950/80 backdrop-blur-sm border border-emerald-400/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <img
                  src="/images/runsmart-logo-1.png"
                  alt="RunSmart"
                  className="h-10 w-10 object-contain"
                />
              </div>
              <h2 className="text-xl font-bold">RunSmart</h2>
              <p className="text-sm text-white/60">{copy.runSmartTagline}</p>
            </div>

            {/* CTA Button */}
            <Button
              className="w-full h-14 text-base bg-[#38bdf8] text-[#0a0a0a] hover:bg-[#4cc5f9] active:scale-[0.98] font-semibold rounded-2xl transition-all duration-200 shadow-lg"
              onClick={() => setShowForm(true)}
            >
              <UserPlus className={`h-5 w-5 ${isHebrew ? 'ml-2' : 'mr-2'}`} />
              {copy.claimSpot}
            </Button>

            {legalLinksMarkup}
          </div>
        </div>
      </div>
    );
  }

  // Signup form screen
  if (showForm && !signupComplete) {
    return (
      <div
        className="relative min-h-screen bg-[#1a1a1a] text-white flex flex-col"
        dir={isHebrew ? 'rtl' : 'ltr'}
        lang={isHebrew ? 'he' : 'en'}
      >
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 to-[#1a1a1a]" />
        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col px-6 pb-6 pt-12">
          {/* Header with Language Switcher */}
          <div className={`flex items-center justify-between mb-4 ${isHebrew ? 'flex-row-reverse' : ''}`}>
            <div className="flex-1" />
            <LanguageSwitcher
              language={language}
              onChange={setLanguagePreference}
              variant="dark"
              className="text-xs"
            />
          </div>

          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950/80 backdrop-blur-sm border border-emerald-400/30 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
                <img
                  src="/images/runsmart-logo-1.png"
                  alt="RunSmart"
                  className="h-8 w-8 object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">{copy.joinBeta}</h1>
            <p className="text-white/70">
              {copy.earlyAccess}
            </p>
          </div>

          {/* Benefits card */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 backdrop-blur-sm rounded-3xl p-6 border border-white/10 mb-8">
            <h3 className="font-semibold text-lg mb-4">
              {copy.benefits.title}
            </h3>
            <ul className="space-y-3 text-sm text-white/80">
              <li className={`flex items-start gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">{copy.benefits.discount}</strong>
                </span>
              </li>
              <li className={`flex items-start gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{copy.benefits.badge}</span>
              </li>
              <li className={`flex items-start gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{copy.benefits.influence}</span>
              </li>
              <li className={`flex items-start gap-3 ${isHebrew ? 'flex-row-reverse' : ''}`}>
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{copy.benefits.support}</span>
              </li>
            </ul>
          </div>

          {/* Form */}
          <div className="flex-1 space-y-4">
            <div>
              <label className={`text-sm font-medium text-white/90 mb-2 block ${isHebrew ? 'text-right' : ''}`}>
                {copy.form.emailLabel} <span className="text-red-400">{copy.form.emailRequired}</span>
              </label>
              <Input
                type="email"
                placeholder={copy.form.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBetaSignup();
                  }
                }}
              />
            </div>
            <div>
              <label className={`text-sm font-medium text-white/90 mb-2 block ${isHebrew ? 'text-right' : ''}`}>
                {copy.form.nameLabel} {copy.form.nameOptional}
              </label>
              <Input
                type="text"
                placeholder={copy.form.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-12 rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBetaSignup();
                  }
                }}
              />
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4 pt-6">
            <Button
              className="w-full h-14 text-base bg-white text-[#0a0a0a] hover:bg-white/95 font-bold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-100"
              onClick={handleBetaSignup}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className={`h-5 w-5 ${isHebrew ? 'ml-2' : 'mr-2'} animate-spin`} />
                  {copy.form.joining}
                </>
              ) : (
                copy.form.register
              )}
            </Button>

            <button
              onClick={() => setShowForm(false)}
              className="w-full text-sm text-white/60 hover:text-white/90 transition-colors"
              disabled={isSubmitting}
            >
              {copy.form.back}
            </button>
          </div>

          {/* Trust */}
          <div className="text-center pt-4 space-y-1">
            <p className="text-xs text-white/50">
              {copy.trust.secure}
            </p>
            <p className="text-xs text-white/40">
              {copy.trust.noCard}
            </p>
          </div>

          {legalLinksMarkup}
        </div>
      </div>
    );
  }

  // Success screen
  return (
    <div
      className="relative min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center p-6"
      dir={isHebrew ? 'rtl' : 'ltr'}
      lang={isHebrew ? 'he' : 'en'}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 to-[#1a1a1a]" />
      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 text-center space-y-6 max-w-sm">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 backdrop-blur-sm border-2 border-emerald-400/50 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">{copy.welcome.title}</h1>
          <p className="text-white/70 text-lg">
            {copy.welcome.subtitle}
          </p>
        </div>
        <div className="flex justify-center pt-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
        {legalLinksMarkup}
      </div>
    </div>
  );
}
