import "server-only";
import { readSheet, writeSheet } from "./sheets";

export interface CompanySettings {
  ragioneSociale: string;
  indirizzo: string;
  partitaIva: string;
  telefono: string;
  logoUrl: string;
  /** Testo segnaposto delle condizioni generali, mostrato in corpo piccolo sui documenti. */
  condizioniGenerali: string;
  /** Testo segnaposto dell'informativa privacy, mostrato in corpo piccolo sui documenti. */
  informativaPrivacy: string;
  /** Punti fedeltà accreditati per ogni euro di saldo su una commessa
   * ritirata (vedi commesse.ts). */
  puntiPerEuro: number;
  /** Soglia punti/euro del premio fedeltà mostrata come riferimento in
   * Clienti (es. 500 punti -> 25€): non applica automaticamente lo sconto,
   * solo un promemoria per l'operatore. */
  sogliaPremioPunti: number;
  sogliaPremioEuro: number;
  /** Regolamento del programma fedeltà, stampato sul modulo di adesione da
   * far firmare a un nuovo iscritto (vedi FidelityModule.tsx). */
  regolamentoFedelta: string;
  /** Informativa privacy specifica per l'adesione alla carta fedeltà (art.
   * 13 GDPR): distinta da informativaPrivacy perché parla di dati raccolti
   * e finalità della tessera fedeltà, non del noleggio di un ausilio. */
  informativaPrivacyFedelta: string;
}

const TAB = "Impostazioni";
const HEADER = [
  "RagioneSociale",
  "Indirizzo",
  "PartitaIVA",
  "Telefono",
  "LogoURL",
  "CondizioniGenerali",
  "InformativaPrivacy",
  "PuntiPerEuro",
  "SogliaPremioPunti",
  "SogliaPremioEuro",
  "RegolamentoFedelta",
  "InformativaPrivacyFedelta",
];

// Segnaposto: NON è una clausola legale valida, va rivista da un
// commercialista o consulente prima di un uso reale con i clienti.
export const DEFAULT_CONDIZIONI_GENERALI =
  "Il sottoscritto dichiara di aver ricevuto in noleggio l'ausilio sopra descritto e di averlo verificato funzionante e in buono stato. Si impegna a restituirlo nelle medesime condizioni, salvo la normale usura d'uso. [Testo segnaposto: da far verificare e integrare da un commercialista o consulente prima dell'uso reale con i clienti.]";

// Segnaposto onesto, NON un'informativa legalmente valida: manca almeno la
// conferma di un legale sui tempi di conservazione (variano per obblighi
// fiscali/civilistici) e sull'eventuale trattamento di categorie particolari
// di dati (l'ausilio noleggiato può indirettamente far emergere informazioni
// sulla salute del cliente, categoria che il GDPR tutela in modo rafforzato).
export const DEFAULT_INFORMATIVA_PRIVACY =
  "Informativa privacy (art. 13 Regolamento UE 2016/679). Titolare del trattamento: la ragione sociale indicata in testa a questo documento. Dati raccolti: nome e cognome, telefono, ausilio noleggiato ed eventuale firma. Finalità: gestione del noleggio e adempimenti contrattuali, fiscali e amministrativi conseguenti. Base giuridica: esecuzione del contratto di noleggio e obblighi di legge. I dati non vengono ceduti a terzi, salvo obblighi di legge. Conservazione: per la durata del rapporto e per il periodo successivo richiesto dagli obblighi fiscali e civilistici. L'interessato può in ogni momento richiedere accesso, rettifica, cancellazione o opposizione al trattamento dei propri dati contattando il titolare ai recapiti indicati su questo documento. [Testo segnaposto: da far verificare e integrare da un legale o consulente privacy prima dell'uso reale con i clienti — in particolare i tempi di conservazione e l'eventuale trattamento di categorie particolari di dati.]";

const DEFAULT_PUNTI_PER_EURO = 1;
const DEFAULT_SOGLIA_PREMIO_PUNTI = 500;
const DEFAULT_SOGLIA_PREMIO_EURO = 25;

