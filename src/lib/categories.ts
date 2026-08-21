import "server-only";
import { readSheet, writeSheet } from "./sheets";

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
 * Elenco delle categorie gestite da Impostazioni. Se il foglio è vuoto lo si
 * popola con un valore di default ("Carrozzine").
 *
 * ATTENZIONE: questa funzione NON deve più toccare la tab Dispositivi. In
 * origine (migrazione singola, ormai eseguita) un foglio Categorie vuoto
 * veniva interpretato come "prima esecuzione dopo il rilascio della
 * funzione categorie" e usato per riscrivere la categoria di ogni
 * dispositivo esistente. Il problema: "il foglio Categorie è vuoto" può
 * accadere anche per altri motivi (una scrittura falita a metà, l'ultima
 * categoria eliminata, la tab rinominata) — in quei casi la vecchia logica
 * avrebbe azzerato la categoria di TUTTI i dispositivi in magazzino. Qui ci
 * si limita a garantire che la lista non sia mai vuota.
 */
export async function listCategories(): Promise<string[]> {
  const categories = await readCategories();
  if (categories.length > 0) return categories;

  await writeSheet(TAB, [HEADER, ["Carrozzine"]]);
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
