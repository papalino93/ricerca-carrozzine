import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { listTariffe, upsertTariffa, removeTariffa, type Tariffa } from "@/lib/tariffe";

export const runtime = "nodejs";

// Serve al promemoria di tariffa nei form di noleggio (richiede login, vedi proxy.ts).
export async function GET() {
  try {
    const tariffe = await listTariffe();
    return NextResponse.json({ tariffe });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Scrittura: riservata all'amministrazione.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as Tariffa;
    const tariffe = await upsertTariffa({
      categoria: body.categoria,
      sottocategoria: body.sottocategoria || null,
      importo: Number(body.importo),
      unita: body.unita === "settimana" ? "settimana" : "giorno",
      nota: body.nota || null,
      consegnaRitiro: body.consegnaRitiro != null ? Number(body.consegnaRitiro) : null,
    });
    return NextResponse.json({ tariffe });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const categoria = req.nextUrl.searchParams.get("categoria");
    const sottocategoria = req.nextUrl.searchParams.get("sottocategoria");
    if (!categoria) {
      return NextResponse.json({ error: "Categoria obbligatoria" }, { status: 400 });
    }
    const tariffe = await removeTariffa(categoria, sottocategoria || null);
    return NextResponse.json({ tariffe });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
