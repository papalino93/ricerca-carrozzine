import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings } from "@/lib/settings";
import { getFascicolo } from "@/lib/fascicoli";
import { ProcessoProduttivoDocument } from "@/lib/pdf/ProcessoProduttivoDocument";

export const runtime = "nodejs";

// Allegato A (flussogramma di progettazione ISO 13485) come documento a
// sé, stampabile su richiesta senza toccare il fascicolo: la stessa
// procedura fissa può anche essere allegata come ultima pagina del
// fascicolo cliente (vedi flag "includiAllegatoA" nel tab Produzione).
export async function GET(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const fascicolo = await getFascicolo(numero);
    if (!fascicolo) {
      return NextResponse.json({ error: `Fascicolo ${numero} non trovato` }, { status: 404 });
    }
    const settings = await getSettings();
    const buffer = await renderToBuffer(<ProcessoProduttivoDocument settings={settings} fascicolo={fascicolo} />);
    const bytes = new Uint8Array(buffer);
    return new NextResponse(new Blob([bytes]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="processo-produttivo-${fascicolo.numero}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
