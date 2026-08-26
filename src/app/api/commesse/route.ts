import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import {
  createCommessa,
  deleteCommessa,
  listCommesse,
  updateCommessa,
  type CommessaRecord,
} from "@/lib/commesse";

export const runtime = "nodejs";

// Riservata all'amministrazione, sempre: a differenza dei dispositivi, le
// commesse non hanno una vista pubblica (niente ricerca clienti su questo).
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const commesse = await listCommesse();
    return NextResponse.json({ commesse });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Crea una nuova commessa: il numero è assegnato qui (progressivo), non
// dal chiamante.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as Omit<CommessaRecord, "numero" | "stato" | "creata">;
    if (!body.committente?.trim()) {
      return NextResponse.json({ error: "Committente obbligatorio" }, { status: 400 });
    }
    const commessa = await createCommessa(body);
    const commesse = await listCommesse();
    return NextResponse.json({ commessa, commesse });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Aggiorna una commessa esistente (stato, esito, date di consegna/ritiro,
// ecc.): il body deve contenere "numero" più i soli campi da cambiare.
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as { numero: string } & Partial<CommessaRecord>;
    if (!body.numero) {
      return NextResponse.json({ error: "Numero obbligatorio" }, { status: 400 });
    }
    const { numero, ...patch } = body;
    await updateCommessa(numero, patch);
    const commesse = await listCommesse();
    return NextResponse.json({ commesse });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const numero = req.nextUrl.searchParams.get("numero");
    if (!numero) {
      return NextResponse.json({ error: "Numero obbligatorio" }, { status: 400 });
    }
    const commesse = await deleteCommessa(numero);
    return NextResponse.json({ commesse });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