// Segnaposto ispirato al modulo di adesione già in uso (fedelta.store): da
// far rivedere prima dell'uso reale, in particolare durata della tessera e
// condizioni di scadenza dei punti.
export const DEFAULT_REGOLAMENTO_FEDELTA =
  "Regolamento Carta Fedeltà. L'adesione al programma fedeltà è gratuita e riservata ai clienti maggiorenni. Per ogni euro speso in negozio (vendite e riparazioni) viene accreditato 1 punto sulla tessera del cliente. I punti sono personali, non cedibili e non convertibili in denaro. Raggiunta la soglia indicata sul retro/in negozio, i punti possono essere utilizzati come sconto sui prodotti o servizi disponibili, a discrezione del negozio. La tessera e i punti non hanno scadenza salvo comunicazione contraria esposta in negozio. Il negozio si riserva il diritto di modificare il regolamento dandone comunicazione ai clienti iscritti. [Testo segnaposto: da far verificare da un consulente prima dell'uso reale con i clienti.]";

// Segnaposto ispirato al modulo di adesione fedeltà realmente già in uso
// (stessa struttura art. 13 GDPR, incluso il periodo di conservazione di 24
// mesi): da far verificare da un legale prima dell'uso reale, in
// particolare l'eventuale trattamento di categorie particolari di dati.
export const DEFAULT_INFORMATIVA_PRIVACY_FEDELTA =
  "Informativa privacy (art. 13 Regolamento UE 2016/679) — Adesione alla Carta Fedeltà. Titolare del trattamento: la ragione sociale indicata in testa a questo documento, contattabile ai recapiti indicati. 1) Dati raccolti: nome, cognome, sesso, data e luogo di nascita, indirizzo, telefono, email, acquisti effettuati. 2) Modalità: il trattamento avviene con strumenti informatici e/o cartacei, con misure adeguate a tutelarne sicurezza e riservatezza. 3) Finalità: a) rilascio della Carta Fedeltà e gestione delle attività necessarie a consentire la fruizione di sconti, promozioni, premi e la partecipazione alla raccolta punti; b) solo previo consenso specifico, attività di marketing diretto (es. invio di comunicazioni promozionali via email, SMS); c) solo previo consenso specifico, attività di profilazione (es. analisi delle abitudini d'acquisto). 4) Natura del conferimento: per la finalità a) il conferimento è necessario al rilascio della tessera; per le finalità b) e c) è facoltativo e il rifiuto non pregiudica il rilascio della tessera né l'accesso ai suoi benefici. 5) Ambito di diffusione: i dati sono trattati da personale autorizzato e da eventuali fornitori di servizi informatici di cui il titolare si avvale, e non sono diffusi a terzi salvo obblighi di legge. 6) Periodo di conservazione: per la durata del programma fedeltà e comunque non oltre 24 mesi dall'ultimo movimento, salvo termini più lunghi imposti da obblighi di legge. 7) Diritti dell'interessato: accesso, rettifica, cancellazione, limitazione, portabilità e opposizione al trattamento, esercitabili in ogni momento contattando il titolare. [Testo segnaposto: da far verificare e integrare da un legale o consulente privacy prima dell'uso reale con i clienti.]";

export const EMPTY_SETTINGS: CompanySettings = {
  ragioneSociale: "",
  indirizzo: "",
  partitaIva: "",
  telefono: "",
  logoUrl: "",
  condizioniGenerali: DEFAULT_CONDIZIONI_GENERALI,
  informativaPrivacy: DEFAULT_INFORMATIVA_PRIVACY,
  puntiPerEuro: DEFAULT_PUNTI_PER_EURO,
  sogliaPremioPunti: DEFAULT_SOGLIA_PREMIO_PUNTI,
  sogliaPremioEuro: DEFAULT_SOGLIA_PREMIO_EURO,
  regolamentoFedelta: DEFAULT_REGOLAMENTO_FEDELTA,
  informativaPrivacyFedelta: DEFAULT_INFORMATIVA_PRIVACY_FEDELTA,
};

// `Number(v) || fallback` tratterebbe un valore salvato apposta come 0 (es.
// programma fedeltà messo in pausa con "punti per euro" a zero) come cella
// vuota, ripristinando il default a ogni lettura — qui invece 0 resta 0.
function numOrDefault(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return v != null && v.trim() !== "" && Number.isFinite(n) ? n : fallback;
}

/**
 * Come getSettings, ma non solleva mai: se il foglio non risponde (quota
 * Google esaurita, rete assente) restituisce i valori predefiniti.
 *
 * Da usare nelle pagine dove le impostazioni servono solo per contorno —
 * logo e regole fedeltà — e non vale la pena mostrare all'operatore la
 * pagina di errore del framework, in inglese, al posto del suo lavoro.
 */
