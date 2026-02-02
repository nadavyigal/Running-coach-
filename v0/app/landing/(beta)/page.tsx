import type { Metadata } from "next";

import LandingBetaClient from "./landing-client";

export const metadata: Metadata = {
  title: "Run-Smart AI | Early Access Beta",
  description:
    "Join 200+ runners getting fitter, faster with personalized AI coaching. Early access beta for Run-Smart AI.",
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title: "Run-Smart AI | Early Access Beta",
    description:
      "Join 200+ runners getting fitter, faster with personalized AI coaching. Early access beta for Run-Smart AI.",
    url: "/landing",
    type: "website",
    images: [
      {
        url: "/images/runsmart-intro-bg.jpg",
        width: 1200,
        height: 630,
        alt: "Run-Smart AI beta preview",
      },
    ],
  },
  twitter: {
    title: "Run-Smart AI | Early Access Beta",
    description:
      "Join 200+ runners getting fitter, faster with personalized AI coaching. Early access beta for Run-Smart AI.",
    images: ["/images/runsmart-intro-bg.jpg"],
    card: "summary_large_image",
  },
};

export default function LandingPage() {
  return <LandingBetaClient />;
}
