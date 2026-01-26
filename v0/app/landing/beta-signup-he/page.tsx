import type { Metadata } from 'next'
import Image from 'next/image'
import { Check, ChevronLeft, Trophy, Users, Zap } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BetaSignupFormHe } from './beta-signup-form-he'

export const metadata: Metadata = {
   title: 'הצטרפו לבטא של Run-Smart | מאמן ריצה חכם עם AI',
   description:
      'קבלו גישה מוקדמת ל-Run-Smart - מאמן ריצה עם בינה מלאכותית. הנחה של 50% לכל החיים, תג בלעדי, גישה ישירה למייסדים. מוגבל ל-500 בודקי בטא. הירשמו עכשיו.',
   alternates: {
      canonical: '/landing/beta-signup-he',
   },
   openGraph: {
      title: 'הצטרפו לבטא של Run-Smart - מאמן ריצה עם AI',
      description:
         'היו בין 500 הרצים הראשונים לחוות אימון מותאם אישית עם AI. הנחות לכל החיים + הטבות בלעדיות.',
      url: '/landing/beta-signup-he',
      type: 'website',
      images: [
         {
            url: '/beta-app-preview.jpg',
            width: 1200,
            height: 630,
            alt: 'הצטרפו לבטא של Run-Smart',
         },
      ],
   },
   twitter: {
      title: 'הצטרפו לבטא של Run-Smart',
      description: 'גישה מוקדמת למאמן ריצה עם AI. הנחה של 50% לכל החיים, תג בלעדי, גישה ישירה למייסדים.',
      images: ['/beta-app-preview.jpg'],
      card: 'summary_large_image',
   },
}

