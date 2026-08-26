import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { adjustClientPunti, createClient, deleteClient } from "@/lib/clients";

export const runtime = "nodejs";

// Crea un nuovo cliente in anagrafica (es. nuova iscrizione fidelity senza
// che sia già passato da un noleggio o una commessa).
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as {
      nome?: string;
      cellulare?: string | null;
      email?: string | null;
      indirizzo?: string | null;
    };
    if (!body.nome || !body.nome.trim()) {
      return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });
    }
    const { client, clients } = await createClient({
      nome: body.nome,
      cellulare: body.cellulare || null,
      email: body.email || null,
      indirizzo: body.indirizzo || null,
    });
    return NextResponse.json({ client, clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

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
