import { NextResponse } from "next/server";
import { isDriveConfigured } from "@/lib/drive";

export const runtime = "nodejs";

// Nessun dato sensibile restituito (solo un booleano): serve a DocumentPanel
// per decidere se mostrare la sezione di firma digitale, senza dover far
// arrivare la configurazione del Drive fin dentro ogni componente client
// che genera un documento.
export async function GET() {
  return NextResponse.json({ configurato: isDriveConfigured() });
}
