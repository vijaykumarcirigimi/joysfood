import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Joy's Food",
    short_name: "Joy's Food",
    description:
      "Pre-order home-style meals for the date and time slot that suits you.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf4",
    theme_color: "#c2410c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
