import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { HeartPulse, Sparkles, Trophy, WifiOff } from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Run-Smart: המאמן האישי שלך לריצה | תוכניות אימון מותאמות אישית',
  description:
    'בנה הרגל ריצה יציב עם תוכניות אימון מונעות בינה מלאכותית שמתאימות את עצמן לחיים שלך. אימון ממוקד התאוששות, אתגר 21 יום, עובד גם אופליין. התחל בחינם.',
  alternates: {
    canonical: '/landing/overview-he',
  },
  openGraph: {
    title: 'המאמן האישי שלך לריצה שמתאים את עצמו לחיים שלך',
    description:
      'בנה הרגלי ריצה יציבים עם אימון AI מותאם ותוכניות אימון ממוקדות התאוששות.',
    url: '/landing/overview-he',
    type: 'website',
    locale: 'he_IL',
    images: [
      {
        url: '/beta-app-preview.jpg',
        width: 1200,
        height: 630,
        alt: 'תצוגה מקדימה של אפליקציית Run-Smart',
      },
    ],
  },
  twitter: {
    title: 'Run-Smart - מאמן ריצה AI',
    description: 'תוכניות אימון מותאמות שמשתנות עם החיים שלך. התחל את מסע הריצה שלך היום.',
    images: ['/beta-app-preview.jpg'],
    card: 'summary_large_image',
  },
}

