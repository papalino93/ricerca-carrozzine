import "server-only";
import { randomBytes } from "crypto";
import { readSheet, writeSheet } from "./sheets";

export interface DevicePhoto {
  /** Identificativo della singola foto, per poterla rimuovere. */
  id: string;
  codice: string;
  /** Etichetta libera (es. Laterale, Etichetta, Difetto). */
  tipo: string;
  /** Immagine come data URI (vedi image-to-data-uri.ts). */
  immagine: string;
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

function toPhoto(row: string[]): DevicePhoto {
  const [id, codice, tipo, immagine, data] = row;
  return {
    id: id ?? "",
    codice: codice ?? "",
    tipo: tipo || "",
    immagine: immagine ?? "",
    data: data || "",
  };
}

function toRow(p: DevicePhoto): string[] {
  return [p.id, p.codice, p.tipo, p.immagine, p.data];
}

async function readPhotos(): Promise<DevicePhoto[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .filter((row) => row.length > 0 && row[0] && row[1])
    .map(toPhoto);
}

/** Foto aggiuntive di un dispositivo, dalla più vecchia alla più recente. */
export async function listDevicePhotos(codice: string): Promise<DevicePhoto[]> {
  const photos = await readPhotos();
  return photos.filter((p) => p.codice === codice);
}

export async function addDevicePhoto(input: {
  codice: string;
  tipo: string;
  immagine: string;
}): Promise<DevicePhoto[]> {
  const photos = await readPhotos();
  const own = photos.filter((p) => p.codice === input.codice);
  if (own.length >= MAX_PHOTOS_PER_DEVICE) {
    throw new Error(
      `Massimo ${MAX_PHOTOS_PER_DEVICE} foto aggiuntive per dispositivo: rimuovine una prima di aggiungerne altre.`
    );
  }
  const photo: DevicePhoto = {
    id: randomBytes(8).toString("hex"),
    codice: input.codice,
    tipo: input.tipo.trim(),
    immagine: input.immagine,
    data: new Date().toISOString().slice(0, 10),
  };
  const next = [...photos, photo];
  await writeSheet(TAB, [HEADER, ...next.map(toRow)]);
  return next.filter((p) => p.codice === input.codice);
}

export async function removeDevicePhoto(codice: string, id: string): Promise<DevicePhoto[]> {
  const photos = await readPhotos();
  const next = photos.filter((p) => p.id !== id);
  if (next.length === photos.length) {
    throw new Error("Foto non trovata");
  }
  await writeSheet(TAB, [HEADER, ...next.map(toRow)]);
  return next.filter((p) => p.codice === codice);
}

/** Rimuove tutte le foto di un dispositivo (usata quando il dispositivo viene eliminato). */
export async function removeAllDevicePhotos(codice: string): Promise<void> {
  const photos = await readPhotos();
  const next = photos.filter((p) => p.codice !== codice);
  if (next.length === photos.length) return;
  await writeSheet(TAB, [HEADER, ...next.map(toRow)]);
}
