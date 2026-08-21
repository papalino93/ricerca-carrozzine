import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";

// L'intera applicazione richiede l'autenticazione: non esiste nessuna area
// pubblica. Sono esclusi solo gli asset statici (icone, logo, immagine di
// preview, manifest PWA) che il browser scarica prima di poter presentare
// le credenziali e che non contengono dati aziendali.
export default async function proxy(req: NextRequest) {
  return (await requireBasicAuth(req)) ?? NextResponse.next();
}

// Il matcher deve essere una stringa statica (Next.js lo analizza a
// compile-time): niente variabili o template literal, vedi
// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon-32.png|apple-icon.png|icon-192.png|icon-512.png|logo.png|og-image.png|manifest.webmanifest).*)",
  ],
};
