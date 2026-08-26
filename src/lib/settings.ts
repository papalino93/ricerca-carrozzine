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

const EMPTY_SETTINGS: CompanySettings = {
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
};

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
  ] = row;

  return {
    ragioneSociale: ragioneSociale || "",
    indirizzo: indirizzo || "",
    partitaIva: partitaIva || "",
    telefono: telefono || "",
    logoUrl: logoUrl || "",
    condizioniGenerali: condizioniGenerali || DEFAULT_CONDIZIONI_GENERALI,
    informativaPrivacy: informativaPrivacy || DEFAULT_INFORMATIVA_PRIVACY,
    puntiPerEuro: Number(puntiPerEuro) || DEFAULT_PUNTI_PER_EURO,
    sogliaPremioPunti: Number(sogliaPremioPunti) || DEFAULT_SOGLIA_PREMIO_PUNTI,
    sogliaPremioEuro: Number(sogliaPremioEuro) || DEFAULT_SOGLIA_PREMIO_EURO,
    regolamentoFedelta: regolamentoFedelta || DEFAULT_REGOLAMENTO_FEDELTA,
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
    ],
  ]);
}
