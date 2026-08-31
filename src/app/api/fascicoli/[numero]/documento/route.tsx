import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings } from "@/lib/settings";
import { getFascicolo, updateFascicolo } from "@/lib/fascicoli";
import { listClients, normalizeName, EMPTY_CLIENT_TEMPLATE } from "@/lib/clients";
import { FascicoloDocument } from "@/lib/pdf/FascicoloDocument";
import { isFascicoliDriveConfigured, uploadFascicoloPdf } from "@/lib/drive";
import { appendFascicoloPdfLog } from "@/lib/fascicoli-pdf-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Genera il PDF del fascicolo: recupera i dati del cliente dall'anagrafica
// (mai ridigitati), li unisce al contenuto del fascicolo e produce un unico
// documento pronto per la stampa.
//
// Due modalità, dalla query string:
// - "Anteprima" (default): render al volo, non tocca versione né archivio —
//   libero da guardare quante volte si vuole mentre si compila.
// - ?finalizza=1 ("Scarica PDF"/"Stampa"): è la generazione che conta —
//   incrementa la versione del fascicolo, e se Drive è configurato archivia
//   il PDF e lo registra nel log. Se Drive non è configurato, il PDF resta
//   comunque scaricabile: non si finge un'archiviazione che non è avvenuta.
export async function GET(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const finalizza = req.nextUrl.searchParams.get("finalizza") === "1";
    const inline = req.nextUrl.searchParams.get("inline") === "1";

    let fascicolo = await getFascicolo(numero);
    if (!fascicolo) {
      return NextResponse.json({ error: `Fascicolo ${numero} non trovato` }, { status: 404 });
    }
    if (finalizza) {
      fascicolo = await updateFascicolo(numero, { incrementaVersione: true });
    }

    const [settings, clients] = await Promise.all([getSettings(), listClients()]);
    const cliente =
      clients.find((c) => normalizeName(c.nome) === normalizeName(fascicolo.clienteNome)) ??
      EMPTY_CLIENT_TEMPLATE(fascicolo.clienteNome, fascicolo.clienteCF);

    const buffer = await renderToBuffer(<FascicoloDocument settings={settings} cliente={cliente} fascicolo={fascicolo} />);

    let driveUrl: string | null = null;
    if (finalizza) {
      if (isFascicoliDriveConfigured()) {
        try {
          const filename = `fascicolo-${fascicolo.numero}-v${fascicolo.versione}.pdf`;
          driveUrl = await uploadFascicoloPdf(filename, buffer);
        } catch (driveErr) {
          // best-effort, stesso pattern di /api/documento: un problema su
          // Drive non deve impedire il download del PDF appena generato.
          console.error("Archiviazione su Drive non riuscita:", driveErr);
        }
      }

      try {
        await appendFascicoloPdfLog({
          data: new Date().toISOString(),
          fascicoloNumero: fascicolo.numero,
          versione: fascicolo.versione,
          operatore: fascicolo.operatore,
          driveUrl,
        });
      } catch (logErr) {
        console.error("Registrazione PDF fascicolo non riuscita:", logErr);
      }
    }

    const bytes = new Uint8Array(buffer);
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="fascicolo-${fascicolo.numero}.pdf"`,
      "Cache-Control": "no-store",
    };
    if (driveUrl) headers["X-Drive-Url"] = driveUrl;

    return new NextResponse(new Blob([bytes]), { headers });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
