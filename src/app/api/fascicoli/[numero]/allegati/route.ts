import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import {
  addFascicoloAllegatoImmagine,
  addFascicoloAllegatoPdf,
  listFascicoloAllegati,
  removeFascicoloAllegato,
} from "@/lib/fascicoli-allegati";
import { imageToDataUri } from "@/lib/image-to-data-uri";
import { isFascicoliDriveConfigured, uploadFascicoloAllegato } from "@/lib/drive";

export const runtime = "nodejs";

// Allegati del fascicolo (prescrizione medica, autorizzazione ASL, altra
// documentazione): immagini dentro il foglio come la galleria foto dei
// dispositivi, PDF caricati su Drive (troppo pesanti per una cella).
export async function GET(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const allegati = await listFascicoloAllegati(numero);
    return NextResponse.json({ allegati });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const form = await req.formData();
    const file = form.get("file");
    const etichetta = form.get("etichetta");
    const etichettaStr = typeof etichetta === "string" ? etichetta : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file ricevuto" }, { status: 400 });
    }

    if (file.type.startsWith("image/")) {
      const dataUri = await imageToDataUri(Buffer.from(await file.arrayBuffer()));
      const allegati = await addFascicoloAllegatoImmagine({
        numero,
        etichetta: etichettaStr,
        nome: file.name,
        immagine: dataUri,
      });
      return NextResponse.json({ allegati });
    }

    if (file.type === "application/pdf") {
      if (!isFascicoliDriveConfigured()) {
        return NextResponse.json(
          {
            error:
              "Google Drive non configurato: i PDF (prescrizioni, autorizzazioni ASL...) sono troppo pesanti per essere salvati altrove. Carica un'immagine, oppure configura Drive (vedi README).",
          },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `allegato-${numero}-${Date.now()}-${file.name}`;
      const { id: driveFileId, url: driveUrl } = await uploadFascicoloAllegato(filename, buffer);
      const allegati = await addFascicoloAllegatoPdf({
        numero,
        etichetta: etichettaStr,
        nome: file.name,
        driveUrl,
        driveFileId,
      });
      return NextResponse.json({ allegati });
    }

    return NextResponse.json({ error: "Formato non supportato: solo immagini o PDF" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Id allegato obbligatorio" }, { status: 400 });
    }
    const allegati = await removeFascicoloAllegato(numero, id);
    return NextResponse.json({ allegati });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
