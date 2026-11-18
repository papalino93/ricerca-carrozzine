import "server-only";
import { readSheet, writeSheet } from "./sheets";

/**
 * Elenco del personale selezionabile come "Operatore" nelle commesse (vedi
 * CommesseBanco/CommesseClient), gestito da Impostazioni → Utenti: scegliere
 * da una lista invece di digitare il nome ogni volta è più veloce ed evita
 * refusi che spezzettano le statistiche per operatore in futuro.
 */

const TAB = "Operatori";
const HEADER = ["Nome"];

async function readOperatori(): Promise<string[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .map((row) => row[0])
    .filter((v): v is string => Boolean(v && v.trim()));
}

export async function listOperatori(): Promise<string[]> {
  return readOperatori();
}

export async function addOperatore(nome: string): Promise<string[]> {
  const clean = nome.trim();
  if (!clean) throw new Error("Il nome dell'operatore è obbligatorio");
  const operatori = await readOperatori();
  if (operatori.some((o) => o.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Esiste già un operatore "${clean}"`);
  }
  const next = [...operatori, clean];
  await writeSheet(TAB, [HEADER, ...next.map((o) => [o])]);
  return next;
}

export async function removeOperatore(nome: string): Promise<string[]> {
  const operatori = await readOperatori();
  const next = operatori.filter((o) => o.toLowerCase() !== nome.trim().toLowerCase());
  await writeSheet(TAB, [HEADER, ...next.map((o) => [o])]);
  return next;
}
