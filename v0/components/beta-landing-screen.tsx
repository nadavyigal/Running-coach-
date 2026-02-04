"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  privacyHref: "/landing/privacy",
  termsHref: "/landing/terms",
  contactEmail: "firstname.lastname@runsmart-ai.com",
};

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
  const betaSignups = useBetaSignupCount();
  const { toast } = useToast();
  const mergedLegalLinks = useMemo(
    () => ({ ...DEFAULT_LEGAL_LINKS, ...(legalLinks ?? {}) }),
    [legalLinks]
  );

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    }
  };

  const handleBetaSignup = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email to continue",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
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
    <div className="mt-6 text-center text-xs text-white/60 space-x-3">
      <Link href={mergedLegalLinks.privacyHref} className="hover:text-white/80 transition-colors">
        Privacy
      </Link>
      <span>|</span>
      <Link href={mergedLegalLinks.termsHref} className="hover:text-white/80 transition-colors">
        Terms
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
      <div className="relative min-h-screen bg-[#1a1a1a] text-white flex flex-col">
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
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-between px-6 pb-6 pt-12">
          {/* Top section - Badge */}
          <div className="flex justify-center pt-8">
            <Badge
              variant="secondary"
              className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 px-4 py-2"
            >
              <Zap className="h-4 w-4 mr-2 fill-current" />
              Early Access Beta
            </Badge>
          </div>

          {/* Middle section - Hero text */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-6 max-w-sm">
              <h1 className="text-5xl font-bold tracking-tight leading-tight">
                Your AI
                <br />
                Running Coach
              </h1>
              <p className="text-xl text-white/80 leading-relaxed">
                Join {betaSignups.loading ? "200+" : `${betaSignups.count}+`}{" "}
                runners getting fitter, faster with personalized AI coaching
              </p>

              {/* Social proof stats */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <div className="flex items-center gap-2 text-emerald-300">
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
                  <p className="text-sm font-medium">AI-Powered Plans</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <BarChart3 className="h-8 w-8 text-blue-400 mb-2" />
                  <p className="text-sm font-medium">Real-time Tracking</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <Heart className="h-8 w-8 text-purple-400 mb-2" />
                  <p className="text-sm font-medium">Recovery Insights</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                  <Award className="h-8 w-8 text-orange-400 mb-2" />
                  <p className="text-sm font-medium">Beta Pioneer</p>
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
              <p className="text-sm text-white/60">Your AI Running Coach</p>
            </div>

            {/* CTA Button */}
            <Button
              className="w-full h-14 text-base bg-[#38bdf8] text-[#0a0a0a] hover:bg-[#4cc5f9] active:scale-[0.98] font-semibold rounded-2xl transition-all duration-200 shadow-lg"
              onClick={() => setShowForm(true)}
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Claim Your Beta Spot
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
      <div className="relative min-h-screen bg-[#1a1a1a] text-white flex flex-col">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 to-[#1a1a1a]" />

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col px-6 pb-6 pt-12">
          {/* Header */}
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
            <h1 className="text-3xl font-bold mb-2">Join the Beta</h1>
            <p className="text-white/70">
              Get exclusive early access to RunSmart
            </p>
          </div>

          {/* Benefits card */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 backdrop-blur-sm rounded-3xl p-6 border border-white/10 mb-8">
            <h3 className="font-semibold text-lg mb-4">
              Beta Pioneer Benefits
            </h3>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">50% lifetime discount</strong>{" "}
                  - $4.99/mo forever
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Exclusive Beta Pioneer badge</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Direct influence on future features</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Priority support from the team</span>
              </li>
            </ul>
          </div>

          {/* Form */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="text-sm font-medium text-white/90 mb-2 block">
                Email Address <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
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
              <label className="text-sm font-medium text-white/90 mb-2 block">
                Name (optional)
              </label>
              <Input
                type="text"
                placeholder="Your name"
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
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                "Complete Registration"
              )}
            </Button>

            <button
              onClick={() => setShowForm(false)}
              className="w-full text-sm text-white/60 hover:text-white/90 transition-colors"
              disabled={isSubmitting}
            >
              ← Back
            </button>
          </div>

          {/* Trust */}
          <div className="text-center pt-4 space-y-1">
            <p className="text-xs text-white/50">
              🔒 Your data is private and secure
            </p>
            <p className="text-xs text-white/40">
              No credit card required • Cancel anytime
            </p>
          </div>

          {legalLinksMarkup}
        </div>
      </div>
    );
  }

  // Success screen
  return (
    <div className="relative min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 to-[#1a1a1a]" />

      <div className="relative z-10 text-center space-y-6 max-w-sm">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-500/20 backdrop-blur-sm border-2 border-emerald-400/50 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">Welcome to RunSmart! 🎉</h1>
          <p className="text-white/70 text-lg">
            You&apos;re all set. Let&apos;s create your personalized running plan...
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
