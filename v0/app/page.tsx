import type { Metadata } from 'next'

import RunSmartApp from './page-client'

export const metadata: Metadata = {
  description:
    'RunSmart is an AI running coach that builds personalized training plans, tracks workouts, and helps you stay consistent.',
  alternates: {
    canonical: '/',
  },
}

export default function Page() {
  return <RunSmartApp />
}

