'use client'

import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ReminderInit } from '@/components/reminder-init'
import { PostHogProvider } from '@/lib/posthog-provider'
import { ChunkErrorBoundary } from '@/components/chunk-error-boundary'
import { ErrorBoundary } from '@/components/error-boundary'
import { ServiceWorkerRegister } from '@/components/service-worker-register'
import { DataProvider } from '@/contexts/DataContext'
import { AuthProvider } from '@/lib/auth-context'

// Modern Athletic typography system
// English: Inter for display and body
// Hebrew: Heebo for display and body

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

// Note: metadata exports are not allowed in client components
// The metadata is now handled in the HTML head directly

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <title>{defaultTitle}</title>
        <meta name="description" content={defaultDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Heebo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Resource hints for external services */}
        <link rel="dns-prefetch" href="https://us.i.posthog.com" />
        <link rel="preconnect" href="https://us.i.posthog.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />
        <script
          id="schema-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJsonLd) }}
        />
      </head>
      <body>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YBJKT7T4DE"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YBJKT7T4DE');
          `}
        </Script>
        <ServiceWorkerRegister />
        <ErrorBoundary>
          <ChunkErrorBoundary>
            <PostHogProvider>
              <AuthProvider>
                <DataProvider>
                  <ReminderInit />
                  {children}
                  <Toaster />
                {process.env.NEXT_PUBLIC_POSTHOG_SURVEYS_ENABLED !== 'false' && (
                    <Script
                      src="https://us-assets.i.posthog.com/static/surveys.js"
                      strategy="lazyOnload"
                    />
                  )}
                </DataProvider>
              </AuthProvider>
            </PostHogProvider>
          </ChunkErrorBoundary>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
