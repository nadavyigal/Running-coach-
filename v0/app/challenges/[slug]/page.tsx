import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChallengeLandingContent } from '@/components/challenge-landing-content';
import { getAllChallengeSlugs, getChallengeTemplateBySlug, getLocalizedChallenge } from '@/lib/challengeTemplates';

interface ChallengePageProps {
  // Next 15+ passes this as a Promise.
  params: Promise<{
    slug: string;
  }>;
}

// `searchParams` is deliberately not read here. Awaiting it opts the route into
// request-time rendering, which would drop these pages out of the prerender set.
// It was already a no-op: the route is prerendered (dynamicParams = false +
// generateStaticParams), so searchParams was empty at build time and the server
// language was always English. ChallengeLandingContent reads `?lang` on the
// client and applies it there, which is what actually drove the Hebrew variant.

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllChallengeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ChallengePageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = getChallengeTemplateBySlug(slug);
  // Always English server-side: these pages are prerendered, so metadata cannot
  // vary by `?lang`. This matches what the Next 14 prerendered output already emitted.
  const isHebrew: boolean = false;

  if (!template) {
    return {
      title: 'Challenge Not Found | RunSmart AI Running Coach',
      robots: { index: false, follow: false },
    };
  }

  // Get localized template if Hebrew
  const displayTemplate = isHebrew
    ? { ...template, ...getLocalizedChallenge(slug, 'he') }
    : template;

  const description = `${displayTemplate.tagline}. ${displayTemplate.promise}`;
  const title = `${displayTemplate.name} | RunSmart ${isHebrew ? '- מאמן הריצה החכם שלך' : 'AI Running Coach'}`;

  return {
    title,
    description,
    alternates: {
      languages: {
        'en': `/challenges/${slug}?lang=en`,
        'he': `/challenges/${slug}?lang=he`,
        'x-default': `/challenges/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: isHebrew ? 'he_IL' : 'en_US',
      images: [
        {
          url: `/challenges/${template.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${displayTemplate.name} challenge`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/challenges/${template.slug}/opengraph-image`],
    },
  };
}

export default async function ChallengePage({ params }: ChallengePageProps) {
  const { slug } = await params;
  const template = getChallengeTemplateBySlug(slug);
  const initialLanguage: 'en' | 'he' = 'en';

  if (!template) {
    notFound();
  }

  return <ChallengeLandingContent template={template} initialLanguage={initialLanguage} />;
}
