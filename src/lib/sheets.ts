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
    throw err;
  }
}

/** Sostituisce l'intero contenuto di una tab (intestazione inclusa), creandola se manca. */
export async function writeSheet(tab: string, rows: string[][]): Promise<void> {
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();
  await ensureTab(sheets, spreadsheetId, tab);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: tab });
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

/**
 * Accoda una riga in fondo a una tab (creandola con l'intestazione se manca),
 * senza dover rileggere/riscrivere tutto il contenuto esistente.
 */
export async function appendRow(tab: string, row: string[], header?: string[]): Promise<void> {
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
}
