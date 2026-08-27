import "server-only";
import { google, sheets_v4 } from "googleapis";

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;
// Tab già verificate/create in questa istanza (evita una chiamata
// spreadsheets.get extra ad ogni scrittura mentre l'istanza serverless resta
// calda). Chiave "spreadsheetId::tab": con due fogli diversi (principale e
// backup, vedi getBackupSpreadsheetId) lo stesso nome tab esiste in entrambi
// ma è una tab diversa in ognuno — una cache per solo nome li confonderebbe.
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

/**
 * ID di un secondo foglio Google, separato da quello principale, usato solo
 * come destinazione di backup (vedi snapshot.ts): se il file principale si
 * danneggia o viene eliminato, un backup nella STESSA cartella/file non
 * serve a nulla. Facoltativo (a differenza di GOOGLE_SHEETS_SPREADSHEET_ID):
 * ritorna null invece di lanciare un errore se non è ancora configurato, così
 * il backup "vecchio" (stessa cartella) continua a funzionare comunque.
 */
export function getBackupSpreadsheetId(): string | null {
  return process.env.GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID || null;
}

function getSheetsApi() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

/**
 * Vero per gli errori che passano da soli: quota superata, un 5xx di
 * Google, la connessione caduta a metà. Riprovare ha senso solo per
 * questi — su un problema di permessi o su un foglio inesistente, il
 * secondo tentativo fallirebbe esattamente come il primo, e nel frattempo
 * chi sta aspettando la pagina aspetta il doppio.
 */
function isTransientError(err: unknown): boolean {
  const e = err as { code?: number | string; status?: number; message?: string } | undefined;
  const code = Number(e?.code ?? e?.status);
  if (code === 429 || (code >= 500 && code < 600)) return true;
  const message = e?.message ?? "";
  return /quota exceeded|rate limit|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|backend error|internal error/i.test(
    message
  );
}

/**
 * Esegue una lettura da Google Sheets riprovando quando l'errore è di
 * quelli passeggeri.
 *
 * Il motivo: ogni pagina fa più letture, e un singolo intoppo di Google
 * diventava una pagina di errore in faccia all'operatore. Due tentativi in
 * più, a un quarto e a mezzo secondo, coprono praticamente tutti i casi
 * senza far percepire attesa a chi guarda lo schermo.
 */
async function conRiprova<T>(operazione: () => Promise<T>): Promise<T> {
  const attese = [250, 500];
  for (let tentativo = 0; ; tentativo++) {
    try {
      return await operazione();
    } catch (err) {
      if (tentativo >= attese.length || !isTransientError(err)) throw err;
      await new Promise((r) => setTimeout(r, attese[tentativo]));
    }
  }
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
  const cacheKey = `${spreadsheetId}::${tab}`;
  if (knownTabs.has(cacheKey)) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title);
  if (!existingTitles.includes(tab)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  knownTabs.add(cacheKey);
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
    const res = await conRiprova(() =>
      sheets.spreadsheets.values.get({ spreadsheetId: getSpreadsheetId(), range })
    );
    return (res.data.values as string[][] | undefined) ?? [];
  } catch (err) {
    if (isMissingRangeError(err)) return [];
    throw friendlyError(err);
  }
}

/**
 * Elenca i nomi di tutte le tab del foglio.
 *
 * Serve al backup: le tab da salvare si scoprono a runtime invece di
 * essere elencate nel codice, così una tab aggiunta in futuro finisce nel
 * backup da sola. Un elenco scritto a mano è esattamente il tipo di cosa
 * che ci si dimentica di aggiornare, e ce ne si accorge il giorno in cui
 * serve il backup.
 */
export async function listTabNames(spreadsheetIdOverride?: string): Promise<string[]> {
  const sheets = getSheetsApi();
  try {
    const meta = await conRiprova(() =>
      sheets.spreadsheets.get({ spreadsheetId: spreadsheetIdOverride ?? getSpreadsheetId() })
    );
    return (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t));
  } catch (err) {
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
export async function deleteRows(tab: string, rowNumbers: number[], spreadsheetIdOverride?: string): Promise<void> {
  if (rowNumbers.length === 0) return;
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = spreadsheetIdOverride ?? getSpreadsheetId();
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
export async function readSheet(tab: string, spreadsheetIdOverride?: string): Promise<string[][]> {
  const sheets = getSheetsApi();
  try {
    const res = await conRiprova(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetIdOverride ?? getSpreadsheetId(),
        range: tab,
      })
    );
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
export async function writeSheet(tab: string, rows: string[][], spreadsheetIdOverride?: string): Promise<void> {
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = spreadsheetIdOverride ?? getSpreadsheetId();
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
 * Accoda più righe in fondo a una tab in una sola chiamata (creandola con
 * l'intestazione se manca).
 *
 * Serve dove appendRow, chiamata una volta per riga, costerebbe una
 * richiesta HTTP per riga: il backup completo scrive una decina di righe
 * (una o più per ciascuna tab del gestionale) e farlo con una singola
 * chiamata invece di dieci evita sia la lentezza sia il rischio di quota,
 * oltre a rendere la scrittura tutta-o-niente invece che a metà se una
 * delle dieci chiamate fallisse a metà del giro.
 */
export async function appendRows(
  tab: string,
  rows: string[][],
  header?: string[],
  spreadsheetIdOverride?: string
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = spreadsheetIdOverride ?? getSpreadsheetId();
    const isNewTab = !knownTabs.has(`${spreadsheetId}::${tab}`);
    await ensureTab(sheets, spreadsheetId, tab);

    if (isNewTab && header) {
      const existing = await readSheet(tab, spreadsheetIdOverride);
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
      requestBody: { values: rows },
    });
  } catch (err) {
    throw friendlyError(err);
  }
}

/**
 * Accoda una riga in fondo a una tab (creandola con l'intestazione se manca),
 * senza dover rileggere/riscrivere tutto il contenuto esistente.
 */
export async function appendRow(
  tab: string,
  row: string[],
  header?: string[],
  spreadsheetIdOverride?: string
): Promise<void> {
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = spreadsheetIdOverride ?? getSpreadsheetId();
    const isNewTab = !knownTabs.has(`${spreadsheetId}::${tab}`);
    await ensureTab(sheets, spreadsheetId, tab);

    if (isNewTab && header) {
      const existing = await readSheet(tab, spreadsheetIdOverride);
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
