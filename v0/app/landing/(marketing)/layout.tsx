import type { Metadata } from 'next'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.runsmart-ai.com')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Run-Smart - AI Running Coach',
    template: '%s | Run-Smart',
  },
  description:
    'Build a lasting running habit with adaptive training plans, recovery-focused coaching, and real AI that actually listens.',
  openGraph: {
    type: 'website',
    siteName: 'Run-Smart',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
  },
}

const navLinks = [
  { href: '/landing', label: 'Home' },
  { href: '/landing/pricing', label: 'Pricing' },
  { href: '/landing/blog', label: 'Blog' },
] as const

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/landing" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              RS
            </span>
            <span>Run-Smart</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Button asChild>
              <Link href="/landing/beta-signup">Join Beta</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Button asChild size="sm">
              <Link href="/landing/beta-signup">Join Beta</Link>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[380px]">
                <SheetTitle className="text-left">Run-Smart</SheetTitle>
                <Separator className="my-4" />
                <div className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <Button key={link.href} variant="ghost" className="justify-start" asChild>
                      <Link href={link.href}>{link.label}</Link>
                    </Button>
                  ))}
                </div>
                <Separator className="my-4" />
                <Button asChild className="w-full">
                  <Link href="/landing/beta-signup">Join Beta</Link>
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        {children}
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <div className="grid gap-10 md:grid-cols-3">
            <div className="space-y-3">
              <div className="text-sm font-semibold">Run-Smart</div>
              <p className="text-sm text-muted-foreground">
                Build habits that stick with an AI running coach that adapts to your life.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Quick Links</div>
              <div className="grid gap-2 text-sm">
                <Link className="text-muted-foreground hover:text-foreground" href="/landing">
                  Home
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/landing/pricing">
                  Pricing
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/landing/blog">
                  Blog
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/landing/beta-signup">
                  Join the Beta
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/landing/privacy">
                  Privacy
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/landing/terms">
                  Terms
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Contact</div>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <div>Instagram: @runsmart.ai</div>
                <div>Twitter/X: @runsmartcoach</div>
                <div>
                  Email:{' '}
                  <a className="underline" href="mailto:firstname.lastname@runsmart-ai.com">
                    firstname.lastname@runsmart-ai.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-8" />
          <div className="flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
            <div>(c) {new Date().getFullYear()} Run-Smart. All rights reserved.</div>
            <div>Run-Smart - Build habits that stick.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
