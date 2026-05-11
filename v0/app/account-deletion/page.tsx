import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Account Deletion – RunSmart',
  description: 'Request deletion of your RunSmart account and data.',
}

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Account Deletion</h1>
        <p className="text-muted-foreground">Request deletion of your RunSmart account and all associated data.</p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <div className="not-prose flex items-start gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 mb-6">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-destructive">This action is permanent and cannot be undone.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Deleting your account removes all your training plans, workout history, and personal data from RunSmart.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">How to Delete Your Account</h2>

          <h3 className="font-semibold mb-2">Option 1: Delete from within the app (recommended)</h3>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>Open RunSmart on your iPhone</li>
            <li>Tap the <strong className="text-foreground">Profile</strong> tab</li>
            <li>Tap <strong className="text-foreground">Account</strong></li>
            <li>Tap <strong className="text-foreground">Request Account Deletion</strong></li>
            <li>Confirm the deletion when prompted</li>
          </ol>

          <h3 className="font-semibold mb-2 mt-6">Option 2: Request via email</h3>
          <p className="text-muted-foreground">
            Send a deletion request to{' '}
            <a href="mailto:support@runsmart-ai.com?subject=Account%20Deletion%20Request" className="text-primary underline underline-offset-4">
              support@runsmart-ai.com
            </a>{' '}
            from the email address associated with your RunSmart account. Include &quot;Account Deletion Request&quot; in
            the subject line. We will process your request within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">What Gets Deleted</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>Your account credentials and profile information</li>
            <li>All training plans and workout history</li>
            <li>Goal settings and coaching preferences</li>
            <li>Route history and GPS data stored in RunSmart</li>
            <li>AI coaching conversation history</li>
          </ul>

          <h3 className="font-semibold mb-2 mt-4">What is not affected</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              Data stored directly in Apple Health — RunSmart does not delete data you have written to HealthKit.
              Manage that via the Health app.
            </li>
            <li>Data held by third-party services (e.g., Garmin Connect) that you connected separately.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Processing Time</h2>
          <p className="text-muted-foreground">
            Account deletion requests submitted in-app are processed immediately. Email requests are processed within
            30 days. You will receive a confirmation email when deletion is complete.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Questions?</h2>
          <p className="text-muted-foreground">
            If you have questions about the deletion process or your data, contact us at{' '}
            <a href="mailto:support@runsmart-ai.com" className="text-primary underline underline-offset-4">
              support@runsmart-ai.com
            </a>{' '}
            or visit our{' '}
            <Link href="/support" className="text-primary underline underline-offset-4">
              Support page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
