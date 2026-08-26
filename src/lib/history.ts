import "server-only";
import { appendRow, readSheet } from "./sheets";

export type HistoryEventType = "noleggio" | "restituzione" | "sanificazione";

export interface HistoryEvent {
  data: string; // ISO yyyy-mm-dd
  codice: string;
  evento: HistoryEventType;
  cliente: string | null;
  telefono: string | null;
  contratto: string | null;
  nota: string | null;
}

const TAB = "Storico";
const HEADER = ["Data", "Codice", "Evento", "Cliente", "Telefono", "NumeroNoleggio", "Nota"];

const VALID_EVENTS: HistoryEventType[] = ["noleggio", "restituzione", "sanificazione"];

function toEvent(row: string[]): HistoryEvent {
  const [data, codice, evento, cliente, telefono, contratto, nota] = row;
  return {
    data: data ?? "",
    codice: codice ?? "",
    evento: (VALID_EVENTS as string[]).includes(evento)
      ? (evento as HistoryEventType)
      : "noleggio",
    cliente: cliente || null,
    telefono: telefono || null,
    contratto: contratto || null,
    nota: nota || null,
  };
}

function toRow(e: HistoryEvent): string[] {
  return [e.data, e.codice, e.evento, e.cliente ?? "", e.telefono ?? "", e.contratto ?? "", e.nota ?? ""];
}

/** Storico completo, oppure filtrato per un singolo dispositivo, più recenti prima. */
export async function listHistory(codice?: string): Promise<HistoryEvent[]> {
  const rows = await readSheet(TAB);
  const events = rows
    .slice(1)
    .filter((row) => row.length > 0 && row[0])
    .map(toEvent)
    .reverse();
  return codice ? events.filter((e) => e.codice === codice) : events;
}

export async function appendHistoryEvent(event: HistoryEvent): Promise<void> {
  await appendRow(TAB, toRow(event), HEADER);
}
