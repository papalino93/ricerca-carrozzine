import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireBasicAuth } from "@/lib/basic-auth";

export const runtime = "nodejs";

// Endpoint temporaneo, usato una sola volta per recuperare dalla cronologia
// versioni di Google Drive il vecchio campo "categoria" (sottotipo
// carrozzina: Autospinta/Transito/Bimbi) sovrascritto per errore dalla
// migrazione della funzione categorie. Da rimuovere dopo l'uso.
export async function GET(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  const fileId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!email || !key || !fileId) {
    return NextResponse.json({ error: "Credenziali mancanti" }, { status: 500 });
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });

  try {
    const drive = google.drive({ version: "v3", auth });
    const list = await drive.revisions.list({
      fileId,
      fields: "revisions(id,modifiedTime,size)",
    });
    return NextResponse.json({ revisions: list.data.revisions ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
