import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Run-Smart pricing details.',
  alternates: { canonical: '/pricing' },
  robots: { index: false, follow: false },
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Coming soon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>We&apos;re finalizing the free vs premium tiers for the beta launch.</p>
          <Button asChild>
            <Link href="/landing/beta-signup">Join the Beta</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

