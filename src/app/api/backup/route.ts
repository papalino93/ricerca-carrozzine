import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { createSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";
// Legge una dozzina di tab e ne scrive il backup in un colpo solo: più
// margine di prima, che bastava per il solo magazzino.
export const maxDuration = 60;

/**
 * Chiamata una volta al giorno da Vercel Cron (vedi vercel.json), autenticata
 * con CRON_SECRET (impostare la stessa variabile d'ambiente su Vercel: la
 * invia automaticamente come header Authorization sulle chiamate cron).
 * Un amministratore può anche richiamarla a mano con le solite credenziali,
 * per un backup fuori programma o per verificare che funzioni — vedi
 * proxy.ts per l'eccezione che lascia passare la chiamata del cron.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = Boolean(cronSecret) && req.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!isCron) {
    const unauthorized = await requireBasicAuth(req);
    if (unauthorized) return unauthorized;
  }

  try {
    const result = await createSnapshot();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
