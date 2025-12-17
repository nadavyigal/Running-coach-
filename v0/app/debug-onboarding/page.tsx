import type { Metadata } from 'next'

import DebugOnboardingPage from './page-client'

export const metadata: Metadata = {
  title: 'Onboarding Debug',
  description: 'Inspect and troubleshoot RunSmart onboarding state.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/debug-onboarding',
  },
}

export default function Page() {
  return <DebugOnboardingPage />
}

