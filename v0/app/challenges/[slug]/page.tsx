import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChallengeLandingContent } from '@/components/challenge-landing-content';
import { getAllChallengeSlugs, getChallengeTemplateBySlug } from '@/lib/challengeTemplates';

interface ChallengePageProps {
  params: {
    slug: string;
  };
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllChallengeSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: ChallengePageProps): Metadata {
  const template = getChallengeTemplateBySlug(params.slug);

  if (!template) {
    return {
      title: 'Challenge Not Found | RunSmart AI Running Coach',
      robots: { index: false, follow: false },
    };
  }

  const description = `${template.tagline}. ${template.promise}`;
  const title = `${template.name} | RunSmart AI Running Coach`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: `/challenges/${template.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${template.name} challenge`,
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

export default function ChallengePage({ params }: ChallengePageProps) {
  const template = getChallengeTemplateBySlug(params.slug);

  if (!template) {
    notFound();
  }

  return <ChallengeLandingContent template={template} />;
}
