import "server-only";
import { appendRow, readSheet } from "./sheets";

export interface FascicoloPdfLogEntry {
  data: string; // ISO, momento di generazione
  fascicoloNumero: string;
  versione: number;
  operatore: string | null;
  /** Link Drive al PDF archiviato, se GOOGLE_DRIVE_FOLDER_ID è configurato
   * (vedi drive.ts) — null se il PDF è stato solo scaricato, senza
   * archiviazione automatica in cloud. */
  driveUrl: string | null;
}

const TAB = "FascicoliPdf";
const HEADER = ["Data", "FascicoloNumero", "Versione", "Operatore", "DriveUrl"];

function toRow(e: FascicoloPdfLogEntry): string[] {
  return [e.data, e.fascicoloNumero, String(e.versione), e.operatore ?? "", e.driveUrl ?? ""];
}

function toEntry(row: string[]): FascicoloPdfLogEntry {
  const [data, fascicoloNumero, versione, operatore, driveUrl] = row;
  return {
    data: data ?? "",
    fascicoloNumero: fascicoloNumero ?? "",
    versione: Number(versione) || 1,
    operatore: operatore || null,
    driveUrl: driveUrl || null,
  };
}

/** Cronologia dei PDF generati per un fascicolo, più recenti prima: è la
 * "versione N" concreta che conta — ogni generazione resta ritrovabile,
 * anche quando il contenuto del fascicolo continua a essere modificato. */
export async function listFascicoloPdfLog(fascicoloNumero: string): Promise<FascicoloPdfLogEntry[]> {
  const rows = await readSheet(TAB);
  return rows
    .slice(1)
    .filter((row) => row.length > 0 && row[0])
    .map(toEntry)
    .filter((e) => e.fascicoloNumero === fascicoloNumero)
    .reverse();
}

export async function appendFascicoloPdfLog(entry: FascicoloPdfLogEntry): Promise<void> {
  await appendRow(TAB, toRow(entry), HEADER);
}
