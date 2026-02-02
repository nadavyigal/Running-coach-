import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Run-Smart AI terms of service.',
  alternates: { canonical: '/landing/terms' },
  robots: { index: false, follow: false },
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
          <CardDescription>Last updated: February 2, 2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Beta program</h2>
            <p>
              Run-Smart AI is in active development. Features may change, be removed, or experience
              downtime as we iterate during the beta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Eligibility</h2>
            <p>You must be at least 18 years old to join the beta waitlist.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">No medical advice</h2>
            <p>
              Run-Smart AI provides general fitness guidance. It is not medical advice and should not
              replace professional medical guidance. Always consult a professional for medical or
              injury concerns.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Do not misuse the service or attempt to disrupt the platform.</li>
              <li>Do not submit false or misleading information.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Termination</h2>
            <p>
              We may suspend or remove access if these terms are violated or if the beta program
              ends. You can opt out at any time by contacting us.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Limitation of liability</h2>
            <p>
              The beta is provided &quot;as is&quot; without warranties of any kind. To the fullest extent
              permitted by law, Run-Smart AI is not liable for damages arising from use of the beta.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p>
              Questions? Email us at{' '}
              <a className="underline" href="mailto:firstname.lastname@runsmart-ai.com">
                firstname.lastname@runsmart-ai.com
              </a>.
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
