import "server-only";
import { appendRow, deleteRows, getBackupSpreadsheetId, readSheet } from "./sheets";
import { listDevices } from "./devices";

const TAB = "Snapshot";
const HEADER = ["Data", "Dati"];

/** Tiene gli ultimi 60 giorni: un backup al giorno per due mesi, poi si scartano i più vecchi. */
const MAX_SNAPSHOTS = 60;

export interface BackupSecondarioStatus {
  /** false se GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID non è ancora impostato. */
  configurato: boolean;
  riuscito: boolean;
  errore?: string;
}

export interface SnapshotResult {
  data: string;
  dispositivi: number;
  backupSecondario: BackupSecondarioStatus;
}

/**
 * Scrive un backup giornaliero del magazzino: prima nella tab "Snapshot" del
 * foglio principale (come sempre), poi — se configurato — anche in un
 * secondo foglio Google del tutto separato (vedi getBackupSpreadsheetId).
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
 *
 * Deliberatamente SENZA le foto: sono ricostruibili, il magazzino non lo è,
 * e una foto da 45.000 caratteri per dispositivo farebbe sforare in poco
 * tempo il limite di 50.000 caratteri per cella. Con qualche centinaio di
 * dispositivi il JSON di un giorno pesa poche migliaia di caratteri: nella
 * stessa cella ne entrano comodamente decine di anni.
 */
export async function createSnapshot(): Promise<SnapshotResult> {
  const devices = await listDevices();
  const stripped = devices.map(({ foto: _foto, ...rest }) => rest);
  const data = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify(stripped);

  if (json.length > 49_000) {
    // Non dovrebbe succedere a questa scala, ma un guasto silenzioso qui
    // sarebbe peggio di un errore esplicito nel log del cron.
    throw new Error(
      `Snapshot troppo grande per una cella (${json.length} caratteri): il backup automatico va rivisto.`
    );
  }

  await appendRow(TAB, [data, json], HEADER);
  await pruneOldSnapshots();

  const backupId = getBackupSpreadsheetId();
  const backupSecondario: BackupSecondarioStatus = { configurato: Boolean(backupId), riuscito: false };
  if (backupId) {
    try {
      await appendRow(TAB, [data, json], HEADER, backupId);
      await pruneOldSnapshots(backupId);
      backupSecondario.riuscito = true;
    } catch (err) {
      backupSecondario.errore = (err as Error).message;
    }
  }

  return { data, dispositivi: devices.length, backupSecondario };
}

async function pruneOldSnapshots(spreadsheetIdOverride?: string): Promise<void> {
  const rows = await readSheet(TAB, spreadsheetIdOverride);
  const dataRowCount = rows.length - 1; // esclude l'intestazione
  if (dataRowCount <= MAX_SNAPSHOTS) return;

  const excess = dataRowCount - MAX_SNAPSHOTS;
  // I backup più vecchi sono in cima (appendRow accoda in fondo): righe del
  // foglio 2..(2+excess-1), la riga 1 è l'intestazione.
  const rowsToDelete = Array.from({ length: excess }, (_, i) => i + 2);
  await deleteRows(TAB, rowsToDelete, spreadsheetIdOverride);
}

export interface SnapshotStatus {
  primario: { ultimo: string | null; totale: number };
  secondario: { configurato: boolean; ultimo: string | null; totale: number; errore?: string };
}

/** Sola lettura, per mostrare lo stato in Impostazioni → Backup senza scrivere nulla. */
export async function getSnapshotStatus(): Promise<SnapshotStatus> {
  const primaryRows = await readSheet(TAB);
  const primario = {
    ultimo: primaryRows.length > 1 ? (primaryRows[primaryRows.length - 1][0] ?? null) : null,
    totale: Math.max(0, primaryRows.length - 1),
  };

  const backupId = getBackupSpreadsheetId();
  if (!backupId) {
    return { primario, secondario: { configurato: false, ultimo: null, totale: 0 } };
  }

  try {
    const rows = await readSheet(TAB, backupId);
    return {
      primario,
      secondario: {
        configurato: true,
        ultimo: rows.length > 1 ? (rows[rows.length - 1][0] ?? null) : null,
        totale: Math.max(0, rows.length - 1),
      },
    };
  } catch (err) {
    return {
      primario,
      secondario: { configurato: true, ultimo: null, totale: 0, errore: (err as Error).message },
    };
  }
}
