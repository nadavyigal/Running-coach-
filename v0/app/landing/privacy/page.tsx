import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Run-Smart privacy policy.',
  alternates: { canonical: '/landing/privacy' },
  robots: { index: false, follow: false },
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
          <CardDescription>Last updated: December 25, 2025</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Information we collect</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Contact details you submit (email address).</li>
              <li>Beta signup details (experience level, goals, referral source).</li>
              <li>Product analytics (page views and interaction events).</li>
              <li>Feedback you choose to share with us.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">How we use information</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Operate the beta waitlist and send product updates.</li>
              <li>Improve product experience and onboarding.</li>
              <li>Measure marketing performance and conversion metrics.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Sharing</h2>
            <p>
              We use trusted service providers to run the waitlist and send emails (for example,
              Supabase for storage and Resend for email delivery). We do not sell your personal data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Your choices</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>You can unsubscribe from emails at any time.</li>
              <li>You can request deletion of your waitlist data.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p>
              Questions or requests? Email us at <a className="underline" href="mailto:runsmartteam@gmail.com">runsmartteam@gmail.com</a>.
            </p>
          </section>

          <Button asChild variant="outline">
            <Link href="/landing">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

