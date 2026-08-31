import "server-only";
import { appendRow, readSheet, writeSheet } from "./sheets";
import { normalizeName } from "./clients";

export type HistoryEventType = "noleggio" | "restituzione" | "sanificazione";

export interface HistoryEvent {
  data: string; // ISO yyyy-mm-dd
  codice: string;
  evento: HistoryEventType;
  cliente: string | null;
  telefono: string | null;
  contratto: string | null;
  nota: string | null;
  /** Categoria/marca/modello del dispositivo COSÌ COM'ERANO al momento
   * dell'evento: se in futuro il codice viene eliminato e riassegnato a un
   * altro ausilio, questa riga di storico deve continuare a descrivere
   * l'ausilio di allora, non quello che oggi occupa lo stesso codice. Righe
   * scritte prima di questo campo restano null: chi legge ricade sul
   * dispositivo attuale solo per quelle (vedi RegistroClient). */
  categoria: string | null;
  marca: string | null;
  modello: string | null;
}

const TAB = "Storico";
const HEADER = [
  "Data",
  "Codice",
  "Evento",
  "Cliente",
  "Telefono",
  "NumeroNoleggio",
  "Nota",
  "Categoria",
  "Marca",
  "Modello",
];

const VALID_EVENTS: HistoryEventType[] = ["noleggio", "restituzione", "sanificazione"];

function toEvent(row: string[]): HistoryEvent {
  const [data, codice, evento, cliente, telefono, contratto, nota, categoria, marca, modello] = row;
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
    categoria: categoria || null,
    marca: marca || null,
    modello: modello || null,
  };
}

function toRow(e: HistoryEvent): string[] {
  return [
    e.data,
    e.codice,
    e.evento,
    e.cliente ?? "",
    e.telefono ?? "",
    e.contratto ?? "",
    e.nota ?? "",
    e.categoria ?? "",
    e.marca ?? "",
    e.modello ?? "",
  ];
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

/** Corregge il nome cliente su tutte le righe di storico, quando il nome
 * viene rinominato in anagrafica (vedi renameClient in clients.ts): senza
 * questo, cercare il cliente col nome corretto non troverebbe più i suoi
 * vecchi eventi. */
export async function renameHistoryCliente(nomeAttuale: string, nuovoNome: string): Promise<number> {
  const rows = await readSheet(TAB);
  const events = rows.slice(1).filter((row) => row.length > 0 && row[0]).map(toEvent);
  const target = normalizeName(nomeAttuale);
  let count = 0;
  for (const e of events) {
    if (e.cliente && normalizeName(e.cliente) === target) {
      e.cliente = nuovoNome;
      count++;
    }
  }
  if (count > 0) await writeSheet(TAB, [HEADER, ...events.map(toRow)]);
  return count;
}
