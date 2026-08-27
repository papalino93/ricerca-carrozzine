import "server-only";
import { appendRows, deleteRows, getBackupSpreadsheetId, listTabNames, readRange, readSheet } from "./sheets";

const TAB = "BackupCompleto";
const HEADER = ["Data", "Tab", "Parte", "Parti", "Dati"];

/**
 * Tab che il backup non copia.
 *
 * "Foto": ogni immagine è un data URI da ~30-45.000 caratteri, e il
 * magazzino ne può avere fino a 8 per dispositivo — copiarle andrebbe
 * contro la ragione stessa per cui sono tenute fuori da ogni altra lettura
 * pesante (vedi photos.ts). Sono anche l'unico dato qui dentro che si può
 * rifare (si rifotografa l'ausilio); tutto il resto — clienti, commesse,
 * punti fedeltà, storico — non si può ricostruire, ed è quello che questo
 * backup esiste per proteggere.
 *
 * "Snapshot": il vecchio formato di backup, solo magazzino, che questo
 * sostituisce. I dati che contiene restano intatti — non li tocca
 * nessuno — semplicemente non si scrive più lì.
 *
 * TAB stessa: non si fa il backup del backup.
 */
const TAB_ESCLUSE = new Set<string>(["Foto", "Snapshot", TAB]);

/** Giorni di backup conservati: un mese e mezzo abbondante di storico. */
const MAX_SNAPSHOTS = 60;

/** Margine sotto il limite di 50.000 caratteri per cella di Google: una
 * tab che cresce (Clienti è già a ~49.000 con 361 righe) supera prima o
 * poi quel limite, e da lì in poi il backup fallirebbe silenziosamente se
 * non si spezzasse in più celle. */
const CHUNK = 45_000;

function splitInParti(testo: string): string[] {
  if (testo.length <= CHUNK) return [testo];
  const parti: string[] = [];
  for (let i = 0; i < testo.length; i += CHUNK) parti.push(testo.slice(i, i + CHUNK));
  return parti;
}

export interface BackupSecondarioStatus {
  /** false se GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID non è ancora impostato. */
  configurato: boolean;
  riuscito: boolean;
  errore?: string;
}

export interface TabBackupInfo {
  tab: string;
  righe: number;
  /** Presente se la lettura di QUESTA tab è fallita: le altre vengono
   * comunque salvate, così un problema isolato non fa perdere tutto il
   * resto del backup del giorno. */
  errore?: string;
}

export interface SnapshotResult {
  data: string;
  tabs: TabBackupInfo[];
  backupSecondario: BackupSecondarioStatus;
}

/**
 * Legge ogni tab del gestionale (tranne quelle escluse, vedi sopra) e la
 * trasforma in righe [Data, Tab, Parte, Parti, Dati] pronte da accodare.
 *
 * Una tab che non si riesce a leggere non blocca le altre: il suo errore
 * finisce nel risultato invece che far fallire l'intero backup del
 * giorno, che altrimenti lascerebbe SENZA backup anche le tab lette bene.
 */
async function costruisciRigheBackup(data: string): Promise<{ righe: string[][]; tabs: TabBackupInfo[] }> {
  const nomiTab = await listTabNames();
  const daBackuppare = nomiTab.filter((t) => !TAB_ESCLUSE.has(t));

  const righe: string[][] = [];
  const tabs: TabBackupInfo[] = [];

  for (const tab of daBackuppare) {
    try {
      const contenuto = await readSheet(tab);
      const json = JSON.stringify(contenuto);
      const parti = splitInParti(json);
      parti.forEach((parte, i) => {
        righe.push([data, tab, String(i + 1), String(parti.length), parte]);
      });
      tabs.push({ tab, righe: contenuto.length });
    } catch (err) {
      tabs.push({ tab, righe: 0, errore: (err as Error).message });
    }
  }

  return { righe, tabs };
}

/**
 * Scrive il backup giornaliero di tutto il gestionale: prima nella tab
 * "BackupCompleto" del foglio principale, poi — se configurato — anche in
 * un secondo foglio Google del tutto separato (vedi getBackupSpreadsheetId).
 *
 * Il motivo del secondo foglio: un backup nella STESSA cartella del foglio
 * principale non protegge da nulla se è il file intero a danneggiarsi o
 * venire eliminato per errore — sparirebbero insieme. Un file separato sì.
 *
 * Il backup secondario è best-effort: se fallisce (non ancora configurato,
 * problema di permessi, quota) non fa fallire l'intera chiamata, perché il
 * backup primario è comunque già scritto con successo a quel punto — un
 * errore qui non deve far perdere anche quello. Lo stato di entrambi torna
 * nel risultato, così chi chiama (o guarda Impostazioni → Backup) lo vede.
 */
/**
 * Toglie le righe già presenti per una data, se ce ne sono, prima di
 * scrivere quelle nuove.
 *
 * Serve perché il backup può girare più volte nello stesso giorno: una
 * volta di notte dal cron, e potenzialmente altre da "Esegui backup ora"
 * in Impostazioni. Senza questo passaggio le righe si accumulerebbero —
 * due, tre serie di "Clienti parte 1/2" per lo stesso giorno — e in fase
 * di ricostruzione non ci sarebbe modo di sapere quali due pezzi
 * appartengono alla stessa esecuzione: la numerazione delle parti
 * ricomincerebbe da 1 ogni volta, ambigua fra le serie.
 */
