import { notFound } from 'next/navigation';
import Script from 'next/script';
import { ChallengeLandingContent } from '@/components/challenge-landing-content';
import { getAllChallengeSlugs, getChallengeTemplateBySlug, getLocalizedChallenge } from '@/lib/challengeTemplates';
import type { Metadata } from 'next';

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

// Per-challenge SEO keywords
const CHALLENGE_KEYWORDS: Record<string, string[]> = {
  'start-running': [
    'beginner running program',
    '21 day running challenge',
    'couch to 5k alternative',
    'how to start running',
    'running for beginners',
    'AI running coach free',
    'running habit challenge',
    'start running app',
  ],
  'morning-ritual': [
    'morning run challenge',
    'mindful running',
    'guided morning run',
    'running meditation',
    'morning running routine',
    'mindfulness running app',
    '21 day morning challenge',
    'running for mental clarity',
  ],
  'plateau-breaker': [
    'running plateau',
    'improve running pace',
    'running speed work',
    'AI running training plan',
    'break running plateau',
    'strides running workout',
    'tempo run training',
    'get faster running',
  ],
};

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://runsmart.run';

  // Craft benefit-first descriptions under 155 chars with primary keyword
  const descriptionMap: Record<string, { en: string; he: string }> = {
    'start-running': {
      en: `Free 21-day beginner running challenge with AI coaching. Go from zero to running 30 minutes — no watch, no gym, no experience needed.`,
      he: `אתגר ריצה חינמי ל-21 יום עם מאמן AI. מאפס לריצה של 30 דקות — ללא שעון, ללא ניסיון קודם.`,
    },
    'morning-ritual': {
      en: `Free 21-day guided morning run challenge. Build a mindful morning ritual that energizes your day — AI-coached, no watch required.`,
      he: `אתגר ריצת בוקר מודרכת חינמי ל-21 יום. בנה טקס בוקר מיינדפול שנותן אנרגיה ליום כולו.`,
    },
    'plateau-breaker': {
      en: `Free 21-day running challenge for stuck runners. AI-powered strides, hills & tempo work to break your plateau in 3 weeks.`,
      he: `אתגר ריצה חינמי ל-21 יום לרצים תקועים. סטריידים, עליות וטמפו מבוסס AI לפריצת פלטו.`,
    },
  };

  const descObj = descriptionMap[params.slug];
  const description = isHebrew
    ? (descObj?.he ?? `${displayTemplate.tagline}. ${displayTemplate.promise}`)
    : (descObj?.en ?? `${displayTemplate.tagline}. ${displayTemplate.promise}`);

  const title = `${displayTemplate.name} | RunSmart ${isHebrew ? '- מאמן הריצה החכם שלך' : 'AI Running Coach'}`;
  const keywords = CHALLENGE_KEYWORDS[params.slug] ?? [];

  return {
    title,
    description,
    keywords: keywords.join(', '),
    alternates: {
      canonical: `${baseUrl}/challenges/${params.slug}`,
      languages: {
        'en': `${baseUrl}/challenges/${params.slug}?lang=en`,
        'he': `${baseUrl}/challenges/${params.slug}?lang=he`,
        'x-default': `${baseUrl}/challenges/${params.slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/challenges/${params.slug}`,
      locale: isHebrew ? 'he_IL' : 'en_US',
      siteName: 'RunSmart',
      images: [
        {
          url: `/challenges/${template.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${displayTemplate.name} — RunSmart AI Running Coach`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/challenges/${template.slug}/opengraph-image`],
      site: '@RunSmartApp',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
      },
    },
  };
}

// Build JSON-LD structured data for a challenge
function buildJsonLd(slug: string, template: ReturnType<typeof getChallengeTemplateBySlug>, isHebrew: boolean) {
  if (!template) return null;

  const displayTemplate = isHebrew
    ? { ...template, ...getLocalizedChallenge(slug, 'he') }
    : template;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://runsmart.run';

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: displayTemplate.name,
    description: displayTemplate.description,
    url: `${baseUrl}/challenges/${slug}`,
    provider: {
      '@type': 'Organization',
      name: 'RunSmart',
      url: baseUrl,
      logo: `${baseUrl}/icons/icon-192x192.png`,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      duration: `P${template.durationDays}D`,
      courseSchedule: {
        '@type': 'Schedule',
        repeatFrequency: 'P1D',
        repeatCount: template.durationDays,
      },
    },
    teaches: displayTemplate.promise,
    educationalLevel: template.difficulty,
    inLanguage: isHebrew ? 'he' : 'en',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };
}

export default function ChallengePage({ params, searchParams }: ChallengePageProps) {
  const template = getChallengeTemplateBySlug(params.slug);
  const initialLanguage = (searchParams?.lang === 'he' ? 'he' : 'en') as 'en' | 'he';

  if (!template) {
    notFound();
  }

  const jsonLd = buildJsonLd(params.slug, template, initialLanguage === 'he');

  return (
    <>
      {jsonLd && (
        <Script
          id={`jsonld-challenge-${params.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ChallengeLandingContent template={template} initialLanguage={initialLanguage} />
    </>
  );
}
