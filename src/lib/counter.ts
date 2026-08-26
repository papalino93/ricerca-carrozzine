import "server-only";
import { readSheet, writeSheet } from "./sheets";

const TAB = "Contatori";
const HEADER = ["Chiave", "Valore"];
const KEY_NOLEGGIO = "numeroNoleggio";

// Primo numero progressivo assegnato: i noleggi già in corso prima di questa
// funzione hanno numeri di contratto manuali più bassi (max osservato in
// magazzino ~8150), quindi non c'è rischio di collisione partendo da 10000.
const START = 10000;

/**
 * Prossimo numero progressivo di noleggio, condiviso da tutti i dispositivi
 * (non riparte da 1 per categoria/dispositivo) — sostituisce il numero di
 * contratto digitato a mano dall'operatore.
 *
 * Letto, incrementato e riscritto in un'unica chiamata sequenziale: Google
 * Sheets non offre transazioni, quindi due conferme di noleggio praticamente
 * nello stesso istante potrebbero in teoria leggere lo stesso valore prima
 * che l'incremento sia scritto. Rischio accettato: un solo punto vendita,
 * poche conferme al giorno, non un'app multi-utente ad alto traffico.
 */
export async function nextNumeroNoleggio(): Promise<string> {
  const rows = await readSheet(TAB);
  const current = Number(rows[1]?.[1]);
  const base = Number.isFinite(current) && current >= START - 1 ? current : START - 1;
  const next = base + 1;
  await writeSheet(TAB, [HEADER, [KEY_NOLEGGIO, String(next)]]);
  return String(next);
}
