import type { Metadata } from "next";
import BetaClient from "./beta-client";

const TITLE = "Join the RunSmart beta";
const DESCRIPTION =
  "A running coach app for iPhone. When your week changes, your next run is still ready. Download the app and join the beta group.";

// Absolute base for canonical and og:url in LinkedIn previews. Prefers the production domain
// over VERCEL_URL, which is the per-deployment *.vercel.app host.
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/beta",
  },
  // Apple Smart App Banner in Safari on iPhone.
  itunes: {
    appId: "6768297840",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/beta",
    type: "website",
    images: [
      {
        url: "/images/runsmart-intro-bg.jpg",
        width: 1200,
        height: 630,
        alt: "RunSmart app preview",
      },
    ],
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
    images: ["/images/runsmart-intro-bg.jpg"],
    card: "summary_large_image",
  },
};

export default function BetaPage() {
  return <BetaClient />;
}
