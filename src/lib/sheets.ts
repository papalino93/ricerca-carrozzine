import "server-only";
import { google, sheets_v4 } from "googleapis";

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;
// Nomi di tab già verificati/creati in questa istanza (evita una chiamata
// spreadsheets.get extra ad ogni scrittura mentre l'istanza serverless resta calda).
const knownTabs = new Set<string>();

function getAuth() {
  if (cachedAuth) return cachedAuth;

  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "Credenziali Google Sheets mancanti: imposta GOOGLE_SHEETS_CLIENT_EMAIL e GOOGLE_SHEETS_PRIVATE_KEY (vedi README)."
    );
  }

  cachedAuth = new google.auth.JWT({
    email,
    // Vercel/most .env systems store multi-line keys with literal "\n"
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return cachedAuth;
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_SHEETS_SPREADSHEET_ID non impostato (vedi README)."
    );
  }
  return id;
}

function getSheetsApi() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function isMissingRangeError(err: unknown): boolean {
  const message = (err as { message?: string } | undefined)?.message ?? "";
  return message.includes("Unable to parse range");
}

/**
 * Traduce in italiano gli errori tecnici più comuni dell'API di Google
 * Sheets (es. quota di lettura superata durante un picco di richieste);
 * lascia inalterato tutto il resto, per non nascondere errori applicativi
 * reali sotto un messaggio generico.
 */
function friendlyError(err: unknown): Error {
  const message = (err as { message?: string } | undefined)?.message ?? "";
  if (/quota exceeded/i.test(message)) {
    return new Error(
      "Troppe richieste a Google Sheets in questo momento: riprova tra qualche secondo."
    );
  }
  return err instanceof Error ? err : new Error(message || "Errore imprevisto");
}

/** Crea la tab se non esiste ancora (idempotente, con cache in memoria). */
async function ensureTab(sheets: sheets_v4.Sheets, spreadsheetId: string, tab: string): Promise<void> {
  if (knownTabs.has(tab)) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title);
  if (!existingTitles.includes(tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  knownTabs.add(tab);
}

/**
 * Legge un intervallo specifico (es. "Foto!A:C"), invece dell'intera tab.
 *
 * Serve per non scaricare colonne pesanti quando non servono: la colonna
 * delle immagini della tab Foto contiene data URI da ~45.000 caratteri
 * ciascuno, e leggerla per elencare i metadati significherebbe scaricare
 * decine di MB per mostrare qualche etichetta.
 */
export async function readRange(range: string): Promise<string[][]> {
  const sheets = getSheetsApi();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range,
    });
    return (res.data.values as string[][] | undefined) ?? [];
  } catch (err) {
    if (isMissingRangeError(err)) return [];
    throw friendlyError(err);
  }
}

/** Id numerico interno di una tab, necessario per le operazioni strutturali. */
async function getTabId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: string
): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const found = (meta.data.sheets ?? []).find((s) => s.properties?.title === tab);
  return found?.properties?.sheetId ?? null;
}

/**
 * Elimina righe specifiche di una tab (indici in base 1, intestazione = 1).
 *
 * Alternativa mirata alla riscrittura completa: togliere una foto dalla
 * galleria non deve comportare la rilettura e riscrittura di tutte le
 * immagini di tutti i dispositivi.
 */
export async function deleteRows(tab: string, rowNumbers: number[]): Promise<void> {
  if (rowNumbers.length === 0) return;
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = getSpreadsheetId();
    const tabId = await getTabId(sheets, spreadsheetId, tab);
    if (tabId == null) return;

    // Dal basso verso l'alto: eliminare una riga sposta in su quelle
    // successive, quindi partire dalle ultime mantiene validi gli indici.
    const ordered = [...new Set(rowNumbers)].sort((a, b) => b - a);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: ordered.map((row) => ({
          deleteDimension: {
            range: {
              sheetId: tabId,
              dimension: "ROWS",
              startIndex: row - 1, // l'API usa indici in base 0
              endIndex: row,
            },
          },
        })),
      },
    });
  } catch (err) {
    throw friendlyError(err);
  }
}

/**
 * Legge tutte le righe popolate di una tab, intestazione inclusa.
 * Se la tab non esiste ancora restituisce un elenco vuoto invece di errore.
 */
export async function readSheet(tab: string): Promise<string[][]> {
  const sheets = getSheetsApi();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: getSpreadsheetId(),
      range: tab,
    });
    return (res.data.values as string[][] | undefined) ?? [];
  } catch (err) {
    if (isMissingRangeError(err)) return [];
    throw friendlyError(err);
  }
}

/**
 * Sostituisce l'intero contenuto di una tab (intestazione inclusa), creandola se manca.
 *
 * IMPORTANTE: scrive prima i dati nuovi e solo dopo elimina le righe residue
 * più lunghe del contenuto precedente — non il contrario. Con un "clear" prima
 * dell'"update" (come faceva questa funzione originariamente) qualsiasi errore
 * nella scrittura (una cella oltre il limite di 50.000 caratteri di Google,
 * quota di scrittura superata, timeout della funzione) lascia la tab
 * completamente vuota: l'intero magazzino perso per un singolo salvataggio
 * falito. Scrivendo prima, un errore lascia semplicemente il contenuto
 * precedente intatto.
 */
export async function writeSheet(tab: string, rows: string[][]): Promise<void> {
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = getSpreadsheetId();
    await ensureTab(sheets, spreadsheetId, tab);

    if (rows.length === 0) {
      // Nessun contenuto nuovo da proteggere: qui svuotare è l'operazione richiesta.
      await sheets.spreadsheets.values.clear({ spreadsheetId, range: tab });
      return;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    // Elimina solo le righe eventualmente residue di un contenuto precedente
    // più lungo di quello appena scritto (range aperto: dalla riga successiva
    // all'ultima della tab).
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tab}!A${rows.length + 1}:ZZ`,
    });
  } catch (err) {
    throw friendlyError(err);
  }
}

/**
 * Accoda una riga in fondo a una tab (creandola con l'intestazione se manca),
 * senza dover rileggere/riscrivere tutto il contenuto esistente.
 */
export async function appendRow(tab: string, row: string[], header?: string[]): Promise<void> {
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = getSpreadsheetId();
    const isNewTab = !knownTabs.has(tab);
    await ensureTab(sheets, spreadsheetId, tab);

    if (isNewTab && header) {
      const existing = await readSheet(tab);
      if (existing.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tab}!A1`,
          valueInputOption: "RAW",
          requestBody: { values: [header] },
        });
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: tab,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (err) {
    throw friendlyError(err);
  }
}
