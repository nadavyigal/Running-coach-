import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Run-Smart - AI Running Coach",
    short_name: "Run-Smart",
    description: "Your personal AI running coach for training plans, tracking, and motivation",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#10b981",
    orientation: "portrait",
    icons: [
      {
        src: "/placeholder.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/placeholder.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
    categories: ["health", "fitness", "sports"],
    screenshots: [
      {
        src: "/screenshot-mobile.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
      },
    ],
  }
}
