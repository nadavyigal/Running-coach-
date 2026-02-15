import { MetadataRoute } from 'next'
import { getAllChallengeSlugs } from '@/lib/challengeTemplates'

/**
 * Dynamic sitemap for RunSmart
 * This sitemap is automatically generated and includes all public pages.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart.app'
  const currentDate = new Date()
  const challengeRoutes = getAllChallengeSlugs().map((slug) => ({
    url: `${baseUrl}/challenges/${slug}`,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...challengeRoutes,
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
  ]
}
