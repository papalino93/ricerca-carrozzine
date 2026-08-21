import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { listDevices, saveAllDevices } from "./devices";

const TAB = "Categorie";
const HEADER = ["Nome"];

async function readCategories(): Promise<string[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .map((row) => row[0])
    .filter((v): v is string => Boolean(v && v.trim()));
}

/**
 * Elenco delle categorie gestite da Impostazioni. Se il foglio è vuoto (mai
 * inizializzato: questa è la prima richiesta dopo il rilascio della
 * funzione categorie), lo si popola con "Carrozzine" e si assegna questa
 * categoria a tutti i dispositivi già presenti in magazzino — finora erano
 * tutte carrozzine, distinte solo da un campo categoria libero (es. "Mag
 * Autospinta"). È una migrazione singola: una volta scritto il foglio
 * Categorie questo blocco non viene più eseguito.
 */
export async function listCategories(): Promise<string[]> {
  const categories = await readCategories();
  if (categories.length > 0) return categories;

  await writeSheet(TAB, [HEADER, ["Carrozzine"]]);
  const devices = await listDevices();
  if (devices.some((d) => d.categoria !== "Carrozzine")) {
    await saveAllDevices(devices.map((d) => ({ ...d, categoria: "Carrozzine" })));
  }
  return ["Carrozzine"];
}

export async function addCategory(nome: string): Promise<string[]> {
  const clean = nome.trim();
  if (!clean) throw new Error("Il nome della categoria è obbligatorio");
  const categories = await listCategories();
  if (categories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Esiste già una categoria "${clean}"`);
  }
  const next = [...categories, clean];
  await writeSheet(TAB, [HEADER, ...next.map((c) => [c])]);
  return next;
}

export async function removeCategory(nome: string): Promise<string[]> {
  const categories = await listCategories();
  const next = categories.filter((c) => c.toLowerCase() !== nome.trim().toLowerCase());
  await writeSheet(TAB, [HEADER, ...next.map((c) => [c])]);
  return next;
}
