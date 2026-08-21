import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireBasicAuth } from "@/lib/basic-auth";
import { listDevices, saveAllDevices } from "@/lib/devices";

export const runtime = "nodejs";

// Applica la mappa {codice: sottocategoria} recuperata dalla revisione
// precedente alla migrazione, senza toccare nessun altro campo.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { mapping } = (await req.json()) as { mapping: Record<string, string> };
    const devices = await listDevices();
    const updated = devices.map((d) =>
      mapping[d.codice] ? { ...d, sottocategoria: mapping[d.codice] } : d
    );
    await saveAllDevices(updated);
    return NextResponse.json({ devices: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

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

  const revisionId = req.nextUrl.searchParams.get("revisionId");
  if (!revisionId) {
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

  try {
    const sheets = google.sheets({ version: "v4", auth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId, fields: "sheets.properties" });
    const dispositiviSheet = meta.data.sheets?.find(
      (s) => s.properties?.title === "Dispositivi"
    );
    const gid = dispositiviSheet?.properties?.sheetId;

    const drive = google.drive({ version: "v3", auth });
    const rev = await drive.revisions.get({
      fileId,
      revisionId,
      fields: "exportLinks",
    });
    const links = rev.data.exportLinks ?? {};
    const csvLink = links["text/csv"];
    if (!csvLink) {
      return NextResponse.json({ error: "Nessun link CSV disponibile", links }, { status: 404 });
    }

    const token = await auth.getAccessToken();
    const url = gid != null ? `${csvLink}&gid=${gid}` : csvLink;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    const csv = await res.text();
    return new NextResponse(csv, {
      status: res.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
