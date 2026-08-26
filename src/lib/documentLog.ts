import "server-only";
import { appendRow } from "./sheets";
import type { DocumentoTipo } from "./pdf/VerbaleDocument";

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

/**
 * Registro dei documenti generati. Non è un archivio dei PDF stessi (il
 * file viene generato al volo e scaricato dal browser, non conservato sul
 * server: niente storage esterno, vedi README) — è la traccia di quando,
 * per quale dispositivo e per quale cliente è stato generato un verbale.
 */
export async function appendDocumentLog(entry: DocumentLogEntry): Promise<void> {
  await appendRow(TAB, toRow(entry), HEADER);
}
