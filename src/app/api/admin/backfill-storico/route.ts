import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { listDevices } from "@/lib/devices";
import { appendHistoryEvent, listHistory } from "@/lib/history";

export const runtime = "nodejs";

// Migrazione una tantum: alcuni noleggi attivi risalgono a prima che il
// ciclo di vita fosse blindato (punto D dell'audit) e non hanno mai scritto
// un evento "noleggio" nello Storico (probabilmente creati a mano sul
// foglio). Ricostruisce quell'evento dai dati già presenti sul dispositivo,
// solo per i dispositivi noleggiati che risultano SENZA alcun evento
// storico — non tocca nulla per chi ha già uno storico coerente. Da
// rimuovere dopo l'uso: non è una funzionalità permanente.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  const devices = await listDevices();
  const result: { codice: string; azione: string }[] = [];

  for (const d of devices) {
    if (d.stato !== "noleggiato") continue;
    const existing = await listHistory(d.codice);
    if (existing.length > 0) {
      result.push({ codice: d.codice, azione: "saltato: ha già storico" });
      continue;
    }
    if (!d.cliente || !d.dal) {
      result.push({ codice: d.codice, azione: "saltato: dati insufficienti (manca cliente o dal)" });
      continue;
    }
    await appendHistoryEvent({
      data: d.dal,
      codice: d.codice,
      evento: "noleggio",
      cliente: d.cliente,
      telefono: d.telefono,
      contratto: d.contratto,
      nota: null,
    });
    result.push({ codice: d.codice, azione: "storico ricostruito" });
  }

  return NextResponse.json({ result });
}
