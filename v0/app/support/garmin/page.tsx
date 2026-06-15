export const metadata = { title: 'Garmin Connect Help — RunSmart' }

export default function GarminSupportPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <h1 className="text-3xl font-bold">Garmin Connect Help</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How to connect</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li>Go to <strong>Profile → Devices</strong>.</li>
          <li>Tap <strong>Connect Garmin Connect</strong>.</li>
          <li>Sign in to your Garmin account and tap <strong>Agree</strong>.</li>
          <li>You&apos;ll return to RunSmart automatically. Recent runs and wellness data sync within a few minutes.</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">My data isn&apos;t syncing</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li><strong>Check Garmin Connect first.</strong> Open the Garmin Connect app and confirm the activity appears there. RunSmart can sync only after Garmin Connect has received the data from your device.</li>
          <li><strong>Wait a few minutes.</strong> Garmin pushes data to RunSmart after activities complete. The first sync after connecting may take 5–10 minutes.</li>
          <li><strong>Tap Sync now.</strong> In Profile → Devices, tap the Garmin card and tap <strong>Sync Garmin</strong> to trigger a manual pull.</li>
          <li><strong>Reconnect.</strong> If sync still fails, disconnect and reconnect. This refreshes your authorization.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Why some data may be missing</h2>
        <p className="text-gray-700">Not all metrics are available for every user. Whether a metric appears depends on:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>Your Garmin device model — not all devices measure HRV, Pulse Ox, or Body Battery</li>
          <li>Whether you wore the device overnight — required for sleep and HRV data</li>
          <li>Whether the data has synced from your device to the Garmin Connect app</li>
          <li>Which permissions you approved when connecting RunSmart</li>
          <li>Which data types Garmin has enabled for RunSmart in your region</li>
        </ul>
        <p className="text-gray-500 text-sm mt-2">If a metric your device supports is still missing after 24 hours, try disconnecting and reconnecting Garmin to re-request permissions.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">What data RunSmart imports</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li><strong>Activities:</strong> completed runs including GPS route, pace, heart rate, elevation, cadence, and running dynamics (device-dependent)</li>
          <li><strong>Recovery signals:</strong> HRV, resting heart rate, sleep quality and duration, daily stress, and Body Battery — when available from your device and permissions</li>
          <li><strong>Training:</strong> VO2 max estimates and daily step count</li>
        </ul>
        <p className="text-gray-500 text-sm mt-2">Data is imported only after you authorize access. You can disconnect at any time.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How to disconnect</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li>Go to <strong>Profile → Devices</strong>.</li>
          <li>Tap the Garmin card and tap <strong>Disconnect</strong>.</li>
          <li>RunSmart revokes its authorization and stops all future imports. Previously imported runs remain in your history.</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Delete my Garmin data</h2>
        <p className="text-gray-700">
          Email{' '}
          <a href="mailto:hello@runsmart.ai" className="text-blue-600 underline">hello@runsmart.ai</a>{' '}
          with subject <strong>&quot;Delete my Garmin data&quot;</strong>. We process requests within 30 days.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Still need help?</h2>
        <p className="text-gray-700">
          Email <a href="mailto:hello@runsmart.ai" className="text-blue-600 underline">hello@runsmart.ai</a> with your Garmin device model and what you see in the app. We typically reply within 24 hours.
        </p>
      </section>
    </main>
  )
}
