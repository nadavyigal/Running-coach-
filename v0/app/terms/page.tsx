import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Terms of Service | Run-Smart AI',
  description: 'Run-Smart AI terms of service.',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: false },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: February 2, 2026</p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Beta Program</h2>
          <p>
            Run-Smart AI is in active development. Features may change, be removed, or experience
            downtime as we iterate during the beta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
          <p>You must be at least 18 years old to join the beta waitlist.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. No Medical Advice</h2>
          <p>
            Run-Smart AI provides general fitness guidance. It is not medical advice and should not
            replace professional medical guidance. Always consult a professional for medical or
            injury concerns.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Do not misuse the service or attempt to disrupt the platform.</li>
            <li>Do not submit false or misleading information.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Termination</h2>
          <p>
            We may suspend or remove access if these terms are violated or if the beta program
            ends. You can opt out at any time by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Third-Party Integrations</h2>
          <p>
            Run-Smart AI may integrate with third-party services such as Garmin Connect. Your use of
            these integrations is subject to the respective third party&apos;s terms of service. We are
            not responsible for the availability or functionality of third-party services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
          <p>
            The beta is provided &quot;as is&quot; without warranties of any kind. To the fullest extent
            permitted by law, Run-Smart AI is not liable for damages arising from use of the beta.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
          <p>
            Questions? Email us at{' '}
            <a className="underline" href="mailto:nadav.yigal@runsmart-ai.com">
              nadav.yigal@runsmart-ai.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
