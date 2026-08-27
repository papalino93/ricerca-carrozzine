import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { readSheet } from "@/lib/sheets";
import { listClients } from "@/lib/clients";

export const runtime = "nodejs";
export const maxDuration = 60;

// ROTTA TEMPORANEA DI VERIFICA — da eliminare subito dopo l'uso.
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;
  try {
    const rows = await readSheet("BackupCompleto");
    const oggi = new Date().toISOString().slice(0, 10);
    const righeOggi = rows.slice(1).filter((r) => r[0] === oggi);

    const risultato: Record<string, unknown> = { righeTotali: rows.length, righeOggi: righeOggi.length };

    // Ricompone la tab Clienti dai suoi eventuali pezzi e la confronta con
    // la lettura diretta della tab vera.
    const pezziClienti = righeOggi
      .filter((r) => r[1] === "Clienti")
      .sort((a, b) => Number(a[2]) - Number(b[2]));
    const jsonRicomposto = pezziClienti.map((r) => r[4]).join("");
    const clientiRicostruiti = JSON.parse(jsonRicomposto) as string[][];
    const clientiVeri = await listClients();

    risultato.clienti = {
      parti: pezziClienti.length,
      righeNelBackup: clientiRicostruiti.length - 1, // esclude l'header
      clientiVeriAttuali: clientiVeri.length,
      primoCliente: clientiRicostruiti[1]?.[0] ?? null,
      ultimoCliente: clientiRicostruiti[clientiRicostruiti.length - 1]?.[0] ?? null,
    };

    // Controllo veloce anche su una tab piccola, per sicurezza.
    const pezziContatori = righeOggi.filter((r) => r[1] === "Contatori");
    risultato.contatori = {
      parti: pezziContatori.length,
      contenuto: pezziContatori[0] ? JSON.parse(pezziContatori[0][4]) : null,
    };

    return NextResponse.json(risultato);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
