'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export function ProfessionalLandingScreen({
  onContinue: _onContinue,
  onExistingAccount,
}: ProfessionalLandingScreenProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const betaSignups = useBetaSignupCount();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    void trackAnalyticsEvent('page_viewed', {
      referrer_source: document.referrer || 'direct',
      page: 'professional_landing',
    });
  }, []);

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
      title: 'Chat with AI Coach',
      description:
        'Get real-time advice, ask questions, and receive personalized coaching through natural conversation',
      icon: MessageSquare,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Adaptive Training Plans',
      description: 'Plans that evolve with you — automatically adjusting to your progress, feedback, and schedule',
      icon: Calendar,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Recovery & Injury Prevention',
      description: 'Smart recovery tracking using sleep, HRV, and wellness data to keep you healthy and running strong',
      icon: Heart,
      gradient: 'from-rose-500 to-pink-500',
    },
    {
      title: 'Goal-Based Training',
      description: "Whether it's your first 5K or a marathon PR, train with purpose toward your specific goals",
      icon: Target,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      title: 'Race Readiness',
      description: 'Pacing strategies, taper plans, and race-day coaching so you show up prepared and confident',
      icon: Trophy,
      gradient: 'from-violet-500 to-indigo-500',
    },
    {
      title: 'Guided Challenges',
      description: '21-Day Start Running, Plateau Breaker, Morning Ritual — structured programs to build momentum',
      icon: Zap,
      gradient: 'from-emerald-600 to-lime-500',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
          <div className="absolute inset-0 bg-[url('/images/runsmart-intro-bg.jpg')] bg-cover bg-center opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 text-center">
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
              Early Access Beta
            </Badge>
            <Badge className="bg-white/80 text-gray-700 border-gray-300 px-4 py-2 text-sm font-medium">
              <Clock className="h-4 w-4 mr-2" />
              Early access available until March 1, 2026
            </Badge>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight tracking-tight">
            Your AI
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
              Running Coach
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-2xl mx-auto leading-relaxed">
            Join our growing community of runners getting fitter, faster with personalized AI coaching
          </p>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
            <Badge variant="outline" className="bg-white/80 text-gray-700 border-gray-300 px-4 py-2">
              <Activity className="h-4 w-4 mr-2" />
              AI-Powered Plans
            </Badge>
            <Badge variant="outline" className="bg-white/80 text-gray-700 border-gray-300 px-4 py-2">
              <Target className="h-4 w-4 mr-2" />
              Real-Time Tracking
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 px-4 py-2">
              <Award className="h-4 w-4 mr-2" />
              Limited spots available
            </Badge>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
            <Button
              size="lg"
              className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={handleHeroCta}
            >
              Get Started Free
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>

            <p className="text-sm text-gray-500">
              No credit card required • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Optional Beta Signup Section */}
      <section className="py-16 bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-emerald-100">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Get Early Access
              </h2>
              <p className="text-gray-600">
                Share your name and email for exclusive beta updates and a lifetime discount (email optional)
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl border-gray-300 text-base"
                />
              </div>
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="you@example.com"
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
                      title: 'Name required',
                      description: 'Please enter your name to continue',
                      variant: 'destructive',
                    });
                    return;
                  }
                  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    toast({
                      title: 'Invalid email',
                      description: 'Please enter a valid email address',
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
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Benefits */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-4">Beta Pioneer Benefits:</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <Trophy className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span><strong>50% lifetime discount</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Award className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span>Exclusive Beta Pioneer badge</span>
                </li>
                <li className="flex items-start gap-2">
                  <Heart className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <span>Priority support from the team</span>
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
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Guided Challenges to Kickstart Your Journey
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Three focused 21-day programs to build confidence, consistency, and momentum.
            </p>
            <button
              type="button"
              onClick={handleExistingAccount}
              className="text-sm text-emerald-700 hover:text-emerald-800 font-medium"
            >
              I already have an account
            </button>
          </div>

          <div className="max-w-3xl mx-auto bg-gray-50 rounded-3xl p-8 border border-gray-200">
            <ul className="space-y-3 text-lg text-gray-700">
              <li>
                <span className="font-semibold text-gray-900">21-Day Start Running</span> — Build a sustainable run habit from day one.
              </li>
              <li>
                <span className="font-semibold text-gray-900">21-Day Morning Guided Run</span> — Turn your mornings into a calm, consistent ritual.
              </li>
              <li>
                <span className="font-semibold text-gray-900">21-Day Plateau Breaker</span> — Reignite progress with structured variety and smart intensity.
              </li>
            </ul>
            <p className="mt-4 text-sm text-gray-500">...and more coming soon.</p>

            <div className="mt-8 text-center">
              <Button
                size="lg"
                onClick={handleGenericStart}
                className="h-12 px-8 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold"
              >
                Start Your Plan
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
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              RunSmart combines AI coaching with real-time tracking to help you reach your running goals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                  <div className={`h-14 w-14 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
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
                <p className="text-sm text-gray-400">Your AI Running Coach</p>
              </div>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">
                Terms
              </Link>
              <a
                href="mailto:nadav.yigal@runsmart-ai.com"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Contact
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
