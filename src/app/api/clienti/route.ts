import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { deleteClient } from "@/lib/clients";

export const runtime = "nodejs";

// Riservata all'amministrazione: elimina una riga dall'anagrafica clienti
// (es. un cliente creato per errore). L'anagrafica si popola da sola a ogni
// noleggio (vedi upsertClient in clients.ts): qui serve solo la correzione.
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const nome = req.nextUrl.searchParams.get("nome");
    if (!nome) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const clients = await deleteClient(nome);
    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
