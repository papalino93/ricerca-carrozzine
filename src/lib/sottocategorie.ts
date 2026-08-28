import "server-only";
import { readSheet, writeSheet } from "./sheets";

const TAB = "Sottocategorie";
const HEADER = ["Categoria", "Sottocategoria"];

export interface SottocategoriaRow {
  categoria: string;
  nome: string;
}

function sameKey(a: SottocategoriaRow, b: { categoria: string; nome: string }): boolean {
  return (
    a.categoria.trim().toLowerCase() === b.categoria.trim().toLowerCase() &&
    a.nome.trim().toLowerCase() === b.nome.trim().toLowerCase()
  );
}

async function readAll(): Promise<SottocategoriaRow[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .map((row) => ({ categoria: row[0] ?? "", nome: row[1] ?? "" }))
    .filter((r) => r.categoria.trim() && r.nome.trim());
}

async function saveAll(rows: SottocategoriaRow[]): Promise<void> {
  await writeSheet(TAB, [HEADER, ...rows.map((r) => [r.categoria, r.nome])]);
}

/**
 * Elenco autorevole delle sottocategorie di ogni categoria, gestito da
 * Impostazioni → Categorie. A differenza del vecchio elenco (dedotto dai
 * dispositivi esistenti), una sottocategoria può esistere qui prima ancora
 * che un ausilio la usi: è così che si "implementa" una sottocategoria
 * nuova prima di assegnarla a qualcosa.
 */
export async function listSottocategorie(categoria?: string): Promise<SottocategoriaRow[]> {
  const all = await readAll();
  if (!categoria) return all;
  const clean = categoria.trim().toLowerCase();
  return all.filter((r) => r.categoria.trim().toLowerCase() === clean);
}

export async function addSottocategoria(categoria: string, nome: string): Promise<SottocategoriaRow[]> {
  const cleanCat = categoria.trim();
  const cleanNome = nome.trim();
  if (!cleanCat) throw new Error("La categoria è obbligatoria");
  if (!cleanNome) throw new Error("Il nome della sottocategoria è obbligatorio");
  const all = await readAll();
  if (all.some((r) => sameKey(r, { categoria: cleanCat, nome: cleanNome }))) {
    throw new Error(`Esiste già la sottocategoria "${cleanNome}" in "${cleanCat}"`);
  }
  const next = [...all, { categoria: cleanCat, nome: cleanNome }];
  await saveAll(next);
  return next;
}

/** Rinomina una sottocategoria. NON tocca dispositivi o tariffe: quella
 * parte spetta a chi chiama (vedi renameDeviceSottocategoria in devices.ts
 * e renameTariffaSottocategoria in tariffe.ts), così questo modulo non deve
 * conoscere gli altri fogli. */
export async function renameSottocategoria(
  categoria: string,
  nome: string,
  nuovoNome: string
): Promise<SottocategoriaRow[]> {
  const cleanNuovo = nuovoNome.trim();
  if (!cleanNuovo) throw new Error("Il nuovo nome è obbligatorio");
  const all = await readAll();
  const idx = all.findIndex((r) => sameKey(r, { categoria, nome }));
  if (idx < 0) throw new Error(`Sottocategoria "${nome}" non trovata in "${categoria}"`);
  if (all.some((r, i) => i !== idx && sameKey(r, { categoria, nome: cleanNuovo }))) {
    throw new Error(`Esiste già la sottocategoria "${cleanNuovo}" in "${categoria}"`);
  }
  all[idx] = { ...all[idx], nome: cleanNuovo };
  await saveAll(all);
  return all;
}

export async function removeSottocategoria(categoria: string, nome: string): Promise<SottocategoriaRow[]> {
  const all = await readAll();
  const next = all.filter((r) => !sameKey(r, { categoria, nome }));
  await saveAll(next);
  return next;
}
