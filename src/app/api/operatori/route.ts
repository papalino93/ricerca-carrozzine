import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { addOperatore, listOperatori, removeOperatore } from "@/lib/operatori";

export const runtime = "nodejs";

// Serve al menu "Operatore" di Commesse (richiede comunque login, vedi proxy.ts).
export async function GET() {
  try {
    const operatori = await listOperatori();
    return NextResponse.json({ operatori });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Scrittura: riservata all'amministrazione, come per le categorie.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { nome } = (await req.json()) as { nome: string };
    const operatori = await addOperatore(nome);
    return NextResponse.json({ operatori });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const nome = req.nextUrl.searchParams.get("nome");
    if (!nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const operatori = await removeOperatore(nome);
    return NextResponse.json({ operatori });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