async function eliminaBackupDelGiorno(data: string, spreadsheetIdOverride?: string): Promise<void> {
  const rows = await readSheet(TAB, spreadsheetIdOverride);
  const daEliminare: number[] = [];
  rows.slice(1).forEach((row, i) => {
    if (row[0] === data) daEliminare.push(i + 2); // +2: header + indici del foglio da 1
  });
  await deleteRows(TAB, daEliminare, spreadsheetIdOverride);
}

export async function createSnapshot(): Promise<SnapshotResult> {
  const data = new Date().toISOString().slice(0, 10);

  const { righe, tabs } = await costruisciRigheBackup(data);

  await eliminaBackupDelGiorno(data);
  await appendRows(TAB, righe, HEADER);
  await pruneOldSnapshots();

  const backupId = getBackupSpreadsheetId();
  const backupSecondario: BackupSecondarioStatus = { configurato: Boolean(backupId), riuscito: false };
  if (backupId) {
    try {
      // Le stesse righe già lette e spezzate, non una seconda lettura da
      // capo: dimezza il lavoro e garantisce che primario e secondario
      // contengano esattamente lo stesso backup del giorno.
      await eliminaBackupDelGiorno(data, backupId);
      await appendRows(TAB, righe, HEADER, backupId);
      await pruneOldSnapshots(backupId);
      backupSecondario.riuscito = true;
    } catch (err) {
      backupSecondario.errore = (err as Error).message;
    }
  }

  return { data, tabs, backupSecondario };
}

/** Colonna Data soltanto: la colonna Dati può pesare decine di migliaia
 * di caratteri a riga, e per sapere quali giorni sono presenti non serve
 * scaricarla — lo stesso motivo per cui la colonna delle immagini resta
 * fuori dalle letture leggere in photos.ts. Funziona solo sul foglio
 * principale: readRange non prende un foglio alternativo, ma è anche
 * l'unico caso che conta davvero risparmiare, dato che lo stato mostrato
 * in Impostazioni guarda soprattutto il backup primario. */
async function leggiDateEsistentiPrimario(): Promise<string[]> {
  const colonna = await readRange(`${TAB}!A:A`);
  return colonna.slice(1).map((r) => r[0]).filter(Boolean);
}

async function pruneOldSnapshots(spreadsheetIdOverride?: string): Promise<void> {
  // La tab intera serve comunque per sapere QUALI righe eliminare (una
  // data vecchia può occupare più righe: una per tab, più eventuali parti
  // di una tab spezzata), quindi per il secondario — dove la scorciatoia
  // "solo colonna Data" non è disponibile — si legge subito tutta.
  const rows = await readSheet(TAB, spreadsheetIdOverride);
  const dateUniche = [...new Set(rows.slice(1).map((r) => r[0]).filter(Boolean))].sort();
  if (dateUniche.length <= MAX_SNAPSHOTS) return;

  const daRimuovere = new Set(dateUniche.slice(0, dateUniche.length - MAX_SNAPSHOTS));
  if (daRimuovere.size === 0) return;

  const rowsToDelete: number[] = [];
  rows.slice(1).forEach((row, i) => {
    if (daRimuovere.has(row[0])) rowsToDelete.push(i + 2); // +2: 1 per l'header, 1 perché gli indici del foglio partono da 1
  });

  await deleteRows(TAB, rowsToDelete, spreadsheetIdOverride);
}

export interface SnapshotStatus {
  primario: { ultimo: string | null; giorni: number };
  secondario: { configurato: boolean; ultimo: string | null; giorni: number; errore?: string };
}

/** Sola lettura, per mostrare lo stato in Impostazioni → Backup senza
 * scrivere nulla e senza scaricare il contenuto dei backup (solo la
 * colonna Data, per lo stesso motivo di leggiDateEsistentiPrimario). */
export async function getSnapshotStatus(): Promise<SnapshotStatus> {
  const dateUniche = [...new Set(await leggiDateEsistentiPrimario())].sort();
  const primario = {
    ultimo: dateUniche.length > 0 ? dateUniche[dateUniche.length - 1] : null,
    giorni: dateUniche.length,
  };

  const backupId = getBackupSpreadsheetId();
  if (!backupId) {
    return { primario, secondario: { configurato: false, ultimo: null, giorni: 0 } };
  }

  try {
    const rows = await readSheet(TAB, backupId);
    const dateSecondario = [...new Set(rows.slice(1).map((r) => r[0]).filter(Boolean))].sort();
    return {
      primario,
      secondario: {
        configurato: true,
        ultimo: dateSecondario.length > 0 ? dateSecondario[dateSecondario.length - 1] : null,
        giorni: dateSecondario.length,
      },
    };
  } catch (err) {
    return {
      primario,
      secondario: { configurato: true, ultimo: null, giorni: 0, errore: (err as Error).message },
    };
  }
}
