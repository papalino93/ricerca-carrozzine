import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings, type CompanySettings } from "@/lib/settings";
import { VerbaleDocument, type DocumentoTipo, type TariffaDocumento } from "@/lib/pdf/VerbaleDocument";
import { appendDocumentLog } from "@/lib/documentLog";
import { isDriveConfigured, uploadSignedDocument } from "@/lib/drive";

export const runtime = "nodejs";

interface DocumentoRequestBody {
  tipo: DocumentoTipo;
  numeroContratto?: string;
  data?: string;
  note?: string;
  dispositivo: {
    codice: string;
    categoria: string;
    marca: string;
    modello: string;
    larghezza: number | null;
  };
  cliente: {
    nome: string;
    telefono: string;
  };
  alPrevisto?: string | null;
  tariffa?: TariffaDocumento | null;
  /** PNG data URI dal riquadro di firma (vedi SignaturePad): assenti sul
   * verbale "di carta" di sempre, presenti solo quando si è firmato sullo
   * schermo — vedi anche isDriveConfigured più sotto. */
  firmaCliente?: string | null;
  firmaOperatore?: string | null;
}

function buildDocument(body: DocumentoRequestBody, settings: CompanySettings) {
  return (
    <VerbaleDocument
      tipo={body.tipo}
      numeroContratto={body.numeroContratto ?? ""}
      data={body.data ?? ""}
      settings={settings}
      dispositivo={body.dispositivo}
      cliente={{ nome: body.cliente?.nome ?? "", telefono: body.cliente?.telefono ?? "" }}
      note={body.note ?? ""}
      alPrevisto={body.alPrevisto ?? null}
      tariffa={body.tariffa ?? null}
      firmaClienteUrl={body.firmaCliente ?? null}
      firmaOperatoreUrl={body.firmaOperatore ?? null}
    />
  );
}

// Generabile sia dalla pagina di ricerca sia dall'admin (entrambe richiedono
// login, vedi proxy.ts).
export async function POST(req: NextRequest) {
  // Difesa in profondità: oltre al proxy, un controllo proprio — questa
  // rotta genera documenti con carta intestata, P.IVA e condizioni
  // dell'azienda, e scrive nel registro Documenti.
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as DocumentoRequestBody;

    if (body.tipo !== "consegna" && body.tipo !== "restituzione") {
      return NextResponse.json({ error: "Tipo documento non valido" }, { status: 400 });
    }
    if (!body.dispositivo?.codice) {
      return NextResponse.json({ error: "Dispositivo non valido" }, { status: 400 });
    }

    const settings = await getSettings();

    const buffer = await renderToBuffer(buildDocument(body, settings));

    // Firmato E Drive configurato: lo carichiamo anche lì, così resta
    // ritrovabile (link nel registro Documenti) invece di esistere solo
    // come scaricato una volta sul dispositivo di chi l'ha generato. Un
    // documento non firmato (il caso di sempre, "di carta") non viene
    // archiviato da nessuna parte — resta generato al volo e basta, come
    // prima di questa funzione.
    let driveUrl: string | null = null;
    if ((body.firmaCliente || body.firmaOperatore) && isDriveConfigured()) {
      try {
        const filename = `verbale-${body.tipo}-${body.dispositivo.codice}-${body.data || "senza-data"}.pdf`;
        driveUrl = await uploadSignedDocument(filename, buffer);
      } catch (driveErr) {
        // best-effort anche questo: un problema su Drive non deve impedire
        // all'operatore di scaricare comunque il PDF appena generato.
        console.error("Caricamento su Drive non riuscito:", driveErr);
      }
    }

    // Il registro Documenti traccia ogni generazione (con o senza firma):
    // un errore qui non deve impedire il download del documento già pronto.
    try {
      await appendDocumentLog({
        data: body.data || new Date().toISOString().slice(0, 10),
        tipo: body.tipo,
        codice: body.dispositivo.codice,
        numeroContratto: body.numeroContratto || null,
        cliente: body.cliente?.nome || null,
        telefono: body.cliente?.telefono || null,
        driveUrl,
      });
    } catch (logErr) {
      // best-effort: non deve bloccare il download, ma va comunque tracciato
      // (altrimenti il registro Documenti può smettere di aggiornarsi senza
      // che nessuno se ne accorga).
      console.error("Registrazione documento non riuscita:", logErr);
    }

    const bytes = new Uint8Array(buffer);
    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="verbale-${body.tipo}-${body.dispositivo.codice}.pdf"`,
    };
    // Il body della risposta è il PDF grezzo (per il download diretto): il
    // link Drive, quando c'è, viaggia in un header a parte così il client
    // può comunque confermarlo all'operatore senza dover fare una seconda
    // richiesta solo per saperlo.
    if (driveUrl) headers["X-Drive-Url"] = driveUrl;

    return new NextResponse(new Blob([bytes]), { headers });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
