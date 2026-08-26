import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { adjustClientPunti, deleteClient } from "@/lib/clients";

export const runtime = "nodejs";

// Rettifica manuale dei punti fedeltà (es. una vendita non passata da
// Commesse, o una correzione): {nome, delta}. L'accredito automatico da una
// commessa ritirata resta in commesse.ts, questo serve solo per i casi che
// il flusso automatico non copre.
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { nome, delta } = (await req.json()) as { nome?: string; delta?: number };
    if (!nome || !Number.isFinite(delta)) {
      return NextResponse.json({ error: "Nome e delta obbligatori" }, { status: 400 });
    }
    const clients = await adjustClientPunti(nome, Math.trunc(delta as number));
    return NextResponse.json({ clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

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