export async function getSettingsSafe(): Promise<CompanySettings> {
  return getSettings().catch(() => EMPTY_SETTINGS);
}

export async function getSettings(): Promise<CompanySettings> {
  const rows = await readSheet(TAB);
  const row = rows[1];
  if (!row) return EMPTY_SETTINGS;

  const [
    ragioneSociale,
    indirizzo,
    partitaIva,
    telefono,
    logoUrl,
    condizioniGenerali,
    informativaPrivacy,
    puntiPerEuro,
    sogliaPremioPunti,
    sogliaPremioEuro,
    regolamentoFedelta,
    informativaPrivacyFedelta,
  ] = row;

  return {
    ragioneSociale: ragioneSociale || "",
    indirizzo: indirizzo || "",
    partitaIva: partitaIva || "",
    telefono: telefono || "",
    logoUrl: logoUrl || "",
    condizioniGenerali: condizioniGenerali || DEFAULT_CONDIZIONI_GENERALI,
    informativaPrivacy: informativaPrivacy || DEFAULT_INFORMATIVA_PRIVACY,
    puntiPerEuro: numOrDefault(puntiPerEuro, DEFAULT_PUNTI_PER_EURO),
    sogliaPremioPunti: numOrDefault(sogliaPremioPunti, DEFAULT_SOGLIA_PREMIO_PUNTI),
    sogliaPremioEuro: numOrDefault(sogliaPremioEuro, DEFAULT_SOGLIA_PREMIO_EURO),
    regolamentoFedelta: regolamentoFedelta || DEFAULT_REGOLAMENTO_FEDELTA,
    informativaPrivacyFedelta: informativaPrivacyFedelta || DEFAULT_INFORMATIVA_PRIVACY_FEDELTA,
  };
}

// Ben sotto il limite di 50.000 caratteri per cella di Google Sheets: un
// testo più lungo farebbe fallire l'intero salvataggio delle impostazioni
// (compreso il logo, che vive in un'altra cella della stessa riga).
const MAX_CONDIZIONI_LENGTH = 20000;

export async function saveSettings(settings: CompanySettings): Promise<void> {
  if (settings.condizioniGenerali.length > MAX_CONDIZIONI_LENGTH) {
    throw new Error(
      `Le condizioni generali superano i ${MAX_CONDIZIONI_LENGTH} caratteri: abbreviale prima di salvare.`
    );
  }
  if (settings.informativaPrivacy.length > MAX_CONDIZIONI_LENGTH) {
    throw new Error(
      `L'informativa privacy supera i ${MAX_CONDIZIONI_LENGTH} caratteri: abbreviala prima di salvare.`
    );
  }
  if (settings.regolamentoFedelta.length > MAX_CONDIZIONI_LENGTH) {
    throw new Error(
      `Il regolamento fedeltà supera i ${MAX_CONDIZIONI_LENGTH} caratteri: abbrevialo prima di salvare.`
    );
  }
  if (settings.informativaPrivacyFedelta.length > MAX_CONDIZIONI_LENGTH) {
    throw new Error(
      `L'informativa privacy fedeltà supera i ${MAX_CONDIZIONI_LENGTH} caratteri: abbreviala prima di salvare.`
    );
  }
  if (!(settings.puntiPerEuro >= 0) || !(settings.sogliaPremioPunti >= 0) || !(settings.sogliaPremioEuro >= 0)) {
    throw new Error("I valori del programma fedeltà devono essere numeri non negativi.");
  }
  // Il generatore PDF (@react-pdf/renderer) carica logoUrl come farebbe un
  // browser: un URL http(s) o un percorso locale verrebbero risolti e
  // richiesti dal server. Ammettiamo solo un data URI (o vuoto), come
  // produce /api/upload-logo, per non trasformare questo campo in un modo
  // di far contattare al server host arbitrari.
  if (settings.logoUrl && !settings.logoUrl.startsWith("data:image/")) {
    throw new Error("Logo non valido: usa il caricamento immagine, non un URL esterno.");
  }
  await writeSheet(TAB, [
    HEADER,
    [
      settings.ragioneSociale,
      settings.indirizzo,
      settings.partitaIva,
      settings.telefono,
      settings.logoUrl,
      settings.condizioniGenerali,
      settings.informativaPrivacy,
      String(settings.puntiPerEuro),
      String(settings.sogliaPremioPunti),
      String(settings.sogliaPremioEuro),
      settings.regolamentoFedelta,
      settings.informativaPrivacyFedelta,
    ],
  ]);
}
