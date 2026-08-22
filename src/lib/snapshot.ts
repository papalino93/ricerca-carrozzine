import "server-only";
import { appendRow, deleteRows, readSheet } from "./sheets";
import { listDevices } from "./devices";

const TAB = "Snapshot";
const HEADER = ["Data", "Dati"];

/** Tiene gli ultimi 60 giorni: un backup al giorno per due mesi, poi si scartano i più vecchi. */
const MAX_SNAPSHOTS = 60;

/**
 * Scrive un backup giornaliero del magazzino in una tab dedicata.
 *
 * Deliberatamente SENZA le foto: sono ricostruibili, il magazzino non lo è,
 * e una foto da 45.000 caratteri per dispositivo farebbe sforare in poco
 * tempo il limite di 50.000 caratteri per cella. Con ~36 dispositivi il
 * JSON di un giorno pesa poche migliaia di caratteri: nella stessa cella
 * ne entrano comodamente decine di anni.
 */
export async function createSnapshot(): Promise<{ data: string; dispositivi: number }> {
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
  return { data, dispositivi: devices.length };
}

async function pruneOldSnapshots(): Promise<void> {
  const rows = await readSheet(TAB);
  const dataRowCount = rows.length - 1; // esclude l'intestazione
  if (dataRowCount <= MAX_SNAPSHOTS) return;

  const excess = dataRowCount - MAX_SNAPSHOTS;
  // I backup più vecchi sono in cima (appendRow accoda in fondo): righe del
  // foglio 2..(2+excess-1), la riga 1 è l'intestazione.
  const rowsToDelete = Array.from({ length: excess }, (_, i) => i + 2);
  await deleteRows(TAB, rowsToDelete);
}
