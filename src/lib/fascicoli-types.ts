// Tipi e costanti condivisi tra server (fascicoli.ts) e client (i componenti
// dell'editor): niente "server-only" qui, stesso motivo di commesse-types.ts
// e device-types.ts — deve restare importabile dai componenti client.
//
// La struttura ricalca il fascicolo cartaceo originale ("Fascicolazione per
// i Plantari su misura", analizzato pagina per pagina), riorganizzato nelle
// 8 sezioni del modulo digitale invece delle ripetizioni del documento Word.
// Ogni campo qui è annotato con la sua provenienza nel documento originale,
// utile a chi in futuro deve verificare che non manchi nulla.

/** Tetto al numero di allegati per fascicolo (vedi fascicoli-allegati.ts):
 * condiviso qui, non in quel file (che ha "server-only"), perché serve
 * anche al componente client per disabilitare il pulsante di upload. */
export const MAX_ALLEGATI_PER_FASCICOLO = 12;

export type FascicoloStato =
  | "bozza"
  | "in_lavorazione"
  | "completo"
  | "prodotto"
  | "consegnato"
  | "archiviato";

export const FASCICOLO_STATO_OPTIONS: { key: FascicoloStato; label: string }[] = [
  { key: "bozza", label: "Bozza" },
  { key: "in_lavorazione", label: "In lavorazione" },
  { key: "completo", label: "Completo" },
  { key: "prodotto", label: "Prodotto" },
  { key: "consegnato", label: "Consegnato" },
  { key: "archiviato", label: "Archiviato" },
];

export const FASCICOLO_STATO_LABEL: Record<FascicoloStato, string> = Object.fromEntries(
  FASCICOLO_STATO_OPTIONS.map((o) => [o.key, o.label])
) as Record<FascicoloStato, string>;

// Colori coerenti con lo stesso semaforo già usato per i dispositivi
// (STATUS_COLOR in device-types.ts): verde=fatto, blu=in corso, ecc.
export const FASCICOLO_STATO_COLOR: Record<FascicoloStato, string> = {
  bozza: "#B4590A",
  in_lavorazione: "#2F5A8A",
  completo: "#1F7A3D",
  prodotto: "#6B4E93",
  consegnato: "#175C22",
  archiviato: "#5c6b5e",
};

/** Anamnesi (pag. 1-2 del documento originale). */
export interface AnamnesiData {
  altezzaCm: number | null;
  pesoKg: number | null;
  /** "Patologia correlata al dispositivo: vedi allegato se presente". */
  patologiaCorrelata: string | null;
  altrePatologie: string | null;
  /** Se true, corrisponde a "DICHIARA DI NON AVERNE" del documento originale. */
  nessunaAllergia: boolean;
  /** Valorizzato solo se nessunaAllergia è false. */
  allergie: string | null;
  capacitaPsicofisica: "totale" | "parziale" | "assistenza" | null;
}

export function emptyAnamnesi(): AnamnesiData {
  return {
    altezzaCm: null,
    pesoKg: null,
    patologiaCorrelata: null,
    altrePatologie: null,
    nessunaAllergia: false,
    allergie: null,
    capacitaPsicofisica: null,
  };
}

/** Un piede (sinistro o destro) della Scheda Rilevazione Obiettiva, pag. 3. */
export interface EsamePiedeLato {
  piedePiatto: "riducibile" | "irriducibile" | null;
  piedeCavo: "anteriore" | "posteriore" | null;
  pronazione: "avampiede" | "retropiede" | null;
  alluce: "valgo" | "varo" | null;
  /** Dita interessate, 1°-5°. */
  ditaAGriffe: number[];
  tallone: { talalgie: boolean; spinaCalcaneare: boolean };
  ginocchio: "valgo" | "varo" | null;
  tibiaVara: boolean;
  /** Teste metatarsali sovraccariche, 1°-5°. */
  sovraccaricoMetatarsali: number[];
  ulcerazioni: { dorsali: boolean; plantari: boolean; calcaneari: boolean };
  traumi: string | null;
}

function emptyLato(): EsamePiedeLato {
  return {
    piedePiatto: null,
    piedeCavo: null,
    pronazione: null,
    alluce: null,
    ditaAGriffe: [],
    tallone: { talalgie: false, spinaCalcaneare: false },
    ginocchio: null,
    tibiaVara: false,
    sovraccaricoMetatarsali: [],
    ulcerazioni: { dorsali: false, plantari: false, calcaneari: false },
    traumi: null,
  };
}

