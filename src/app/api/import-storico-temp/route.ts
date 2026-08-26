import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireBasicAuth } from "@/lib/basic-auth";
import type { HistoryEvent } from "@/lib/history";

export const runtime = "nodejs";

// Endpoint temporaneo, usato una tantum per completare lo storico noleggi
// dei dispositivi importati dagli Excel di magazzino (vedi conversazione):
// da rimuovere subito dopo l'uso, non è pensato per restare. Un'unica
// scrittura batch (non un giro di appendHistoryEvent per riga) per stare
// dentro i limiti di tempo di una funzione serverless.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as { events: HistoryEvent[] };
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return NextResponse.json({ error: "events deve essere un array non vuoto" }, { status: 400 });
    }

    const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!email || !key || !spreadsheetId) {
      return NextResponse.json({ error: "Credenziali Google Sheets mancanti" }, { status: 500 });
    }

    const auth = new google.auth.JWT({
      email,
      key: key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const rows = body.events.map((e) => [
      e.data,
      e.codice,
      e.evento,
      e.cliente ?? "",
      e.telefono ?? "",
      e.contratto ?? "",
      e.nota ?? "",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Storico!A:G",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    return NextResponse.json({ ok: true, scritti: rows.length });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
