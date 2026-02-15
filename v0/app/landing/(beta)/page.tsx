import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "RunSmart | Adaptive AI Running Coach",
  description:
    "RunSmart adapts your training plan to how you feel so you stay consistent and improve safely.",
  alternates: {
    canonical: "/landing",
  },
  openGraph: {
    title: "RunSmart | Adaptive AI Running Coach",
    description:
      "RunSmart adapts your training plan to how you feel so you stay consistent and improve safely.",
    url: "/landing",
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
    title: "RunSmart | Adaptive AI Running Coach",
    description:
      "RunSmart adapts your training plan to how you feel so you stay consistent and improve safely.",
    images: ["/images/runsmart-intro-bg.jpg"],
    card: "summary_large_image",
  },
};

export default function LandingPage() {
  redirect("/");
}