export interface EsamePiedeData {
  motivoVisita: string | null;
  sinistro: EsamePiedeLato;
  destro: EsamePiedeLato;
  destinazioneUso: {
    attivitaLavorativa: string | null;
    attivitaSportiva: string | null;
    attivitaTempoLibero: string | null;
  };
  calzaturaCollegamento: {
    ciabattaPredisposta: boolean;
    scarpaPredisposta: boolean;
    antinfortunistica: boolean;
    scarpaGinnastica: boolean;
  };
}

export function emptyEsamePiede(): EsamePiedeData {
  return {
    motivoVisita: null,
    sinistro: emptyLato(),
    destro: emptyLato(),
    destinazioneUso: { attivitaLavorativa: null, attivitaSportiva: null, attivitaTempoLibero: null },
    calzaturaCollegamento: {
      ciabattaPredisposta: false,
      scarpaPredisposta: false,
      antinfortunistica: false,
      scarpaGinnastica: false,
    },
  };
}

/** Prescrizione/caratteristiche del dispositivo (pag. 2, tabella materiali + documentazione). */
export interface PrescrizioneData {
  descrizioneMateriale: string;
  quantita: string;
  importo: number | null;
  /** Dispositivo medico detraibile: campo esplicito Sì/No, come nel modello
   * definitivo del fascicolo (nell'originale era solo una dicitura fissa). */
  dispositivoDetraibile: boolean;
  dataOrdine: string | null;
  richiestaMedica: boolean;
  /** Nome del medico che ha rilasciato la richiesta, se presente. */
  medicoPrescrittore: string | null;
  dataPrescrizione: string | null;
  documentazioneDiagnostica: boolean;
  /** Pratica autorizzata da un ente terzo (ASL/SSN): quando true, il PDF
   * include anche la "Comunicazione avvenuta consegna" indirizzata
   * all'ente, e mostra il numero di autorizzazione. */
  praticaAsl: boolean;
  autorizzazioneAslNumero: string | null;
  note: string | null;
}

export function emptyPrescrizione(): PrescrizioneData {
  return {
    descrizioneMateriale: "Plantari su misura",
    quantita: "01 paia",
    importo: null,
    dispositivoDetraibile: true,
    dataOrdine: null,
    richiestaMedica: false,
    medicoPrescrittore: null,
    dataPrescrizione: null,
    documentazioneDiagnostica: false,
    praticaAsl: false,
    autorizzazioneAslNumero: null,
    note: null,
  };
}

/** Una fase del processo produttivo (pag. 6, "Scheda Plantari"): il nome e i
 * controlli sono template fissi (uguali per ogni fascicolo, presi dal
 * documento originale), solo data/operatore/esito cambiano da fascicolo a
 * fascicolo. */
export interface FaseProduzione {
  numero: number;
  nome: string;
  controlli: string;
  completata: boolean;
  data: string | null;
  operatore: string | null;
  /** Solo per alcune fasi: es. numeri di lotto materiali (fase 6), dismetria (fase 2). */
  note: string | null;
}

// Testo delle 13 fasi copiato dal documento originale ("SCHEDA PLANTARI
// COMMESSA N°"): non è farina di questo modulo, è il processo qualità già
// in uso — qui diventa solo compilabile invece che ridigitato a mano ad
// ogni commessa.
const FASI_TEMPLATE: { nome: string; controlli: string }[] = [
  { nome: "Dati di ingresso", controlli: "Vedere anamnesi ed esame del piede" },
  {
    nome: "Dati in uscita: analisi del passo, rilevazione impronta su schiuma fenolica",
    controlli: "Dismetria Sx/Dx",
  },
  { nome: "Costruzione calco", controlli: "Visivo" },
  { nome: "Stilizzazione forma", controlli: "Visivo / analisi del passo / scheda rilevazione" },
  { nome: "Riesame dei calcoli", controlli: "Vedere fasi 1-4" },
  { nome: "Scelta materiali", controlli: "Lotti materiali" },
  { nome: "Lavorazione", controlli: "Vedere IL 03.01" },
  { nome: "Verifica", controlli: "Vedere fasi 1-7" },
  { nome: "Rifinitura", controlli: "Vedere IL 03.01" },
  { nome: "1ª validazione con eventuali modifiche", controlli: "Prova fisica" },
  {
    nome: "Consegna manuale d'uso, garanzia e dichiarazione privacy",
    controlli: "IL 03.02 (Garanzia)",
  },
  {
    nome: "Validazioni per la garanzia (entro 1°, 3° e 6° mese)",
    controlli: "Prova fisica",
  },
  { nome: "Controllo finale", controlli: "OP/RP" },
];

