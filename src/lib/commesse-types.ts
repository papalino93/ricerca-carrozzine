/** Tipi e costanti condivisi tra server (commesse.ts) e client
 * (CommesseClient.tsx): niente "server-only" qui, deve restare importabile
 * dai componenti client — stesso motivo per cui esiste tariffe-types.ts. */

export interface CommessaRecord {
  numero: string;
  committente: string;
  indirizzo: string | null;
  telefono: string | null;
  cellulare: string | null;
  tipoMateriale: boolean;
  tipoRiparazione: boolean;
  operatori: string | null;
  richiesteParticolari: string | null;
  dataInizio: string | null;
  dataConsegnaPrevista: string | null;
  acconto: number | null;
  saldo: number | null;
  richiestaMedica: boolean;
  documentazione: boolean;
  documentazioneDiagnostica: boolean;
  altro: boolean;
  /** Esito del controllo qualità sul modulo cartaceo (OK / conforme /
   * non conforme), non lo stato di avanzamento del lavoro (vedi `stato`). */
  verifica: "ok" | "c" | "nc" | null;
  nonConformitaNumero: string | null;
  esito: string | null;
  dataProntaConsegna: string | null;
  dataRitiro: string | null;
  stato: "in_lavorazione" | "pronta" | "ritirata";
  creata: string;
}

export const COMMESSA_STATUS_LABEL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "In lavorazione",
  pronta: "Pronta per la consegna",
  ritirata: "Ritirata",
};
