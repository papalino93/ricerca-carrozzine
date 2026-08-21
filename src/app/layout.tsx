import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ricerca Ausili",
  description:
    "Ricerca disponibilità e gestione del noleggio di carrozzine e altri ausili/dispositivi.",
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
