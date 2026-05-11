import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Support – RunSmart',
  description: 'Get help with RunSmart, your adaptive running coach.',
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Support</h1>
        <p className="text-muted-foreground">We&apos;re here to help you get the most out of RunSmart.</p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
          <p>
            If you have questions, feedback, or need help with your account, please reach out to us:
          </p>
          <div className="mt-4 flex flex-col gap-4 not-prose">
            <a
              href="mailto:support@runsmart-ai.com"
              className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Email Support</p>
                <p className="text-sm text-muted-foreground">support@runsmart-ai.com</p>
              </div>
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-1">How do I generate a training plan?</h3>
              <p className="text-muted-foreground">
                Open the app, complete the onboarding goal-setting flow, and tap &quot;Generate Plan&quot;. RunSmart
                will create a personalized plan based on your goal, fitness level, and schedule.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">How do I connect Apple Health?</h3>
              <p className="text-muted-foreground">
                Go to Profile → Settings → Health Integration. Tap &quot;Connect Health&quot; and grant the requested
                permissions. RunSmart will sync workouts and health metrics when you authorize it.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">How do I reschedule or skip a workout?</h3>
              <p className="text-muted-foreground">
                Tap the workout in the Today or Plan tab, then choose &quot;Reschedule&quot; or &quot;Skip&quot;. The
                plan will adapt automatically to keep your training on track.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">How do I delete my account?</h3>
              <p className="text-muted-foreground">
                You can request account deletion from within the app via Profile → Account → Request Account Deletion,
                or by visiting our{' '}
                <Link href="/account-deletion" className="text-primary underline underline-offset-4">
                  account deletion page
                </Link>
                .
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Is my data secure?</h3>
              <p className="text-muted-foreground">
                Yes. RunSmart stores your data securely and never sells it to third parties. See our{' '}
                <Link href="/privacy" className="text-primary underline underline-offset-4">
                  Privacy Policy
                </Link>{' '}
                for full details.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">App Version</h2>
          <p className="text-muted-foreground">
            RunSmart iOS v1.0 — For the latest updates, check the App Store.
          </p>
        </section>
      </div>
    </div>
  )
}
