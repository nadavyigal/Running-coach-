import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Check, ChevronRight, HelpCircle, Trophy, Users, Zap } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BetaSignupForm } from './beta-signup-form'

export const metadata: Metadata = {
   title: 'Join the Run-Smart Beta | AI Running Coach Early Access',
   description:
      'Get early access to Run-Smart AI running coach. Lifetime 50% discount, exclusive badge, direct founder access. Limited to 500 beta testers. Sign up now.',
   alternates: {
      canonical: '/beta-signup',
   },
   openGraph: {
      title: 'Join the Run-Smart Beta - AI Running Coach',
      description:
         'Be among the first 500 runners to experience adaptive AI coaching. Lifetime discounts + exclusive perks.',
      url: '/beta-signup',
      type: 'website',
      images: [
         {
            url: '/placeholder.jpg',
            width: 1200,
            height: 630,
            alt: 'Join the Run-Smart Beta',
         },
      ],
   },
   twitter: {
      title: 'Join the Run-Smart Beta',
      description: 'Early access to Run-Smart AI running coach. Lifetime 50% discount, exclusive badge, direct founder access.',
      images: ['/placeholder.jpg'],
      card: 'summary_large_image',
   },
}

export default function BetaSignupPage() {
   return (
      <div className="space-y-20 pb-16">
         {/* Hero Section */}
         <section className="pt-8 md:pt-12 lg:pt-24 space-y-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
               <div className="space-y-6">
                  <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
                     Be Among the First to Experience <span className="text-primary">AI-Powered</span> Running Coaching
                  </h1>
                  <p className="text-pretty text-lg md:text-xl text-muted-foreground">
                     Get exclusive early access, lifetime discounts, and help shape the future of Run-Smart.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                     <a href="#signup-form" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8">
                        Join the Waitlist <ChevronRight className="ml-2 h-4 w-4" />
                     </a>
                  </div>
               </div>
               {/* Hero Image */}
               <div className="flex justify-center lg:justify-end">
                  <Card className="overflow-hidden border-4 border-muted shadow-2xl rotate-1 lg:rotate-2 max-w-[280px] md:max-w-[320px] rounded-3xl bg-black">
                     <div className="relative aspect-[9/19] bg-muted">
                        <Image
                           src="/beta-app-preview.jpg"
                           alt="Run-Smart App Interface"
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
                  <span>Only 500 beta spots available</span>
               </div>
               <div className="space-y-2 max-w-md mx-auto">
                  <Progress value={40} className="h-3" />
                  <p className="text-xs text-center text-muted-foreground">200/500 spots filled</p>
               </div>
               <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  We&apos;re limiting beta to 500 users for quality feedback. Sign up now to secure your spot.
               </p>
            </div>
         </section>

         {/* Beta Benefits Section */}
         <section className="space-y-12">
            <div className="text-center space-y-4">
               <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why Join the Beta?</h2>
               <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Early supporters get the VIP treatment. These perks are exclusive to beta testers.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
               <Card className="h-full border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Trophy className="h-6 w-6" />
                        </div>
                        <CardTitle>Lifetime 50% Discount</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">Lock in $4.99/month forever (vs $9.99)</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Early supporters get the best deal, period. This price is yours for life as long as you keep your subscription.
                  </CardContent>
               </Card>

               <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Badge variant="outline" className="px-2 py-1 text-sm bg-background">PIONEER</Badge>
                        </div>
                        <CardTitle>Exclusive Pioneer Badge</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">Show you were here first</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Earn a special achievement badge on your profile. Show off your early adopter status in the community.
                  </CardContent>
               </Card>

               <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Users className="h-6 w-6" />
                        </div>
                        <CardTitle>Direct Founder Access</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">Private Discord channel</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Your feedback shapes product decisions. No customer support runaround—just real conversations with the team.
                  </CardContent>
               </Card>

               <Card className="h-full shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader>
                     <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                           <Check className="h-6 w-6" />
                        </div>
                        <CardTitle>Feature Voting Rights</CardTitle>
                     </div>
                     <CardDescription className="text-base font-medium">Help decide what we build next</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground">
                     Beta testers get priority say in the roadmap. Vote on upcoming features and integrations.
                  </CardContent>
               </Card>
            </div>
         </section>

         {/* Social Proof Section */}
         <section className="space-y-8 text-center pb-8 border-b">
            <div className="inline-flex items-center justify-center p-1 rounded-full bg-muted px-4 py-1.5">
               <Users className="w-4 h-4 mr-2 text-muted-foreground" />
               <span className="text-sm font-medium">Join the Community</span>
            </div>
            <h2 className="text-2xl font-bold">200+ runners already on the waitlist</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-4">
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">15</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Countries</span>
               </div>
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">60%</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Beginners</span>
               </div>
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">30%</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Intermediate</span>
               </div>
               <div className="flex flex-col items-center p-4 bg-card rounded-lg border shadow-sm">
                  <span className="text-2xl font-bold">10%</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Advanced</span>
               </div>
            </div>
         </section>


         {/* Requirements Section */}
         <section className="grid md:grid-cols-2 gap-12 items-start max-w-5xl mx-auto">
            <div className="space-y-6">
               <h2 className="text-3xl font-bold tracking-tight">What We&apos;re Looking For</h2>
               <div className="space-y-4">
                  <div>
                     <h3 className="font-semibold text-lg flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> All fitness levels welcome</h3>
                     <p className="text-muted-foreground pl-6">From couch-to-5k beginners to marathoners. No minimum pace or distance required. Ages 18+.</p>
                  </div>
                  <div>
                     <h3 className="font-semibold text-lg flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Commitment needed</h3>
                     <ul className="list-disc pl-10 text-muted-foreground space-y-1 mt-1">
                        <li>Complete 5-minute onboarding</li>
                        <li>Record at least 3 runs</li>
                        <li>Provide feedback via short survey</li>
                     </ul>
                  </div>
               </div>
            </div>

            <div className="bg-muted/30 p-8 rounded-2xl space-y-6 border">
               <h3 className="font-bold text-xl">What you get in return</h3>
               <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span><span className="font-medium">Free access</span> to all features during beta</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span><span className="font-medium">Lifetime 50% off</span> Premium ($4.99/mo)</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span>Exclusive Beta Pioneer badge</span>
                  </li>
                  <li className="flex items-start gap-3">
                     <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                     <span>Your name in the credits (optional)</span>
                  </li>
               </ul>
            </div>
         </section>

         {/* What to Expect Section */}
         <section className="space-y-8">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-center">What Happens After You Sign Up</h2>
            <div className="relative border-l-2 border-muted md:border-l-0 md:border-t-2 ml-4 md:ml-0 md:mt-12 md:grid md:grid-cols-5 md:gap-4 md:pt-8">

               {[
                  { step: 1, title: "You're on the list", body: 'Instant confirmation email with your waitlist position.' },
                  { step: 2, title: 'Beta invites roll out', body: 'We invite runners in waves of 50. First come, first served.' },
                  { step: 3, title: 'Get your invite', body: 'Receive an email with your exclusive access link.' },
                  { step: 4, title: 'Start running', body: 'Complete onboarding and record your first 3 runs.' },
                  { step: 5, title: 'Lock in benefits', body: 'Permanently unlock the 50% discount and Pioneer badge.' },
               ].map((item, index) => (
                  <div key={item.step} className="relative pl-8 pb-8 md:pl-0 md:pb-0 md:text-center group">
                     <div className="absolute -left-[9px] top-0 bg-background border-2 border-muted rounded-full w-4 h-4 md:-top-[41px] md:left-1/2 md:-translate-x-1/2 group-hover:border-primary transition-colors"></div>

                     <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                     <p className="text-sm text-muted-foreground">{item.body}</p>
                  </div>
               ))}

            </div>
         </section>

         {/* Signup Form Section */}
         <section id="signup-form" className="max-w-xl mx-auto w-full scroll-mt-24 space-y-8 pt-8">
            <div className="text-center space-y-2">
               <h2 className="text-3xl font-bold tracking-tight">Sign Up for Early Access</h2>
               <p className="text-muted-foreground">Join the waitlist and secure your lifetime discount.</p>
            </div>
            <BetaSignupForm />
         </section>

         {/* FAQ Section */}
         <section className="max-w-3xl mx-auto w-full space-y-8 pt-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-center">Questions?</h2>
            <Accordion type="single" collapsible className="w-full">
               <AccordionItem value="start">
                  <AccordionTrigger>When does the beta start?</AccordionTrigger>
                  <AccordionContent>
                     We&apos;re rolling out invites in waves starting soon. The first 500 signups get priority access.
                  </AccordionContent>
               </AccordionItem>
               <AccordionItem value="cost">
                  <AccordionTrigger>Do I need to pay during beta?</AccordionTrigger>
                  <AccordionContent>
                     Nope! All features are free during the beta period (approx 8-12 weeks). When we launch officially, you&apos;ll have the option to subscribe at 50% off for life.
                  </AccordionContent>
               </AccordionItem>
               <AccordionItem value="time">
                  <AccordionTrigger>What if I don&apos;t have time to test everything?</AccordionTrigger>
                  <AccordionContent>
                     That&apos;s okay! As long as you complete onboarding and record 3 runs, you&apos;ll qualify for all beta perks. We value quality feedback over quantity.
                  </AccordionContent>
               </AccordionItem>
               <AccordionItem value="platforms">
                  <AccordionTrigger>What devices are supported?</AccordionTrigger>
                  <AccordionContent>
                     Run-Smart is a Progressive Web App (PWA) that works on both iOS and Android. You can install it directly from your browser without going through an app store.
                  </AccordionContent>
               </AccordionItem>
            </Accordion>
         </section>

      </div>
   )
}
