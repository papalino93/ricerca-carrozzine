import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://ricerca-carrozzine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Ricerca Ausili",
  description:
    "Ricerca disponibilità e gestione del noleggio di carrozzine e altri ausili/dispositivi.",
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Ricerca Ausili",
    description:
      "Ricerca disponibilità e gestione del noleggio di carrozzine e altri ausili/dispositivi.",
    url: SITE_URL,
    siteName: "Ricerca Ausili",
    locale: "it_IT",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ricerca Ausili",
    description:
      "Ricerca disponibilità e gestione del noleggio di carrozzine e altri ausili/dispositivi.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
