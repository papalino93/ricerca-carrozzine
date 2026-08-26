import "server-only";
import { appendRow, readSheet } from "./sheets";
import type { DocumentoTipo } from "./pdf/VerbaleDocument";

const VALID_TIPI: DocumentoTipo[] = ["consegna", "restituzione"];

export interface DocumentLogEntry {
  data: string; // ISO yyyy-mm-dd
  tipo: DocumentoTipo;
  codice: string;
  numeroContratto: string | null;
  cliente: string | null;
  telefono: string | null;
  /** Link Drive al PDF firmato, solo se generato con firma digitale (vedi
   * drive.ts) — assente per i documenti scaricati "di carta" come sempre. */
  driveUrl?: string | null;
}

const TAB = "Documenti";
const HEADER = ["Data", "Tipo", "Codice", "NumeroContratto", "Cliente", "Telefono", "DriveUrl"];

function toRow(e: DocumentLogEntry): string[] {
  return [
    e.data,
    e.tipo,
    e.codice,
    e.numeroContratto ?? "",
    e.cliente ?? "",
    e.telefono ?? "",
    e.driveUrl ?? "",
  ];
}

function toEntry(row: string[]): DocumentLogEntry {
  const [data, tipo, codice, numeroContratto, cliente, telefono, driveUrl] = row;
  return {
    data: data ?? "",
    tipo: (VALID_TIPI as string[]).includes(tipo) ? (tipo as DocumentoTipo) : "consegna",
    codice: codice ?? "",
    numeroContratto: numeroContratto || null,
    cliente: cliente || null,
    telefono: telefono || null,
    driveUrl: driveUrl || null,
  };
}

/** Registro completo, più recenti prima — usato per ritrovare i verbali firmati (vedi Registro noleggi). */
export async function listDocumentLog(): Promise<DocumentLogEntry[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .filter((row) => row.length > 0 && row[0])
    .map(toEntry)
    .reverse();
}

/**
 * Registro dei documenti generati. Non è un archivio dei PDF stessi (il
 * file viene generato al volo e scaricato dal browser, non conservato sul
 * server: niente storage esterno, vedi README) — è la traccia di quando,
 * per quale dispositivo e per quale cliente è stato generato un verbale.
 */
export async function appendDocumentLog(entry: DocumentLogEntry): Promise<void> {
  await appendRow(TAB, toRow(entry), HEADER);
}
