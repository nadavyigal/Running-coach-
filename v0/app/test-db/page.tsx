import type { Metadata } from 'next'

import DatabaseTest from './page-client'

export const metadata: Metadata = {
  title: 'Database Test',
  description: 'Internal database operations test page for RunSmart.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: '/test-db',
  },
}

export default function Page() {
  return <DatabaseTest />
}

