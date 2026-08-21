import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";

// Protegge l'amministrazione (elenco dispositivi e impostazioni azienda) e
// le API di scrittura corrispondenti con Basic Auth. La ricerca pubblica e
// la lettura dei dispositivi restano accessibili senza autenticazione.
export default function proxy(req: NextRequest) {
  return requireBasicAuth(req) ?? NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/impostazioni/:path*",
    "/api/upload-logo/:path*",
  ],
};
