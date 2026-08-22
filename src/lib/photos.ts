import "server-only";
import { randomBytes } from "crypto";
import { appendRow, deleteRows, readRange } from "./sheets";

/**
 * Metadati di una foto della galleria, SENZA l'immagine.
 *
 * L'immagine (un data URI da ~45.000 caratteri) si recupera a parte con
 * `getDevicePhotoImage`: tenerla fuori dagli elenchi è ciò che impedisce a
 * questa funzionalità di diventare inutilizzabile quando il magazzino si
 * riempie di foto.
 */
export interface DevicePhotoMeta {
  /** Identificativo della singola foto, per poterla recuperare o rimuovere. */
  id: string;
  codice: string;
  /** Etichetta libera (es. Laterale, Etichetta, Difetto). */
  tipo: string;
  /** Data di caricamento, ISO yyyy-mm-dd. */
  data: string;
}

const TAB = "Foto";
const HEADER = ["Id", "Codice", "Tipo", "Immagine", "Data"];

/**
 * Tetto al numero di foto aggiuntive per dispositivo. Ogni foto occupa una
 * cella da ~30-45k caratteri: senza un limite il foglio diventerebbe
 * rapidamente lentissimo da leggere e scrivere.
 */
export const MAX_PHOTOS_PER_DEVICE = 8;

/**
 * Legge le sole colonne leggere (Id, Codice, Tipo) più la Data, saltando
 * del tutto la colonna D che contiene le immagini. Restituisce anche il
 * numero di riga nel foglio, che serve per eliminazioni mirate.
 */
async function readPhotoMeta(): Promise<(DevicePhotoMeta & { row: number })[]> {
  // Due letture strette invece di una pesante: A:C (id, codice, tipo) e E:E
  // (data). La colonna D (immagine) non viene mai scaricata qui.
  const [abc, e] = await Promise.all([readRange(`${TAB}!A:C`), readRange(`${TAB}!E:E`)]);

  const out: (DevicePhotoMeta & { row: number })[] = [];
  for (let i = 1; i < abc.length; i++) {
    const [id, codice, tipo] = abc[i] ?? [];
    if (!id || !codice) continue;
    out.push({
      id,
      codice,
      tipo: tipo || "",
      data: e[i]?.[0] || "",
      row: i + 1, // riga nel foglio, base 1 (riga 1 = intestazione)
    });
  }
  return out;
}

/** Metadati delle foto di un dispositivo, dalla più vecchia alla più recente. */
export async function listDevicePhotos(codice: string): Promise<DevicePhotoMeta[]> {
  const all = await readPhotoMeta();
  return all
    .filter((p) => p.codice === codice)
    .map(({ id, codice: c, tipo, data }) => ({ id, codice: c, tipo, data }));
}

/**
 * Recupera l'immagine di una singola foto come data URI.
 *
 * Prima individua la riga leggendo solo le colonne id/codice, poi scarica
 * quell'unica cella: si porta a casa una sola immagine invece di tutte.
 */
export async function getDevicePhotoImage(codice: string, id: string): Promise<string | null> {
  const all = await readPhotoMeta();
  const found = all.find((p) => p.id === id && p.codice === codice);
  if (!found) return null;
  const cell = await readRange(`${TAB}!D${found.row}`);
  return cell[0]?.[0] || null;
}

export async function addDevicePhoto(input: {
  codice: string;
  tipo: string;
  immagine: string;
}): Promise<DevicePhotoMeta[]> {
  const all = await readPhotoMeta();
  const own = all.filter((p) => p.codice === input.codice);
  if (own.length >= MAX_PHOTOS_PER_DEVICE) {
    throw new Error(
      `Massimo ${MAX_PHOTOS_PER_DEVICE} foto aggiuntive per dispositivo: rimuovine una prima di aggiungerne altre.`
    );
  }
  const photo: DevicePhotoMeta = {
    id: randomBytes(8).toString("hex"),
    codice: input.codice,
    tipo: input.tipo.trim(),
    data: new Date().toISOString().slice(0, 10),
  };
  // Accoda una sola riga: nessuna rilettura né riscrittura delle immagini
  // già presenti (che con il magazzino pieno erano oltre 10 MB per volta).
  await appendRow(
    TAB,
    [photo.id, photo.codice, photo.tipo, input.immagine, photo.data],
    HEADER
  );
  return [...own, photo].map(({ id, codice, tipo, data }) => ({ id, codice, tipo, data }));
}

export async function removeDevicePhoto(
  codice: string,
  id: string
): Promise<DevicePhotoMeta[]> {
  const all = await readPhotoMeta();
  // Il confronto include il codice: senza, l'id di una foto di un ALTRO
  // dispositivo la cancellava comunque.
  const target = all.find((p) => p.id === id && p.codice === codice);
  if (!target) throw new Error("Foto non trovata");

  await deleteRows(TAB, [target.row]);
  return all
    .filter((p) => p.codice === codice && p.id !== id)
    .map(({ id: i, codice: c, tipo, data }) => ({ id: i, codice: c, tipo, data }));
}

/** Rimuove tutte le foto di un dispositivo (usata quando il dispositivo viene eliminato). */
export async function removeAllDevicePhotos(codice: string): Promise<void> {
  const all = await readPhotoMeta();
  const rows = all.filter((p) => p.codice === codice).map((p) => p.row);
  if (rows.length === 0) return;
  await deleteRows(TAB, rows);
}
