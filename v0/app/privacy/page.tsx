import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrivacyPolicy() {
  const lastUpdated = 'February 2, 2026'

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
          <p>
            Welcome to RunSmart AI. We respect your privacy and are committed to protecting your personal data. This
            privacy policy allows you to understand what data we collect, how we use it, where it is stored, and your
            rights regarding your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
          <p>We collect the following types of information to provide you with a personalized running coach experience:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Activity Data:</strong> GPS routes, distance, pace, and time.
            </li>
            <li>
              <strong>Health Metrics:</strong> Heart rate, step count, and other health-related metrics synced from your
              devices (e.g., Apple Watch, Garmin).
            </li>
            <li>
              <strong>Profile Information:</strong> Age, weight, fitness level, and running goals.
            </li>
            <li>
              <strong>Interaction Data:</strong> Chats with the AI coach and feedback on workouts.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. How Your Data is Stored</h2>
          <p>
            <strong>Local-First Storage:</strong> RunSmart AI is designed with a &quot;local-first&quot; architecture. Your
            personal activity data, health metrics, and chat history are stored <strong>locally on your device</strong>{' '}
            using IndexedDB. We do not maintain a central database of your detailed activity history.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. How We Use Your Data</h2>
          <p>We use your data solely to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Generate personalized training plans.</li>
            <li>Track your progress and provide performance insights.</li>
            <li>Calculate recovery scores and health metrics.</li>
            <li>Enable the AI Coach to give relevant advice.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Third Parties</h2>
          <div className="space-y-3">
            <div>
              <h3 className="font-medium text-primary">AI Services</h3>
              <p>
                To provide AI coaching features, we send necessary context (such as your recent run stats and goals) to our
                AI provider (OpenAI). This data is processed ephemerally to generate responses and is not used to train
                their models.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-primary">Garmin &amp; Device Integrations</h3>
              <p>
                If you choose to connect your Garmin account, we access your user-authorized activity data via the Garmin
                Connect Developer Program strictly to import your runs into RunSmart AI. We do not write data back to
                Garmin or share this data with other third parties.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-primary">Analytics</h3>
              <p>
                We use anonymous analytics tools (like PostHog and Google Analytics) to understand app usage patterns and
                improve performance. These tools do not access your personal health or activity data.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Garmin Connect Integration</h2>
          <p>
            If you choose to connect Garmin, we only access the data you authorize and only for coaching and analytics.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Data accessed:</strong> running activities, heart rate, and training metrics.
            </li>
            <li>
              <strong>Purpose:</strong> import runs into RunSmart for coaching insights, recovery scores, and analytics.
            </li>
            <li>
              <strong>Storage:</strong> imported activity data is stored locally on your device. OAuth tokens are encrypted
              with AES-256-GCM before storage.
            </li>
            <li>
              <strong>No resale or write-back:</strong> we do not sell Garmin data and we do not write data back to Garmin.
            </li>
            <li>
              <strong>Disconnect:</strong> Settings {'->'} Devices {'->'} Garmin {'->'} Disconnect.
            </li>
            <li>
              <strong>Delete:</strong> you can delete all imported Garmin data from the app.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
          <p>Since your data is stored locally, you have full control over it. You can:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Delete your data:</strong> Clearing your browser data or using the &quot;Reset App&quot; feature in
              settings will permanently delete all your local data.
            </li>
            <li>
              <strong>Export your data:</strong> (Coming soon) You can request an export of your local database.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at
            support@runsmart.app.
          </p>
        </section>
      </div>
    </div>
  )
}
