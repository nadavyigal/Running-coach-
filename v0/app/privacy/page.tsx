import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4 pl-0 hover:bg-transparent">
          <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to App</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: October 23, 2026</p>
      </header>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-3">Information we handle</h2>
          <p>
            RunSmart provides running plans, run recording, activity history and coaching through its website and iOS app.
            Depending on the features you use, we handle account identifiers, email and name; running goals and preferences;
            training plans; completed activities; and messages and feedback you send to the coach.
          </p>
          <p>
            Outdoor recording uses precise location to calculate your route, distance, pace and elevation. The iOS app uses
            background location during an active or paused run, including while the phone is locked. Run recordings can
            include start and finish times, moving time, pauses, splits, effort, titles, notes and estimated calories.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Apple Health and optional weight</h2>
          <p>
            With your permission, the iOS app reads supported workouts, routes, heart rate, HRV, sleep, steps and active
            energy to provide running and readiness information. Optional weight access reads your latest Health weight
            for calorie estimates; you can enter a weight locally instead. Weight used for these estimates is kept on
            your device. A calorie value is an estimate, not a measurement of energy expenditure.
          </p>
          <p>
            With separate write permission, RunSmart saves completed RunSmart runs to Apple Health, including their
            route, pause events and estimated active calories when available. You can manage Health access in Apple
            Health or iOS Settings. Declining optional Health access does not require you to connect another service.
          </p>
        </section>

        <section id="garmin-connect-data" className="scroll-mt-24">
          <h2 className="text-xl font-semibold mb-3">Garmin Connect data</h2>
          <p>
            New Garmin connections are currently unavailable. Previously authorized activity and wellness data may remain
            in your RunSmart history. Depending on the device and permissions originally granted, that data can include
            timestamps, distance, duration, pace, elevation, GPS routes, heart rate, HRV, sleep, stress, body battery,
            steps and training metrics. RunSmart uses this history for coaching, progress and recovery information.
          </p>
          <p>
            Disconnecting an existing integration stops future synchronization; it does not by itself delete activity
            history already stored in RunSmart. Contact support if you need help removing previously imported data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Storage and service providers</h2>
          <p>
            The website uses local browser storage, including IndexedDB, for parts of its activity and coaching experience.
            The native iOS app also keeps local recordings, recovery checkpoints, preferences and cached history. Signed-in
            features use authenticated backend services, including Supabase, to store or synchronize account information,
            training plans, activities, saved routes and coach conversations. Some fields, such as a run&apos;s title and
            notes in the current iOS app, are stored only on the device.
          </p>
          <p>
            Clearing browser data or uninstalling the app does not delete your RunSmart account or information stored
            by backend services. Local-only information can be lost when you clear storage or remove the app.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">How we use information</h2>
          <p>
            We use information to operate your account, record and display activities, generate training plans,
            calculate running and recovery information, answer coaching requests, and understand reliability and feature
            usage. AI features send the relevant messages and training context to RunSmart&apos;s backend and AI service
            providers, including OpenAI. This can include activity and wellness context used for the requested coaching.
            Do not include information in a coach message that you do not want processed for that purpose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Sharing a run</h2>
          <p>
            Sharing is optional. A share image contains run statistics; including a route map is off by default. When
            you turn the map on, RunSmart removes the first and last 200 metres of the route and points near those
            endpoints. Short routes may not offer a map. This reduces exposure around the start and finish, but is
            not a guarantee of anonymity: the remaining route or other visible details may identify a place or person.
          </p>
          <p>
            The app prepares the image on your device. You choose the recipient or destination using the system share
            sheet. After sharing, that recipient or service controls its copy under its own settings and policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Usage analytics</h2>
          <p>
            RunSmart uses PostHog for native app usage and reliability analytics. Events can include app version and
            build, screens and features used, operational outcomes, and run statistics such as distance, duration, pace
            and workout type. After sign-in, usage events can be linked to your RunSmart account. These analytics are
            not described as wholly anonymous. The website may also use its configured usage analytics, including
            Google Analytics. The native app does not use this information to track you across other companies&apos;
            apps or websites for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Your controls and deletion</h2>
          <p>
            You can manage location and Health permissions through iOS, edit or remove local weight settings, and choose
            whether to include a map when sharing. Use the account deletion control in the native app&apos;s Profile
            settings to delete your account through the backend. Clearing browser storage or resetting local data removes
            the local copy, not server-side account information. Information already shared with another person or
            service is not removed by deleting your RunSmart account. Contact support for help with access or deletion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Contact us</h2>
          <p>
            Questions about this policy or your information: <a href="mailto:support@runsmart-ai.com" className="underline">support@runsmart-ai.com</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
