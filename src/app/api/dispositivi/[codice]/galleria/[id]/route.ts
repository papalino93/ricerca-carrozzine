import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { getDevicePhotoImage } from "@/lib/photos";

export const runtime = "nodejs";

const DATA_URI_RE = /^data:([^;]+);base64,(.+)$/;

// Serve una singola immagine della galleria, invece di portarla negli
// elenchi: /galleria restituisce solo id/etichetta/data per ogni foto, e
// questa rotta scarica una sola immagine quando serve mostrarla.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string; id: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice, id } = await params;
    const dataUri = await getDevicePhotoImage(codice, id);
    if (!dataUri) {
      return NextResponse.json({ error: "Foto non trovata" }, { status: 404 });
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
        // L'id è casuale e non viene mai riassegnato: la stessa foto sotto
        // lo stesso id non cambia mai contenuto.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
