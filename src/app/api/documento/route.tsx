import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings, type CompanySettings } from "@/lib/settings";
import { VerbaleDocument, type DocumentoTipo } from "@/lib/pdf/VerbaleDocument";
import { appendDocumentLog } from "@/lib/documentLog";

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

    // Il PDF non viene archiviato (nessuno storage esterno, vedi README):
    // registriamo solo che è stato generato. Un errore qui non deve
    // impedire il download del documento già pronto.
    try {
      await appendDocumentLog({
        data: body.data || new Date().toISOString().slice(0, 10),
        tipo: body.tipo,
        codice: body.dispositivo.codice,
        numeroContratto: body.numeroContratto || null,
        cliente: body.cliente?.nome || null,
        telefono: body.cliente?.telefono || null,
      });
    } catch (logErr) {
      // best-effort: non deve bloccare il download, ma va comunque tracciato
      // (altrimenti il registro Documenti può smettere di aggiornarsi senza
      // che nessuno se ne accorga).
      console.error("Registrazione documento non riuscita:", logErr);
    }

    const bytes = new Uint8Array(buffer);
    return new NextResponse(new Blob([bytes]), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="verbale-${body.tipo}-${body.dispositivo.codice}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
