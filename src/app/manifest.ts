import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Medical Center",
    short_name: "Medical Center",
    description:
      "Noleggio e disponibilità di carrozzine e ausili sanitari a Scandicci, con documenti di consegna e restituzione pronti in PDF.",
    start_url: "/",
    display: "standalone",
    // Stessi valori dei token in globals.css (--bg e --ink): la schermata di
    // avvio dell'app installata e la barra del browser devono essere dello
    // stesso colore delle pagine, non di una palette precedente.
    background_color: "#f6f5ee",
    theme_color: "#17301b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
