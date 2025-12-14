import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ReminderInit } from '@/components/reminder-init'
import { PostHogProvider } from '@/lib/posthog-provider'
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary'
import { InitialLoadingSkeleton } from '@/components/initial-loading-skeleton'
import { ServiceWorkerRegister } from '@/components/service-worker-register'

// Optimized font loading with next/font
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Use font-display: swap for better performance
  preload: true,
  variable: '--font-inter',
})

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

const metadataBase = new URL(siteUrl)

const defaultTitle = 'RunSmart - Your AI Running Coach'
const defaultDescription =
  'RunSmart is an AI running coach that builds personalized training plans, tracks workouts, and helps you stay consistent.'

const schemaOrgJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${metadataBase.origin}/#organization`,
      name: 'RunSmart',
      url: metadataBase.origin,
      logo: {
        '@type': 'ImageObject',
        url: new URL('/icon-512x512.png', metadataBase).toString(),
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${metadataBase.origin}/#website`,
      url: metadataBase.origin,
      name: 'RunSmart',
      description: defaultDescription,
      publisher: {
        '@id': `${metadataBase.origin}/#organization`,
      },
      inLanguage: 'en',
    },
    {
      '@type': 'WebApplication',
      '@id': `${metadataBase.origin}/#app`,
      name: 'RunSmart',
      url: metadataBase.origin,
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web',
      description: defaultDescription,
      image: new URL('/icon-512x512.png', metadataBase).toString(),
      inLanguage: 'en',
    },
  ],
}

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: defaultTitle,
    template: '%s | RunSmart',
  },
  description: defaultDescription,
  applicationName: 'RunSmart',
  openGraph: {
    type: 'website',
    url: '/',
    title: defaultTitle,
    description: defaultDescription,
    siteName: 'RunSmart',
    images: [
      {
        url: '/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'RunSmart app icon',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: defaultTitle,
    description: defaultDescription,
    images: ['/icon-512x512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icon-192x192.png' }],
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Resource hints for external services */}
        <link rel="dns-prefetch" href="https://us.i.posthog.com" />
        <link rel="preconnect" href="https://us.i.posthog.com" crossOrigin="" />
        <Script
          id="schema-org"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <InitialLoadingSkeleton />
        <ServiceWorkerRegister />
        <ChunkErrorBoundary>
          <PostHogProvider>
            <ReminderInit />
            {children}
            <Toaster />
            {process.env.NEXT_PUBLIC_POSTHOG_SURVEYS_ENABLED !== 'false' && (
              <Script
                src="https://us-assets.i.posthog.com/static/surveys.js"
                strategy="lazyOnload"
              />
            )}
          </PostHogProvider>
        </ChunkErrorBoundary>
      </body>
    </html>
  )
}
