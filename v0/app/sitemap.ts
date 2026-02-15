import { MetadataRoute } from 'next'

/**
 * Dynamic sitemap for RunSmart
 * This sitemap is automatically generated and includes all public pages.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'
  const currentDate = new Date()

  return [
    // Homepage
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Beta landing page
    {
      url: `${baseUrl}/landing`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    // Chat page
    {
      url: `${baseUrl}/chat`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // Plan page
    {
      url: `${baseUrl}/plan`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // Today page
    {
      url: `${baseUrl}/today`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // Record page
    {
      url: `${baseUrl}/record`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Profile page
    {
      url: `${baseUrl}/profile`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    // Onboarding
    {
      url: `${baseUrl}/onboarding`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Legal pages
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    // Future dynamic routes:
    // - Challenge pages: /challenges/[slug]
    // - Run reports: /runs/[runId]/report
    // - Public user profiles (when implemented)
    // - Blog posts (when implemented)
    // - Help/FAQ pages (when implemented)
  ]
}
