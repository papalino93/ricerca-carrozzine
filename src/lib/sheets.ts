import "server-only";
import { google } from "googleapis";

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;

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

/** Reads every populated row of a tab, including the header row. */
export async function readSheet(tab: string): Promise<string[][]> {
  const sheets = getSheetsApi();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: tab,
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

/** Replaces the entire contents of a tab (header row included). */
export async function writeSheet(tab: string, rows: string[][]): Promise<void> {
  const sheets = getSheetsApi();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: tab });
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
