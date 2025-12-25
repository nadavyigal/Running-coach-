import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ShareWaitlist } from './share-waitlist'

export const metadata: Metadata = {
  title: "You're on the waitlist",
  description: 'Thanks for joining the Run-Smart beta waitlist. Share to skip the line.',
  alternates: {
    canonical: '/landing/beta-signup/thanks',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function BetaThanksPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re on the waitlist</CardTitle>
          <CardDescription>
            Thanks for joining! We&apos;re inviting runners in small waves over the next 1–2 weeks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Share to skip the line (optional)</div>
            <p className="text-sm text-muted-foreground">
              Referral mechanics are coming soon—start by sharing the link with a runner friend.
            </p>
          </div>

          <ShareWaitlist />

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/landing">Back to home</Link>
            </Button>
            <Button asChild>
              <Link href="/landing/beta-signup">Invite another runner</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