export function emptyFasiProduzione(): FaseProduzione[] {
  return FASI_TEMPLATE.map((f, i) => ({
    numero: i + 1,
    nome: f.nome,
    controlli: f.controlli,
    // Di default tutte spuntate: nella pratica la maggior parte delle fasi
    // viene davvero eseguita, deflaggare le poche eccezioni è più veloce
    // che spuntare tutte le altre una per una.
    completata: true,
    data: null,
    operatore: null,
    note: null,
  }));
}

export interface ProduzioneData {
  matricola: string | null;
  codice: string | null;
  /** Di norma il tecnico ortopedico responsabile (es. "T.O. Claudia Amulfi"),
   * distinto dall'operatore che segue materialmente la commessa. */
  responsabileProgetto: string | null;
  dataInizioLavori: string | null;
  dataProntaConsegna: string | null;
  noteRiesame: string | null;
  fasi: FaseProduzione[];
  controlloFinale: "conforme" | "non_conforme" | null;
  nonConformitaNumero: string | null;
  /** Il flussogramma di progettazione (Allegato A) è una procedura aziendale
   * fissa, identica per ogni commessa: NON entra di default nel PDF del
   * cliente. Quando true, l'operatore ha scelto di allegarlo come ultima
   * pagina dello stesso fascicolo (vedi analisi del documento originale). */
  includiAllegatoA: boolean;
}

export function emptyProduzione(): ProduzioneData {
  return {
    matricola: null,
    codice: null,
    responsabileProgetto: "T.O. Claudia Amulfi",
    dataInizioLavori: null,
    dataProntaConsegna: null,
    noteRiesame: null,
    fasi: emptyFasiProduzione(),
    controlloFinale: null,
    nonConformitaNumero: null,
    includiAllegatoA: false,
  };
}

/** Una visita di controllo post-consegna: numero libero (1ª, 2ª, 3ª...),
 * aggiunte quando servono davvero — non un numero fisso di controlli
 * previsti in partenza. */
export interface VisitaControllo {
  numero: number;
  data: string | null;
  nota: string | null;
}

/** Consegna/istruzioni (pag. 4, 7, 10). */
export interface ConsegnaData {
  dataPrimoAppuntamento: string | null;
  dataConsegnaPrevista: string | null;
  luogoConsegna: string | null;
  oraConsegna: string | null;
  dataConsegnaEffettiva: string | null;
  dataFollowUp: string | null;
  /** Valorizzati solo se prescrizione.praticaAsl è true: "Comunicazione
   * avvenuta consegna" (pag. 7), indirizzata all'ente che ha autorizzato. */
  comunicazioneAslDestinatario: string | null;
  comunicazioneAslPraticaNumero: string | null;
  /** Visite di controllo dopo la consegna: elenco libero, il tecnico ne
   * aggiunge quante servono nel tempo. */
  visiteControllo: VisitaControllo[];
}

export function emptyConsegna(): ConsegnaData {
  return {
    dataPrimoAppuntamento: null,
    dataConsegnaPrevista: null,
    // Quasi tutte le consegne avvengono in sede: precompilato ma
    // modificabile, invece di farlo ridigitare ogni volta.
    luogoConsegna: "Scandicci",
    oraConsegna: null,
    dataConsegnaEffettiva: null,
    dataFollowUp: null,
    comunicazioneAslDestinatario: null,
    comunicazioneAslPraticaNumero: null,
    visiteControllo: [],
  };
}

/** Privacy e consensi (pag. 1). */
export interface ConsensiData {
  consensoTrattamentoDati: boolean;
  presaVisioneInformativa: boolean;
  consensoDocumentazione: boolean;
  dataConsenso: string | null;
  /** Predisposto per una futura firma digitale reale (vedi SignaturePad):
   * oggi resta sempre null, il PDF esce con la riga firma vuota da firmare
   * a penna dopo la stampa. */
  firmaClienteUrl: string | null;
}

export function emptyConsensi(): ConsensiData {
  return {
    consensoTrattamentoDati: false,
    presaVisioneInformativa: false,
    consensoDocumentazione: false,
    dataConsenso: null,
    firmaClienteUrl: null,
  };
}

export interface FascicoloContenuto {
  anamnesi: AnamnesiData;
  esamePiede: EsamePiedeData;
  prescrizione: PrescrizioneData;
  produzione: ProduzioneData;
  consegna: ConsegnaData;
  consensi: ConsensiData;
}

export function emptyFascicoloContenuto(): FascicoloContenuto {
  return {
    anamnesi: emptyAnamnesi(),
    esamePiede: emptyEsamePiede(),
    prescrizione: emptyPrescrizione(),
    produzione: emptyProduzione(),
    consegna: emptyConsegna(),
    consensi: emptyConsensi(),
  };
}

