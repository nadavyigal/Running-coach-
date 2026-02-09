import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChallengeLandingContent } from '@/components/challenge-landing-content';
import { getAllChallengeSlugs, getChallengeTemplateBySlug, getLocalizedChallenge } from '@/lib/challengeTemplates';

interface ChallengePageProps {
  params: {
    slug: string;
  };
  searchParams?: {
    lang?: string;
  };
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllChallengeSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params, searchParams }: ChallengePageProps): Metadata {
  const template = getChallengeTemplateBySlug(params.slug);
  const lang = searchParams?.lang === 'he' ? 'he' : 'en';
  const isHebrew = lang === 'he';

  if (!template) {
    return {
      title: 'Challenge Not Found | RunSmart AI Running Coach',
      robots: { index: false, follow: false },
    };
  }

  // Get localized template if Hebrew
  const displayTemplate = isHebrew
    ? { ...template, ...getLocalizedChallenge(params.slug, 'he') }
    : template;

  const description = `${displayTemplate.tagline}. ${displayTemplate.promise}`;
  const title = `${displayTemplate.name} | RunSmart ${isHebrew ? '- מאמן הריצה החכם שלך' : 'AI Running Coach'}`;

  return {
    title,
    description,
    alternates: {
      languages: {
        'en': `/challenges/${params.slug}?lang=en`,
        'he': `/challenges/${params.slug}?lang=he`,
        'x-default': `/challenges/${params.slug}`,
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

export default function ChallengePage({ params, searchParams }: ChallengePageProps) {
  const template = getChallengeTemplateBySlug(params.slug);
  const initialLanguage = (searchParams?.lang === 'he' ? 'he' : 'en') as 'en' | 'he';

  if (!template) {
    notFound();
  }

  return <ChallengeLandingContent template={template} initialLanguage={initialLanguage} />;
}
