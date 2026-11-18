import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings } from "@/lib/settings";
import { getFascicolo } from "@/lib/fascicoli";
import { listClients, normalizeName, EMPTY_CLIENT_TEMPLATE } from "@/lib/clients";
import { StampaClienteDocument } from "@/lib/pdf/StampaClienteDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stampa cliente — primo appuntamento: non tocca il fascicolo (nessuna
// versione da incrementare, nessun archivio su Drive), stampabile ogni
// volta che serve senza dover passare dalla stampa interna completa.
export async function GET(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const fascicolo = await getFascicolo(numero);
    if (!fascicolo) {
      return NextResponse.json({ error: `Fascicolo ${numero} non trovato` }, { status: 404 });
    }
    const [settings, clients] = await Promise.all([getSettings(), listClients()]);
    const cliente =
      clients.find((c) => normalizeName(c.nome) === normalizeName(fascicolo.clienteNome)) ??
      EMPTY_CLIENT_TEMPLATE(fascicolo.clienteNome, fascicolo.clienteCF);

    const buffer = await renderToBuffer(
      <StampaClienteDocument settings={settings} cliente={cliente} fascicolo={fascicolo} />
    );
    const bytes = new Uint8Array(buffer);
    return new NextResponse(new Blob([bytes]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="fascicolo-${fascicolo.numero}-primo-appuntamento.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
