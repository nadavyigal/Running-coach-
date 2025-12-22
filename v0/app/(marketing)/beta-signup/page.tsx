import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BetaSignupForm } from './beta-signup-form'

export const metadata: Metadata = {
  title: 'Join the Run-Smart Beta | AI Running Coach Early Access',
  description:
    'Get early access to Run-Smart AI running coach. Lifetime 50% discount, exclusive badge, direct founder access. Limited beta spots. Sign up now.',
  alternates: {
    canonical: '/beta-signup',
  },
  openGraph: {
    title: 'Join the Run-Smart Beta - AI Running Coach',
    description:
      'Be among the first runners to experience adaptive AI coaching. Lifetime discounts + exclusive perks.',
    url: '/beta-signup',
    type: 'website',
    images: [
      {
        url: '/placeholder.jpg',
        width: 1200,
        height: 630,
        alt: 'Join the Run-Smart Beta',
      },
    ],
  },
  twitter: {
    title: 'Join the Run-Smart Beta',
    description: 'Early access to adaptive AI coaching + beta perks. Join the waitlist.',
    images: ['/placeholder.jpg'],
  },
}

export default function BetaSignupPage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Join the Run-Smart Beta
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            Be among the first to experience AI-powered running coaching. Get exclusive early access, lifetime
            discounts, and help shape the future of Run-Smart.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifetime 50% Discount</CardTitle>
            <CardDescription>Lock in beta pricing forever.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Early supporters keep the best deal—period.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beta Pioneer Badge</CardTitle>
            <CardDescription>Exclusive early-adopter achievement.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A special badge that shows you were here from the beginning.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Direct Founder Access</CardTitle>
            <CardDescription>Real conversations, no runaround.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your feedback shapes what we build next.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature Voting</CardTitle>
            <CardDescription>Priority say in the roadmap.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Help decide what we ship—your voice matters.
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What Happens After You Sign Up</h2>
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { title: "You're on the list", body: 'Instant confirmation and next steps.' },
            { title: 'Invites roll out', body: 'We invite runners in small waves.' },
            { title: 'Get your invite', body: 'A simple email with setup instructions.' },
            { title: 'Start running', body: 'Onboard, record runs, and share feedback.' },
            { title: 'Lock in perks', body: 'Discount + badge after participation.' },
          ].map((step, index) => (
            <Card key={step.title} className="h-full">
              <CardHeader>
                <div className="text-xs font-medium text-muted-foreground">Step {index + 1}</div>
                <CardTitle className="text-base">{step.title}</CardTitle>
                <CardDescription>{step.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sign Up for Early Access</h2>
        <BetaSignupForm />
      </section>
    </div>
  )
}