export default function MarketingHomePageHebrew() {
  return (
    <div className="space-y-20" dir="rtl">
      <section className="pt-2 md:pt-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                המאמן האישי שלך לריצה שמתאים את עצמו לחיים שלך
              </h1>
              <p className="text-pretty text-lg text-muted-foreground">
                בנה הרגל ריצה יציב עם תוכניות אימון מותאמות, אימון ממוקד התאוששות,
                ובינה מלאכותית אמיתית שבאמת מקשיבה.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/landing/beta-signup-he">הצטרף לבטא</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#demo">איך זה עובד</Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              התקן כאפליקציה שעובדת אופליין. הנתונים שלך נשמרים מקומית כברירת מחדל.
            </p>
          </div>

          <Card className="overflow-hidden">
            <div className="relative aspect-video bg-muted">
              <Image
                src="/beta-app-preview.jpg"
                alt="תצוגה מקדימה של אפליקציית Run-Smart"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
              <div className="absolute bottom-4 right-4 left-4 space-y-1">
                <div className="text-sm font-medium">תצוגה מקדימה של המוצר</div>
                <div className="text-xs text-muted-foreground">
                  הצצה לחוויית הבטא של Run-Smart.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section aria-label="הוכחה חברתית" className="flex justify-center">
        <Badge variant="secondary" className="px-4 py-1.5 text-sm">
          הצטרפו לקהילה הגדלה של רצים שבונים את ההרגל שלהם
        </Badge>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">הכירו את Run-Smart</h2>
          <p className="text-muted-foreground">
            אימון מותאם, אימון שמתמקד בהתאוששות, ואמינות אופליין כדי שתוכל להמשיך להופיע -
            בלי ספירלת האשמה.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">אימון AI</CardTitle>
              </div>
              <CardDescription>תוכניות שמתאימות את עצמן לחיים שלך, לא להפך.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              פספסת ריצה או שינית את לוח הזמנים? התוכנית מתאימה את עצמה - בלי אשמה, רק התאמות.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">תובנות התאוששות</CardTitle>
              </div>
              <CardDescription>דע מתי לדחוף ומתי לנוח.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              הנחיות ממוקדות התאוששות עוזרות לך לבנות עקביות ולהפחית סיכון לפציעות לאורך זמן.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">אתגר 21 יום</CardTitle>
              </div>
              <CardDescription>בנה הרגל שבאמת נדבק.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              אתגר גמיש מבוסס מדע שמתוכנן לעקביות על פני שלמות.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">עובד אופליין</CardTitle>
              </div>
              <CardDescription>אין חיבור? אין בעיה.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              התקן כמו אפליקציה והמשך גם עם קליטה חלשה - פרטיות ראשונה ומקומי ראשון.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            מהספה לרץ עקבי ב-3 צעדים פשוטים
          </h2>
          <p className="text-muted-foreground">
            ענה על כמה שאלות, קבל תוכנית, ואז תן לה להתפתח עם ההתקדמות שלך.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'ספר לנו על עצמך',
              body: 'ענה על כמה שאלות מהירות על ניסיון הריצה שלך, המטרות ולוח הזמנים. לוקח 2 דקות.',
            },
            {
              title: 'קבל את התוכנית המותאמת שלך',
              body: 'ה-AI שלנו יוצר תוכנית אימון מותאמת אישית ל-14-21 יום המתאימה לרמת הכושר שלך והמחויבויות בחיים.',
            },
            {
              title: 'רוץ והסתגל',
              body: 'הקלט את הריצות שלך, שוחח עם המאמן ה-AI שלך, וצפה בתוכנית שלך מתפתחת כשהחיים קורים.',
            },
          ].map((step, index) => (
            <Card key={step.title} className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="demo" className="scroll-mt-24 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">ראה את Run-Smart בפעולה</h2>
          <p className="text-muted-foreground">
            הדרכה מהירה של תהליך ההרשמה, מסך היום, ואימון AI.
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="relative aspect-video bg-muted">
            <Image src="/beta-app-preview.jpg" alt="תצוגה מקדימה של הדמו של Run-Smart" fill sizes="100vw" className="object-cover" />
          </div>
        </Card>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">שאלות נפוצות</h2>
          <p className="text-muted-foreground">
            התנגדויות נפוצות, מטופלות מראש - כדי שתוכל להרגיש בטוח להצטרף.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="beginner">
            <AccordionTrigger>האם אני צריך להיות רץ כבר?</AccordionTrigger>
            <AccordionContent>
              לא. אתגר 21 היום שלנו מושלם למתחילים לגמרי. התחל עם אינטרוולים של הליכה-ריצה
              והתקדם משם.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="different">
            <AccordionTrigger>מה מבדיל את זה מאפליקציות ריצה אחרות?</AccordionTrigger>
            <AccordionContent>
              התאמת AI אמיתית. התוכנית שלך מתאימה את עצמה על בסיס ההתקדמות שלך ומגבלות החיים האמיתיים,
              עם גישה שמתמקדת בהתאוששות כדי לעזור למנוע שחיקה.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="offline">
            <AccordionTrigger>האם זה עובד אופליין?</AccordionTrigger>
            <AccordionContent>
              כן. כאפליקציית PWA, Run-Smart עובד לגמרי אופליין לאחר ההתקנה - מושלם
              לריצות באזורים עם קליטה חלשה.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="privacy">
            <AccordionTrigger>האם הנתונים שלי פרטיים?</AccordionTrigger>
            <AccordionContent>
              בהחלט. כל הנתונים נשמרים מקומית במכשיר שלך קודם. אתה שולט מה משותף,
              מיוצא, או נמחק.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="equipment">
            <AccordionTrigger>האם אני צריך ציוד מיוחד?</AccordionTrigger>
            <AccordionContent>
              רק נעלי ריצה והטלפון שלך. מעקב GPS ואינטגרציות עם מכשירים לבישים הם אופציונליים.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cancel">
            <AccordionTrigger>האם אני יכול לבטל בכל עת?</AccordionTrigger>
            <AccordionContent>
              כן. ללא חוזים, ללא התחייבויות. בטל את מנוי הפרימיום שלך בכל עת.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="missed">
            <AccordionTrigger>מה אם אני מפספס אימונים?</AccordionTrigger>
            <AccordionContent>
              החיים קורים - זו כל הנקודה. המאמן ה-AI שלך מתאים את התוכנית כשאתה מפספס.
              בלי אשמה, רק התאמה.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Language switcher */}
      <section className="flex justify-center pb-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/landing/overview">🌐 English Version</Link>
        </Button>
      </section>
    </div>
  )
}