export interface FascicoloRecord {
  numero: string;
  /** Nome del cliente: chiave verso l'anagrafica Clienti (stesso pattern
   * già usato da CommessaRecord.cliente — nessuna anagrafica duplicata). */
  clienteNome: string;
  /** Copia del CF al momento della creazione, solo per filtrare/mostrare
   * l'Archivio senza dover incrociare ogni riga con Clienti: il dato "vero"
   * resta comunque quello sulla scheda cliente. */
  clienteCF: string | null;
  /** Numero di commessa collegato, se il gestionale ne gestisce già una per
   * questo lavoro (vedi CommessaRecord.numero) — facoltativo. */
  commessa: string | null;
  stato: FascicoloStato;
  tipoDispositivo: string;
  operatore: string | null;
  dataCreazione: string;
  ultimaModifica: string;
  /** Incrementata solo ai salvataggi espliciti (non a ogni carattere
   * digitato dall'autosave), per avere un minimo "versione N" senza
   * riscrivere l'intera cronologia a ogni battitura. */
  versione: number;
  contenuto: FascicoloContenuto;
}

export type SezioneFascicolo =
  | "anagrafica"
  | "privacy"
  | "anamnesi"
  | "esamePiede"
  | "prescrizione"
  | "produzione"
  | "consegna"
  | "controlli";

export const SEZIONI_FASCICOLO: { key: SezioneFascicolo; label: string }[] = [
  { key: "anagrafica", label: "Anagrafica" },
  { key: "privacy", label: "Privacy e consensi" },
  { key: "anamnesi", label: "Anamnesi" },
  { key: "esamePiede", label: "Esame del piede" },
  { key: "prescrizione", label: "Prescrizione" },
  { key: "produzione", label: "Produzione" },
  { key: "consegna", label: "Consegna" },
  { key: "controlli", label: "Visite di controllo" },
];

/**
 * Completamento di ogni sezione, per l'indicatore "Anagrafica ✅ / Anamnesi
 * 🟡 / Esame ⬜" richiesto dal flusso operatore. Euristica volutamente
 * semplice (un campo chiave per sezione, non "tutti i campi obbligatori"):
 * il fascicolo deve poter essere salvato incompleto in ogni momento, questo
 * indicatore è una guida per l'operatore, non un blocco.
 */
export function calcolaCompletamento(f: Pick<FascicoloRecord, "clienteNome" | "contenuto">): Record<SezioneFascicolo, boolean> {
  const c = f.contenuto;
  return {
    anagrafica: Boolean(f.clienteNome?.trim()),
    privacy: c.consensi.consensoTrattamentoDati,
    anamnesi: c.anamnesi.capacitaPsicofisica != null,
    esamePiede: Boolean(c.esamePiede.motivoVisita?.trim()),
    prescrizione: Boolean(c.prescrizione.descrizioneMateriale?.trim() && c.prescrizione.importo != null),
    produzione: Boolean(c.produzione.dataInizioLavori),
    consegna: Boolean(c.consegna.dataConsegnaEffettiva),
    controlli: c.consegna.visiteControllo.length > 0,
  };
}

/**
 * Stato "attivo" del fascicolo (tutti tranne "archiviato", l'unica
 * decisione manuale — vedi sotto), derivato dai dati realmente compilati
 * invece che scelto a mano: prima lo stato era un menu libero senza alcun
 * legame con anamnesi/prescrizione/produzione/consegna, quindi poteva
 * restare "Bozza" su un fascicolo già consegnato, o "Consegnato" senza che
 * nessuna data di consegna fosse mai stata inserita — bastava dimenticarsi
 * di aggiornarlo. Le soglie ricalcano lo stesso indicatore di completamento
 * per sezione già mostrato nell'editor (calcolaCompletamento), così le due
 * cose raccontano sempre la stessa storia invece di poter contraddirsi.
 * "Archiviato" resta invece una scelta esplicita dell'operatore (vedi
 * updateFascicolo in fascicoli.ts): non è implicito in nessun dato, un
 * fascicolo può restare "Consegnato" per anni senza mai essere archiviato,
 * o essere archiviato anche se abbandonato a metà.
 */
export function deriveStatoAttivo(
  f: Pick<FascicoloRecord, "clienteNome" | "contenuto">
): Exclude<FascicoloStato, "archiviato"> {
  const done = calcolaCompletamento(f);
  if (done.consegna) return "consegnato";
  if (f.contenuto.produzione.controlloFinale != null) return "prodotto";
  if (done.anamnesi && done.esamePiede && done.prescrizione) return "completo";
  if (done.anamnesi || done.esamePiede || done.prescrizione || f.contenuto.produzione.dataInizioLavori) {
    return "in_lavorazione";
  }
  return "bozza";
}
