/**
 * SEO utilities for RunSmart
 * Provides reusable meta tag generation and SEO helpers
 */

export interface PageSEO {
  title: string
  description: string
  url: string
  image?: string
  type?: 'website' | 'article' | 'profile'
  locale?: string
  siteName?: string
  publishedTime?: string
  modifiedTime?: string
  author?: string
  keywords?: string[]
}

/**
 * Generate complete meta tags for a page
 * Returns an object compatible with Next.js metadata API
 */
export function generateMetaTags(page: PageSEO) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'
  const defaultImage = `${baseUrl}/og-image.png`
  const siteName = page.siteName || 'RunSmart'

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords?.join(', '),
    authors: page.author ? [{ name: page.author }] : undefined,
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.url,
      siteName,
      images: [
        {
          url: page.image || defaultImage,
          width: 1200,
          height: 630,
          alt: page.title,
        },
      ],
      locale: page.locale || 'en_US',
      type: page.type || 'website',
      publishedTime: page.publishedTime,
      modifiedTime: page.modifiedTime,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [page.image || defaultImage],
      creator: '@runsmart_ai', // Update with actual Twitter handle
    },
    alternates: {
      canonical: page.url,
    },
  }
}

/**
 * Generate structured data (JSON-LD) for SEO
 */
export function generateStructuredData(type: string, data: Record<string, any>) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'

  const baseSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  }

  // Ensure URLs are absolute
  if (baseSchema.url && typeof baseSchema.url === 'string' && !baseSchema.url.startsWith('http')) {
    baseSchema.url = `${baseUrl}${baseSchema.url}`
  }

  return baseSchema
}

/**
 * SEO-friendly URL slug generator
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Calculate reading time for blog posts
 */
export function calculateReadingTime(text: string): string {
  const wordsPerMinute = 200
  const wordCount = text.trim().split(/\s+/).length
  const minutes = Math.ceil(wordCount / wordsPerMinute)
  return `${minutes} min read`
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
    })),
  }
}

/**
 * Default SEO configuration
 */
export const DEFAULT_SEO = {
  title: 'RunSmart - Your AI Running Coach',
  description:
    'RunSmart is an AI running coach that builds personalized training plans, tracks workouts, and helps you stay consistent. Join thousands of runners achieving their goals.',
  keywords: [
    'running coach',
    'AI running coach',
    'training plan',
    'running app',
    'marathon training',
    '5K training',
    'running tracker',
    'GPS running',
    'personalized running plan',
    'running consistency',
  ],
  siteName: 'RunSmart',
  locale: 'en_US',
  type: 'website' as const,
}

/**
 * Get canonical URL for a page
 */
export function getCanonicalUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
}

/**
 * Format meta title with site branding
 */
export function formatTitle(pageTitle: string, includeBrand = true): string {
  if (!includeBrand) return pageTitle
  return `${pageTitle} | RunSmart`
}
