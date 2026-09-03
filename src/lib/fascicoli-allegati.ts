import "server-only";
import { randomBytes } from "crypto";
import { appendRow, deleteRows, readRange } from "./sheets";
// La costante MAX_ALLEGATI_PER_FASCICOLO vive in fascicoli-types.ts (senza
// "server-only"): questo file la usa ma non la ridefinisce né la
// ri-esporta, perché un componente client che la importasse DA QUI
// trascinerebbe con sé "server-only" e fallirebbe in build.
import { MAX_ALLEGATI_PER_FASCICOLO } from "./fascicoli-types";

/**
 * Metadati di un allegato del fascicolo (prescrizione medica, autorizzazione
 * ASL, altra documentazione), SENZA il contenuto pesante.
 *
 * Due formati, a seconda di come arriva il file:
 * - "immagine": il contenuto è un data URI dentro il foglio stesso (come
 *   photos.ts), va bene per una foto/scansione singola.
 * - "pdf": il file resta troppo grande per una cella di Google Sheets (il
 *   limite è ~50.000 caratteri, e un PDF multipagina in base64 lo supera
 *   facilmente) — viene caricato su Drive e qui si tiene solo il link.
 */
export interface FascicoloAllegatoMeta {
  id: string;
  numero: string;
  /** Etichetta libera (es. "Prescrizione medica", "Autorizzazione ASL"). */
  etichetta: string;
  /** Nome del file originale, per mostrarlo in elenco e nel download. */
  nome: string;
  formato: "immagine" | "pdf";
  /** Link Drive, solo per formato "pdf". */
  driveUrl: string | null;
  /** Data di caricamento, ISO yyyy-mm-dd. */
  data: string;
}

const TAB = "AllegatiFascicoli";
const HEADER = ["Id", "Numero", "Etichetta", "Nome", "Formato", "Immagine", "DriveUrl", "Data"];

/**
 * Legge le sole colonne leggere, saltando la colonna F (Immagine) che
 * contiene il data URI: due letture strette (A:E e G:H) invece di una
 * pesante che scaricherebbe ogni volta tutte le immagini di ogni fascicolo.
 */
async function readAllegatiMeta(): Promise<(FascicoloAllegatoMeta & { row: number })[]> {
  const [ae, gh] = await Promise.all([readRange(`${TAB}!A:E`), readRange(`${TAB}!G:H`)]);

  const out: (FascicoloAllegatoMeta & { row: number })[] = [];
  for (let i = 1; i < ae.length; i++) {
    const [id, numero, etichetta, nome, formato] = ae[i] ?? [];
    if (!id || !numero) continue;
    const [driveUrl, data] = gh[i] ?? [];
    out.push({
      id,
      numero,
      etichetta: etichetta || "",
      nome: nome || "",
      formato: formato === "pdf" ? "pdf" : "immagine",
      driveUrl: driveUrl || null,
      data: data || "",
      row: i + 1, // riga nel foglio, base 1 (riga 1 = intestazione)
    });
  }
  return out;
}

/** Metadati degli allegati di un fascicolo, dal più vecchio al più recente. */
export async function listFascicoloAllegati(numero: string): Promise<FascicoloAllegatoMeta[]> {
  const all = await readAllegatiMeta();
  return all
    .filter((a) => a.numero === numero)
    .map(({ id, numero: n, etichetta, nome, formato, driveUrl, data }) => ({
      id,
      numero: n,
      etichetta,
      nome,
      formato,
      driveUrl,
      data,
    }));
}

/**
 * Recupera l'immagine di un allegato come data URI. Solo per formato
 * "immagine": i PDF vivono su Drive e si aprono dal loro link, non da qui.
 */
export async function getFascicoloAllegatoImmagine(numero: string, id: string): Promise<string | null> {
  const all = await readAllegatiMeta();
  const found = all.find((a) => a.id === id && a.numero === numero && a.formato === "immagine");
  if (!found) return null;
  const cell = await readRange(`${TAB}!F${found.row}`);
  return cell[0]?.[0] || null;
}

async function assertRoom(numero: string) {
  const all = await readAllegatiMeta();
  const own = all.filter((a) => a.numero === numero);
  if (own.length >= MAX_ALLEGATI_PER_FASCICOLO) {
    throw new Error(
      `Massimo ${MAX_ALLEGATI_PER_FASCICOLO} allegati per fascicolo: rimuovine uno prima di aggiungerne altri.`
    );
  }
}

export async function addFascicoloAllegatoImmagine(input: {
  numero: string;
  etichetta: string;
  nome: string;
  immagine: string;
}): Promise<FascicoloAllegatoMeta[]> {
  await assertRoom(input.numero);
  const allegato: FascicoloAllegatoMeta = {
    id: randomBytes(8).toString("hex"),
    numero: input.numero,
    etichetta: input.etichetta.trim(),
    nome: input.nome,
    formato: "immagine",
    driveUrl: null,
    data: new Date().toISOString().slice(0, 10),
  };
  await appendRow(
    TAB,
    [allegato.id, allegato.numero, allegato.etichetta, allegato.nome, "immagine", input.immagine, "", allegato.data],
    HEADER
  );
  return listFascicoloAllegati(input.numero);
}

export async function addFascicoloAllegatoPdf(input: {
  numero: string;
  etichetta: string;
  nome: string;
  driveUrl: string;
}): Promise<FascicoloAllegatoMeta[]> {
  await assertRoom(input.numero);
  const allegato: FascicoloAllegatoMeta = {
    id: randomBytes(8).toString("hex"),
    numero: input.numero,
    etichetta: input.etichetta.trim(),
    nome: input.nome,
    formato: "pdf",
    driveUrl: input.driveUrl,
    data: new Date().toISOString().slice(0, 10),
  };
  await appendRow(
    TAB,
    [allegato.id, allegato.numero, allegato.etichetta, allegato.nome, "pdf", "", input.driveUrl, allegato.data],
    HEADER
  );
  return listFascicoloAllegati(input.numero);
}

export async function removeFascicoloAllegato(numero: string, id: string): Promise<FascicoloAllegatoMeta[]> {
  const all = await readAllegatiMeta();
  // Il confronto include il numero: senza, l'id di un allegato di un ALTRO
  // fascicolo lo cancellava comunque.
  const target = all.find((a) => a.id === id && a.numero === numero);
  if (!target) throw new Error("Allegato non trovato");

  await deleteRows(TAB, [target.row]);
  // Il file PDF eventualmente già caricato su Drive non viene rimosso da
  // qui: resta lì, orfano ma innocuo, invece di rischiare di cancellare un
  // documento condiviso o riusato altrove.
  return all.filter((a) => a.numero === numero && a.id !== id);
}

/** Rimuove tutti gli allegati di un fascicolo (usata quando il fascicolo viene eliminato). */
export async function removeAllFascicoloAllegati(numero: string): Promise<void> {
  const all = await readAllegatiMeta();
  const rows = all.filter((a) => a.numero === numero).map((a) => a.row);
  if (rows.length === 0) return;
  await deleteRows(TAB, rows);
}
