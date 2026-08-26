import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings } from "@/lib/settings";
import { listCommesse } from "@/lib/commesse";
import { CommessaDocument } from "@/lib/pdf/CommessaDocument";
import type { CommessaRecord } from "@/lib/commesse-types";

export const runtime = "nodejs";

function buildDocument(settings: Awaited<ReturnType<typeof getSettings>>, commessa: CommessaRecord) {
  return <CommessaDocument settings={settings} commessa={commessa} />;
}

// Ricevuta stampabile di una scheda commessa, da dare al cliente allo
// sportello — non un documento contrattuale come il verbale di noleggio,
// quindi niente firma né registro: solo un GET con il numero della scheda.
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const numero = req.nextUrl.searchParams.get("numero");
    if (!numero) {
      return NextResponse.json({ error: "Numero obbligatorio" }, { status: 400 });
    }
    const commesse = await listCommesse();
    const commessa = commesse.find((c) => c.numero === numero);
    if (!commessa) {
      return NextResponse.json({ error: `Commessa n. ${numero} non trovata` }, { status: 404 });
    }

    const settings = await getSettings();
    const buffer = await renderToBuffer(buildDocument(settings, commessa));
    const bytes = new Uint8Array(buffer);
    return new NextResponse(new Blob([bytes]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="scheda-commessa-${numero}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
