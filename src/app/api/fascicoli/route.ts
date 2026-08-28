import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { createFascicolo, listFascicoli } from "@/lib/fascicoli";
import type { FascicoloContenuto } from "@/lib/fascicoli-types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const fascicoli = await listFascicoli();
    return NextResponse.json({ fascicoli });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Crea un nuovo fascicolo per un cliente (già esistente o appena creato in
// anagrafica dal chiamante). "contenutoIniziale" è usato dalla duplicazione
// intelligente ("Nuovo fascicolo per questo cliente"): il chiamante vi
// passa al più dati di contatto/anagrafici, MAI informazioni cliniche —
// quelle vanno sempre confermate/ricompilate dall'operatore per il nuovo
// fascicolo.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as {
      clienteNome?: string;
      clienteCF?: string | null;
      commessa?: string | null;
      tipoDispositivo?: string;
      operatore?: string | null;
      contenutoIniziale?: Partial<FascicoloContenuto>;
    };
    if (!body.clienteNome?.trim()) {
      return NextResponse.json({ error: "Cliente obbligatorio" }, { status: 400 });
    }
    const fascicolo = await createFascicolo({
      clienteNome: body.clienteNome,
      clienteCF: body.clienteCF ?? null,
      commessa: body.commessa ?? null,
      tipoDispositivo: body.tipoDispositivo,
      operatore: body.operatore ?? null,
      contenutoIniziale: body.contenutoIniziale,
    });
    return NextResponse.json({ fascicolo });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
