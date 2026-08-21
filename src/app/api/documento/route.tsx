import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSettings, type CompanySettings } from "@/lib/settings";
import { VerbaleDocument, type DocumentoTipo } from "@/lib/pdf/VerbaleDocument";

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
      cliente={body.cliente}
      note={body.note ?? ""}
    />
  );
}

// Pubblica: generabile sia dalla ricerca pubblica sia dall'admin.
export async function POST(req: NextRequest) {
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
