import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { importClientsCsv, listClients } from "@/lib/clients";

export const runtime = "nodejs";

// Import manuale dall'export CSV di fedelta.store (anagrafica + numero
// tessera fedeltà): l'operatore carica il file da Impostazioni > Clienti,
// niente di automatico o programmato, così un export sbagliato non scrive
// mai nulla senza che qualcuno l'abbia scelto apposta.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file ricevuto" }, { status: 400 });
    }
    const csvText = await file.text();
    const result = await importClientsCsv(csvText);
    const clients = await listClients();
    return NextResponse.json({ ...result, clients });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
