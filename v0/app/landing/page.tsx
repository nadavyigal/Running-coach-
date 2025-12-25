import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { HeartPulse, Sparkles, Trophy, WifiOff } from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Run-Smart: Your Personal AI Running Coach | Adaptive Training Plans',
  description:
    'Build a lasting running habit with AI-powered training plans that adapt to your life. Recovery-focused coaching, 21-day challenge, works offline. Start free.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Your Personal AI Running Coach That Adapts to Your Life',
    description:
      'Build lasting running habits with adaptive AI coaching and recovery-focused training plans.',
    url: '/',
    type: 'website',
    images: [
      {
        url: '/beta-app-preview.jpg',
        width: 1200,
        height: 630,
        alt: 'Run-Smart app preview',
      },
    ],
  },
  twitter: {
    title: 'Run-Smart AI Running Coach',
    description: 'Adaptive training plans that adjust to your life. Start your running journey today.',
    images: ['/beta-app-preview.jpg'],
    card: 'summary_large_image',
  },
}

export default function MarketingHomePage() {
  return (
    <div className="space-y-20">
      <section className="pt-2 md:pt-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                Your Personal AI Running Coach That Adapts to Your Life
              </h1>
              <p className="text-pretty text-lg text-muted-foreground">
                Build a lasting running habit with adaptive training plans, recovery-focused coaching,
                and real AI that actually listens.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/landing/beta-signup">Join the Beta</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#demo">See How It Works</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Install as an offline-first PWA. Your data stays local-first by default.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-muted">
              <Image
                src="/beta-app-preview.jpg"
                alt="Run-Smart app preview"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 space-y-1">
                <div className="text-sm font-medium">Product preview</div>
                <div className="text-xs text-muted-foreground">
                  A peek at the Run-Smart beta experience.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section aria-label="Social proof" className="flex justify-center">
        <Badge variant="secondary" className="px-4 py-1.5 text-sm">
          Join 200+ runners building their habit
        </Badge>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meet Run-Smart</h2>
          <p className="text-muted-foreground">
            Adaptive coaching, recovery-first training, and offline reliability so you can keep showing
            up - without the guilt spiral.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">AI Coaching</CardTitle>
              </div>
              <CardDescription>Plans that adjust to your life, not the other way around.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Missed a run or changed your schedule? Your plan adapts - no guilt, just adjustments.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Recovery Insights</CardTitle>
              </div>
              <CardDescription>Know when to push and when to rest.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Recovery-focused guidance helps you build consistency and reduce injury risk over time.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">21-Day Challenge</CardTitle>
              </div>
              <CardDescription>Build a habit that actually sticks.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A flexible, science-backed challenge designed for consistency over perfection.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Works Offline</CardTitle>
              </div>
              <CardDescription>No connection? No problem.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Install like an app and keep going even with spotty service - privacy-first and local-first.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            From Couch to Consistent Runner in 3 Simple Steps
          </h2>
          <p className="text-muted-foreground">
            Answer a few questions, get a plan, then let it evolve as you progress.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Tell Us About You',
              body: 'Answer a few quick questions about your running experience, goals, and schedule. Takes 2 minutes.',
            },
            {
              title: 'Get Your Personalized Plan',
              body: 'Our AI creates a custom 14-21 day training plan tailored to your fitness level and life commitments.',
            },
            {
              title: 'Run & Adapt',
              body: 'Record your runs, chat with your AI coach, and watch your plan evolve as real life happens.',
            },
          ].map((step, index) => (
            <Card key={step.title} className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="demo" className="scroll-mt-24 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">See Run-Smart in Action</h2>
          <p className="text-muted-foreground">
            A quick walkthrough of onboarding, today view, and AI coaching.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-muted">
            <Image src="/beta-app-preview.jpg" alt="Run-Smart demo preview" fill sizes="100vw" className="object-cover" />
          </div>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your Questions, Answered</h2>
          <p className="text-muted-foreground">
            Common objections, handled up front - so you can feel confident joining.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="beginner">
            <AccordionTrigger>Do I need to be a runner already?</AccordionTrigger>
            <AccordionContent>
              Nope. Our 21-Day Challenge is perfect for complete beginners. Start with walk-run intervals
              and build from there.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="different">
            <AccordionTrigger>What makes this different from other running apps?</AccordionTrigger>
            <AccordionContent>
              True AI adaptation. Your plan adjusts based on your progress and real-life constraints, with
              a recovery-first approach to help prevent burnout.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="offline">
            <AccordionTrigger>Does it work offline?</AccordionTrigger>
            <AccordionContent>
              Yes. As a Progressive Web App, Run-Smart works fully offline once installed - perfect for
              runs in areas with poor connectivity.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="privacy">
            <AccordionTrigger>Is my data private?</AccordionTrigger>
            <AccordionContent>
              Absolutely. All data is stored locally on your device first. You control what gets shared,
              exported, or deleted.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="equipment">
            <AccordionTrigger>Do I need special equipment?</AccordionTrigger>
            <AccordionContent>
              Just running shoes and your phone. GPS tracking and wearable integrations are optional.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cancel">
            <AccordionTrigger>Can I cancel anytime?</AccordionTrigger>
            <AccordionContent>
              Yes. No contracts, no commitments. Cancel your Premium subscription anytime.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="missed">
            <AccordionTrigger>What if I miss workouts?</AccordionTrigger>
            <AccordionContent>
              Life happens - that's the point. Your AI coach adapts your plan when you miss sessions. No
              guilt, just adjustment.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  )
}
