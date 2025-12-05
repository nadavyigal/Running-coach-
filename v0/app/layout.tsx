import type { Metadata, Viewport } from 'next'
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

export const metadata: Metadata = {
  title: 'RunSmart - Your AI Running Coach',
  description: 'Personalized running plans powered by AI',
  generator: 'v0.dev',
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
      </head>
      <body className={inter.className}>
        <InitialLoadingSkeleton />
        <ServiceWorkerRegister />
        <ChunkErrorBoundary>
          <PostHogProvider>
            <ReminderInit />
            {children}
            <Toaster />
          </PostHogProvider>
        </ChunkErrorBoundary>
      </body>
    </html>
  )
}
