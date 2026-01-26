import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ShareWaitlistHe } from './share-waitlist-he'

export const metadata: Metadata = {
  title: 'אתם ברשימת ההמתנה',
  description: 'תודה שהצטרפתם לרשימת ההמתנה של Run-Smart. שתפו כדי לקפוץ בתור.',
  alternates: {
    canonical: '/landing/beta-signup-he/thanks',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function BetaThanksPageHe() {
  return (
    <div className="mx-auto max-w-2xl space-y-8" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>אתם ברשימת ההמתנה!</CardTitle>
          <CardDescription>
            תודה שהצטרפתם! אנחנו מזמינים רצים בגלים קטנים במהלך השבוע-שבועיים הקרובים.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">שתפו כדי לקפוץ בתור (אופציונלי)</div>
            <p className="text-sm text-muted-foreground">
              מכניקת הפניות בקרוב - בינתיים, שתפו את הקישור עם חבר/ה שרץ/ה.
            </p>
          </div>

          <ShareWaitlistHe />

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/landing">חזרה לדף הבית</Link>
            </Button>
            <Button asChild>
              <Link href="/landing/beta-signup-he">הזמינו רץ/ה נוסף/ת</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
