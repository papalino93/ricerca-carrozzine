import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { InstallPwaBanner } from "@/components/InstallPwaBanner";
import { BuildInfo } from "@/components/BuildInfo";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import "./globals.css";

const heading = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

const SITE_URL = "https://medical-center-scandicci.vercel.app";

// "Ricerca Ausili" era il nome di lavoro del progetto, sparito da mesi da
// ogni schermata del gestionale (l'ultimo punto rimasto era l'intestazione
// di Magazzino noleggio). Questi metadata però non si vedono usando il
// sito: si vedono SOLO condividendo il link — l'anteprima su WhatsApp, la
// scheda del browser, l'icona sulla schermata Home — quindi il vecchio
// nome ci era rimasto senza che nessuno se ne accorgesse aprendo una
// pagina normale.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Medical Center",
  description:
    "Gestionale per noleggio ausili, commesse, fidelity e anagrafica clienti a Scandicci.",
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  // Gestionale a uso interno, già protetto da Basic Auth: non deve comparire
  // nei motori di ricerca (vedi anche robots.ts e il noindex nella pagina di
  // anteprima per i crawler social in proxy.ts).
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Medical Center",
  },
  openGraph: {
    title: "Medical Center",
    description:
      "Gestionale per noleggio ausili, commesse, fidelity e anagrafica clienti a Scandicci.",
    url: SITE_URL,
    siteName: "Medical Center",
    locale: "it_IT",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Medical Center",
    description:
      "Gestionale per noleggio ausili, commesse, fidelity e anagrafica clienti a Scandicci.",
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
        <ConfirmProvider>
          {children}
          <InstallPwaBanner />
          <BuildInfo />
        </ConfirmProvider>
      </body>
    </html>
  );
}
