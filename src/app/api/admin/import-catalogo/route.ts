import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { addCategory, listCategories } from "@/lib/categories";
import { listDevices, saveAllDevices } from "@/lib/devices";
import { NEW_CATEGORIES, NEW_DEVICES } from "./data";

export const runtime = "nodejs";

// Migrazione una tantum: importa il catalogo (senza storico noleggi) dei 70
// dispositivi non-carrozzine forniti dall'utente. Da rimuovere insieme a
// data.ts subito dopo l'esecuzione, come la precedente migrazione storico.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const existing = await listDevices();
    const existingCodes = new Set(existing.map((d) => d.codice));
    const collisions = NEW_DEVICES.filter((d) => existingCodes.has(d.codice));
    if (collisions.length > 0) {
      return NextResponse.json(
        { error: `Codici già esistenti, importazione annullata: ${collisions.map((d) => d.codice).join(", ")}` },
        { status: 400 }
      );
    }

    let categories = await listCategories();
    const added: string[] = [];
    for (const nome of NEW_CATEGORIES) {
      if (!categories.some((c) => c.toLowerCase() === nome.toLowerCase())) {
        categories = await addCategory(nome);
        added.push(nome);
      }
    }

    const all = [...existing, ...NEW_DEVICES];
    await saveAllDevices(all);

    return NextResponse.json({
      categorieAggiunte: added,
      dispositiviImportati: NEW_DEVICES.length,
      totaleDispositivi: all.length,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
