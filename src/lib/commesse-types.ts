/** Tipi e costanti condivisi tra server (commesse.ts) e client
 * (CommesseClient.tsx): niente "server-only" qui, deve restare importabile
 * dai componenti client — stesso motivo per cui esiste tariffe-types.ts. */

export interface CommessaRecord {
  numero: string;
  cliente: string;
  indirizzo: string | null;
  telefono: string | null;
  cellulare: string | null;
  vendita: boolean;
  riparazione: boolean;
  operatore: string | null;
  /** Fornitore da cui si ordina (facoltativo): permette di filtrare le
   * commesse per fornitore, oltre che per cliente/numero. */
  fornitore: string | null;
  /** Numero d'ordine usato dal cliente/azienda nei propri sistemi
   * (facoltativo): diverso da `richiesteParticolari` (cosa ordina), serve
   * solo a riconciliare l'ordine con la loro contabilità. */
  numeroOrdineCliente: string | null;
  richiesteParticolari: string | null;
  dataOrdine: string | null;
  consegnaPrevista: string | null;
  acconto: number | null;
  saldo: number | null;
  richiestaMedica: boolean;
  documentazione: boolean;
  documentazioneDiagnostica: boolean;
  altro: boolean;
  /** Controllo finale prima della consegna: null finché non ancora
   * verificato, poi "ok" oppure "problema" (con nota in `noteChiusura`). */
  controlloFinale: "ok" | "problema" | null;
  noteChiusura: string | null;
  prontaIl: string | null;
  ritirataIl: string | null;
  stato: "in_lavorazione" | "pronta" | "ritirata";
  creata: string;
  /** True se il saldo di questa commessa ha già generato punti fedeltà al
   * cliente: evita di riassegnarli se lo stato torna e ritorna "ritirata"
   * (es. per correggere un errore). */
  puntiAssegnati: boolean;
}

export const COMMESSA_STATUS_LABEL: Record<CommessaRecord["stato"], string> = {
  in_lavorazione: "In lavorazione",
  pronta: "Pronta per la consegna",
  ritirata: "Ritirata",
};
