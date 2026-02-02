"use client";

import { useRouter } from "next/navigation";
import { BetaLandingScreen } from "@/components/beta-landing-screen";

const LEGAL_LINKS = {
  privacyHref: "/landing/privacy",
  termsHref: "/landing/terms",
  contactEmail: "firstname.lastname@runsmart-ai.com",
};

export default function LandingBetaClient() {
  const router = useRouter();

  return (
    <BetaLandingScreen
      onContinue={() => router.push("/onboarding")}
      showLegalLinks
      legalLinks={LEGAL_LINKS}
    />
  );
}
