import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ricerca Ausili",
    short_name: "Ausili",
    description:
      "Ricerca disponibilità e gestione del noleggio di carrozzine e altri ausili/dispositivi.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F6F5",
    theme_color: "#16302E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
