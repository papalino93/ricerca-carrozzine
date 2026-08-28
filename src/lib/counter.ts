import "server-only";
import { readSheet, writeSheet } from "./sheets";

const TAB = "Contatori";
const HEADER = ["Chiave", "Valore"];
const KEY_NOLEGGIO = "numeroNoleggio";
const KEY_COMMESSA = "numeroCommessa";
const KEY_FIDELITY = "numeroFidelity";

// Primo numero progressivo assegnato: i noleggi già in corso prima di questa
// funzione hanno numeri di contratto manuali più bassi (max osservato in
// magazzino ~8150), quindi non c'è rischio di collisione partendo da 10000.
const START_NOLEGGIO = 10000;

// Le schede commessa cartacee non avevano un numero già assegnato quando
// digitalizzate (campo lasciato in bianco sul modulo): si parte da 1.
const START_COMMESSA = 1;

// Le tessere fedeltà create da qui in poi partono da 1: il prefisso "MC-"
// le distingue subito da quelle importate dal vecchio sistema
// (fedelta.store), che sono numeriche o esadecimali pure e non usano mai
// lettere+trattino — zero rischio di collisione.
const START_FIDELITY = 1;

// I fascicoli plantari ripartono da 1 ogni anno solare (PL-2026-0001,
// PL-2026-0048, poi PL-2027-0001...): la chiave del contatore include
// l'anno, così nextCounter tiene naturalmente una riga per anno nella tab
// "Contatori" invece di dover azzerare manualmente qualcosa a capodanno.
const START_FASCICOLO = 1;

/**
 * Prossimo valore di un contatore condiviso, identificato da `key` (righe
 * multiple nella stessa tab "Contatori", non una tab per contatore).
 *
 * Letto, incrementato e riscritto in un'unica chiamata sequenziale: Google
 * Sheets non offre transazioni, quindi due conferme praticamente nello
 * stesso istante potrebbero in teoria leggere lo stesso valore prima che
 * l'incremento sia scritto. Rischio accettato: un solo punto vendita, poche
 * conferme al giorno, non un'app multi-utente ad alto traffico.
 */
async function nextCounter(key: string, start: number): Promise<string> {
  const rows = await readSheet(TAB);
  const body = rows.slice(1).filter((row) => row.length > 0 && row[0]);
  const idx = body.findIndex((row) => row[0] === key);
  const current = idx >= 0 ? Number(body[idx][1]) : NaN;
  const base = Number.isFinite(current) && current >= start - 1 ? current : start - 1;
  const next = base + 1;
  const nextRow = [key, String(next)];
  if (idx >= 0) body[idx] = nextRow;
  else body.push(nextRow);
  await writeSheet(TAB, [HEADER, ...body]);
  return String(next);
}

/** Numero progressivo di noleggio, condiviso da tutti i dispositivi (non
 * riparte da 1 per categoria/dispositivo) — sostituisce il numero di
 * contratto digitato a mano dall'operatore. */
export async function nextNumeroNoleggio(): Promise<string> {
  return nextCounter(KEY_NOLEGGIO, START_NOLEGGIO);
}

/** Numero progressivo di scheda commessa (vedi commesse.ts). */
export async function nextNumeroCommessa(): Promise<string> {
  return nextCounter(KEY_COMMESSA, START_COMMESSA);
}

/** Numero di tessera fedeltà per una nuova iscrizione: assegnato
 * dall'app, mai digitato dall'operatore, per garantirne l'unicità. */
export async function nextNumeroFidelity(): Promise<string> {
  const n = await nextCounter(KEY_FIDELITY, START_FIDELITY);
  return `MC-${n.padStart(6, "0")}`;
}

/** Numero progressivo di fascicolo plantare (es. PL-2026-0001), assegnato
 * dall'app: mai digitato dall'operatore, evita sia i duplicati sia una
 * numerazione manuale da tenere a mente. */
export async function nextNumeroFascicolo(anno: number): Promise<string> {
  const n = await nextCounter(`numeroFascicolo:${anno}`, START_FASCICOLO);
  return `PL-${anno}-${n.padStart(4, "0")}`;
}
