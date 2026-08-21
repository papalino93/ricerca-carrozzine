import "server-only";
import { readSheet, writeSheet } from "./sheets";

export interface ClientRecord {
  nome: string;
  telefono: string | null;
  ultimoContratto: string | null;
  ultimoNoleggio: string | null;
}

const TAB = "Clienti";
const HEADER = ["Nome", "Telefono", "UltimoContratto", "UltimoNoleggio"];

function toClient(row: string[]): ClientRecord {
  const [nome, telefono, ultimoContratto, ultimoNoleggio] = row;
  return {
    nome: nome ?? "",
    telefono: telefono || null,
    ultimoContratto: ultimoContratto || null,
    ultimoNoleggio: ultimoNoleggio || null,
  };
}

function toRow(c: ClientRecord): string[] {
  return [c.nome, c.telefono ?? "", c.ultimoContratto ?? "", c.ultimoNoleggio ?? ""];
}

async function readClients(): Promise<ClientRecord[]> {
  const rows = await readSheet(TAB);
  return rows.slice(1).filter((row) => row.length > 0 && row[0]).map(toClient);
}

/** Anagrafica clienti: sola consultazione, popolata automaticamente a ogni noleggio. */
export async function listClients(): Promise<ClientRecord[]> {
  return readClients();
}

/**
 * Crea o aggiorna la riga del cliente con i dati più recenti noti (stesso
 * nome, case-insensitive). Chiamata da rentDevice: nessun'altra scrittura
 * manuale prevista, l'anagrafica riflette solo i noleggi reali registrati.
 */
export async function upsertClient(input: {
  nome: string;
  telefono: string | null;
  contratto: string | null;
  dal: string | null;
}): Promise<void> {
  const nome = input.nome.trim();
  if (!nome) return;
  const clients = await readClients();
  const idx = clients.findIndex((c) => c.nome.toLowerCase() === nome.toLowerCase());
  const next: ClientRecord = {
    nome,
    telefono: input.telefono || (idx >= 0 ? clients[idx].telefono : null),
    ultimoContratto: input.contratto || (idx >= 0 ? clients[idx].ultimoContratto : null),
    ultimoNoleggio: input.dal || (idx >= 0 ? clients[idx].ultimoNoleggio : null),
  };
  if (idx >= 0) clients[idx] = next;
  else clients.push(next);
  await writeSheet(TAB, [HEADER, ...clients.map(toRow)]);
}
