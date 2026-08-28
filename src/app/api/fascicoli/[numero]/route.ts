import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { deleteFascicolo, getFascicolo, updateFascicolo, type UpdateFascicoloInput } from "@/lib/fascicoli";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const fascicolo = await getFascicolo(numero);
    if (!fascicolo) {
      return NextResponse.json({ error: `Fascicolo ${numero} non trovato` }, { status: 404 });
    }
    return NextResponse.json({ fascicolo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Salvataggio di una sezione (o dei campi di testata): il body contiene solo
// ciò che è cambiato, mai il fascicolo intero — vedi updateFascicolo per il
// merge per sezione. Usata sia dal salvataggio esplicito ("Salva") sia
// dall'autosave con debounce del client.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    const body = (await req.json()) as UpdateFascicoloInput;
    const fascicolo = await updateFascicolo(numero, body);
    return NextResponse.json({ fascicolo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// Cancellazione definitiva: nessuna scorciatoia dall'archivio, solo dalla
// scheda del fascicolo (vedi FascicoloEditorClient), con doppia conferma.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { numero } = await params;
    await deleteFascicolo(numero);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
