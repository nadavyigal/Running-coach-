import type { Metadata } from 'next'

import DebugPage from './page-client'

export const metadata: Metadata = {
  title: 'Debug',
  description: 'Developer tools for debugging RunSmart in development.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/debug',
  },
}

export default function Page() {
  return <DebugPage />
}