export default function BetaSignupPageHe() {
   return (
      <div className="space-y-20 pb-16" dir="rtl">
         {/* Hero Section */}
         <section className="pt-8 md:pt-12 lg:pt-24 space-y-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
               <div className="space-y-6">
                  <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                     היו בין הראשונים לחוות <span className="text-primary">אימון ריצה</span> עם בינה מלאכותית
                  </h1>
                  <p className="text-pretty text-lg md:text-xl text-muted-foreground">
                     קבלו גישה מוקדמת בלעדית, הנחות לכל החיים, ועזרו לעצב את העתיד של Run-Smart.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                     <a href="#signup-form" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                        <ChevronLeft className="me-2 h-4 w-4" />
                        הצטרפו לרשימת ההמתנה
                     </a>
                  </div>
               </div>
               {/* Hero Image */}
               <div className="flex justify-center lg:justify-start">
                  <Card className="overflow-hidden border-4 border-muted shadow-2xl -rotate-1 lg:-rotate-2 max-w-[280px] md:max-w-[320px] rounded-3xl bg-black">
                     <div className="relative aspect-[9/19] bg-muted">
                        <Image
                           src="/beta-app-preview.jpg"
                           alt="ממשק אפליקציית Run-Smart"
                           fill
                           className="object-cover"
                           priority
                        />
                     </div>
                  </Card>
               </div>
            </div>
         </section>

         {/* Urgency Section */}
         <section className="bg-muted/50 rounded-xl p-8 border md:mx-auto max-w-4xl">
            <div className="space-y-4 text-center">
               <div className="flex items-center justify-center gap-2 text-amber-600 font-semibold text-lg">
                  <Zap className="h-5 w-5 fill-current" />
                  <span>רק 500 מקומות בבטא</span>
               </div>
               <div className="space-y-2 max-w-md mx-auto">
                  <Progress value={40} className="h-3" />
                  <p className="text-xs text-center text-muted-foreground">200/500 מקומות תפוסים</p>
               </div>
               <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  אנחנו מגבילים את הבטא ל-500 משתמשים כדי לקבל משוב איכותי. הירשמו עכשיו כדי להבטיח את המקום שלכם.
               </p>
            </div>
         </section>

         {/* Beta Benefits Section */}
         <section className="space-y-12">
            <div className="text-center space-y-4">
               <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">למה להצטרף לבטא?</h2>
               <p className="text-lg text-muted-foreground max-w-2xl mx-auto">תומכים מוקדמים מקבלים יחס VIP. ההטבות האלה בלעדיות לבודקי הבטא.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
               <Card className="h-full border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Trophy className="h-6 w-6" />
                        </div>
                        <CardTitle>הנחה של 50% לכל החיים</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">נעילת מחיר של $4.99/חודש לתמיד (במקום $9.99)</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     תומכים מוקדמים מקבלים את העסקה הטובה ביותר. המחיר הזה שלכם לכל החיים כל עוד אתם שומרים על המנוי.
                  </CardContent>
               </Card>

               <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Badge variant="outline" className="px-2 py-1 text-sm bg-background">PIONEER</Badge>
                        </div>
                        <CardTitle>תג חלוץ בלעדי</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">הראו שהייתם כאן ראשונים</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     קבלו תג הישג מיוחד בפרופיל שלכם. הראו את הסטטוס שלכם כאימוץ מוקדם בקהילה.
                  </CardContent>
               </Card>

               <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Users className="h-6 w-6" />
                        </div>
                        <CardTitle>גישה ישירה למייסדים</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">ערוץ דיסקורד פרטי</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     המשוב שלכם משפיע על החלטות המוצר. בלי בירוקרטיה של תמיכה - רק שיחות אמיתיות עם הצוות.
                  </CardContent>
               </Card>

               <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Check className="h-6 w-6" />
                        </div>
                        <CardTitle>זכויות הצבעה על פיצ&apos;רים</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">עזרו להחליט מה נבנה הבא</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     לבודקי הבטא יש עדיפות ב-roadmap. הצביעו על פיצ&apos;רים ואינטגרציות עתידיות.
                  </CardContent>
               </Card>
            </div>
         </section>

         {/* Social Proof Section */}
         <section className="space-y-8 text-center pb-8 border-b">
            <div className="inline-flex items-center justify-center p-1 rounded-full bg-muted px-4 py-1.5">
               <Users className="w-4 h-4 ms-2 text-muted-foreground" />
               <span className="text-sm font-medium">הצטרפו לקהילה</span>
            </div>
            <h2 className="text-2xl font-bold">יותר מ-200 רצים כבר ברשימת ההמתנה</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-4">
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">15</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">מדינות</span>
               </div>
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">60%</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">מתחילים</span>
               </div>
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">30%</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">בינוניים</span>
               </div>
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">10%</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">מתקדמים</span>
               </div>
            </div>
         </section>


         {/* Requirements Section */}
         <section className="grid md:grid-cols-2 gap-12 items-start max-w-5xl mx-auto">
            <div className="space-y-6">
               <h2 className="text-3xl font-bold tracking-tight">מה אנחנו מחפשים</h2>
               <div className="space-y-4">
                  <div>
                     <h3 className="font-semibold text-lg flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> כל רמות הכושר מוזמנות</h3>
                     <p className="text-muted-foreground pe-6">ממתחילים עד מרתוניסטים. אין דרישת קצב או מרחק מינימלי. גילאי 18+.</p>
                  </div>
                  <div>
                     <h3 className="font-semibold text-lg flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> נדרשת מחויבות</h3>
                     <ul className="list-disc pe-10 text-muted-foreground space-y-1 mt-1">
                        <li>השלמת onboarding של 5 דקות</li>
                        <li>תיעוד לפחות 3 ריצות</li>
                        <li>מתן משוב דרך סקר קצר</li>
                     </ul>
                  </div>
               </div>
            </div>

            <div className="bg-muted/30 p-8 rounded-2xl space-y-6 border">
               <h3 className="font-bold text-xl">מה מקבלים בתמורה</h3>
               <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span><span className="font-medium">גישה חינמית</span> לכל הפיצ&apos;רים במהלך הבטא</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span><span className="font-medium">50% הנחה לכל החיים</span> על Premium ($4.99/חודש)</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span>תג Beta Pioneer בלעדי</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span>השם שלכם בקרדיטים (אופציונלי)</span>
                  </li>
               </ul>
            </div>
         </section>

         {/* What to Expect Section */}
         <section className="space-y-8">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-center">מה קורה אחרי שנרשמים</h2>
            <div className="relative border-r-2 border-muted md:border-r-0 md:border-t-2 me-4 md:me-0 md:mt-12 md:grid md:grid-cols-5 md:gap-4 md:pt-8">

               {[
                  { step: 1, title: 'אתם ברשימה', body: 'אימייל אישור מיידי לאישור המקום שלכם.' },
                  { step: 2, title: 'הזמנות יוצאות', body: 'אנחנו מזמינים רצים בגלים של 50. מי שנרשם קודם, מקבל קודם.' },
                  { step: 3, title: 'מקבלים הזמנה', body: 'מקבלים אימייל עם קישור הגישה הבלעדי שלכם.' },
                  { step: 4, title: 'מתחילים לרוץ', body: 'משלימים onboarding ומתעדים את 3 הריצות הראשונות.' },
                  { step: 5, title: 'נועלים הטבות', body: 'פותחים לצמיתות את ההנחה של 50% ותג ה-Pioneer.' },
               ].map((item) => (
                  <div key={item.step} className="relative pe-8 pb-8 md:pe-0 md:pb-0 md:text-center group">
                     <div className="absolute -right-[9px] top-0 bg-background border-2 border-muted rounded-full w-4 h-4 md:-top-[41px] md:right-1/2 md:translate-x-1/2 group-hover:border-primary transition-colors"></div>

                     <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                     <p className="text-sm text-muted-foreground">{item.body}</p>
                  </div>
               ))}

            </div>
         </section>

         {/* Signup Form Section */}
         <section id="signup-form" className="max-w-xl mx-auto w-full scroll-mt-24 space-y-8 pt-8">
            <div className="text-center space-y-2">
               <h2 className="text-3xl font-bold tracking-tight">הירשמו לגישה מוקדמת</h2>
               <p className="text-muted-foreground">הצטרפו לרשימת ההמתנה והבטיחו את ההנחה לכל החיים.</p>
            </div>
            <BetaSignupFormHe />
         </section>

         {/* FAQ Section */}
         <section className="max-w-3xl mx-auto w-full space-y-8 pt-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-center">שאלות נפוצות</h2>
            <Accordion type="single" collapsible className="w-full">
               <AccordionItem value="start">
                  <AccordionTrigger>מתי הבטא מתחילה?</AccordionTrigger>
                  <AccordionContent>
                     אנחנו שולחים הזמנות בגלים בקרוב. 500 הנרשמים הראשונים מקבלים גישה עדיפה.
                  </AccordionContent>
               </AccordionItem>
               <AccordionItem value="cost">
                  <AccordionTrigger>צריך לשלם במהלך הבטא?</AccordionTrigger>
                  <AccordionContent>
                     לא! כל הפיצ&apos;רים חינמיים במהלך תקופת הבטא (כ-8-12 שבועות). כשנשיק רשמית, תהיה לכם אפשרות להירשם ב-50% הנחה לכל החיים.
                  </AccordionContent>
               </AccordionItem>
               <AccordionItem value="time">
                  <AccordionTrigger>מה אם אין לי זמן לבדוק הכל?</AccordionTrigger>
                  <AccordionContent>
                     זה בסדר! כל עוד אתם משלימים onboarding ומתעדים 3 ריצות, אתם זכאים לכל הטבות הבטא. אנחנו מעריכים משוב איכותי על פני כמות.
                  </AccordionContent>
               </AccordionItem>
               <AccordionItem value="platforms">
                  <AccordionTrigger>אילו מכשירים נתמכים?</AccordionTrigger>
                  <AccordionContent>
                     Run-Smart היא Progressive Web App (PWA) שעובדת גם באייפון וגם באנדרואיד. אפשר להתקין אותה ישירות מהדפדפן בלי לעבור דרך חנות אפליקציות.
                  </AccordionContent>
               </AccordionItem>
            </Accordion>
         </section>

      </div>
   )
}
