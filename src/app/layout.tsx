import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { InstallPwaBanner } from "@/components/InstallPwaBanner";
import "./globals.css";

const heading = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ricerca Ausili",
  },
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

export const viewport: Viewport = {
  themeColor: "#16302E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={heading.variable}>
      <head>
        {/* Chrome emette `beforeinstallprompt` al caricamento, di norma
            prima che React abbia idratato: qui lo intercettiamo subito e lo
            parcheggiamo su window, così InstallPwaBanner può recuperarlo
            quando si monta. Senza, su Android il pulsante "Installa" non
            comparirebbe quasi mai. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__raInstallPrompt=e;});",
          }}
        />
      </head>
      <body>
        {children}
        <InstallPwaBanner />
      </body>
    </html>
  );
}
