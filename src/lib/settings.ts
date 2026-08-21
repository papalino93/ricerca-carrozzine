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
}

const TAB = "Impostazioni";
const HEADER = [
  "RagioneSociale",
  "Indirizzo",
  "PartitaIVA",
  "Telefono",
  "LogoURL",
  "CondizioniGenerali",
];

// Segnaposto: NON è una clausola legale valida, va rivista da un
// commercialista o consulente prima di un uso reale con i clienti.
export const DEFAULT_CONDIZIONI_GENERALI =
  "Il sottoscritto dichiara di aver ricevuto in noleggio l'ausilio sopra descritto e di averlo verificato funzionante e in buono stato. Si impegna a restituirlo nelle medesime condizioni, salvo la normale usura d'uso. [Testo segnaposto: da far verificare e integrare da un commercialista o consulente prima dell'uso reale con i clienti.]";

const EMPTY_SETTINGS: CompanySettings = {
  ragioneSociale: "",
  indirizzo: "",
  partitaIva: "",
  telefono: "",
  logoUrl: "",
  condizioniGenerali: DEFAULT_CONDIZIONI_GENERALI,
};

export async function getSettings(): Promise<CompanySettings> {
  const rows = await readSheet(TAB);
  const row = rows[1];
  if (!row) return EMPTY_SETTINGS;

  const [ragioneSociale, indirizzo, partitaIva, telefono, logoUrl, condizioniGenerali] =
    row;

  return {
    ragioneSociale: ragioneSociale || "",
    indirizzo: indirizzo || "",
    partitaIva: partitaIva || "",
    telefono: telefono || "",
    logoUrl: logoUrl || "",
    condizioniGenerali: condizioniGenerali || DEFAULT_CONDIZIONI_GENERALI,
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
  await writeSheet(TAB, [
    HEADER,
    [
      settings.ragioneSociale,
      settings.indirizzo,
      settings.partitaIva,
      settings.telefono,
      settings.logoUrl,
      settings.condizioniGenerali,
    ],
  ]);
}
