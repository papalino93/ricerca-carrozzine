import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { getFascicoloAllegatoImmagine } from "@/lib/fascicoli-allegati";

export const runtime = "nodejs";

const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;

// Serve una singola immagine allegata, invece di portarla nell'elenco (vedi
// fascicoli-allegati.ts): solo per allegati di formato "immagine", i PDF
// vivono su Drive e si aprono dal loro link diretto.
export async function GET(req: NextRequest, { params }: { params: Promise<{ numero: string; id: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero, id } = await params;
    const dataUri = await getFascicoloAllegatoImmagine(numero, id);
    if (!dataUri) {
      return NextResponse.json({ error: "Allegato non trovato" }, { status: 404 });
    }
    const match = DATA_URI_RE.exec(dataUri);
    if (!match) {
      return NextResponse.json({ error: "Formato immagine non valido" }, { status: 500 });
    }
    const [, mime, base64] = match;
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    return new NextResponse(new Blob([bytes]), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
