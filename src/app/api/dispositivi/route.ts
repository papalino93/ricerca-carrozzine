import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { deleteDevice, listDevices, upsertDevice, type Device } from "@/lib/devices";

export const runtime = "nodejs";

// Accessibile a chiunque sia autenticato (vedi proxy.ts). Nessun campo
// viene più nascosto: l'accesso all'app è uno solo e chi entra vede
// comunque tutto da /admin, mentre oscurare telefono, numero di noleggio e
// prezzi qui rompeva la ricerca per numero di contratto e faceva salvare
// campi vuoti sopra i prezzi reali. "?vista=admin" resta solo per decidere
// se includere gli archiviati.
export async function GET(req: NextRequest) {
  try {
    const devices = await listDevices();
    const full = req.nextUrl.searchParams.get("vista") === "admin";
    // Un dispositivo venduto/rottamato non è più noleggiabile: fuori dalla
    // vista pubblica (come il caricamento iniziale della home, vedi
    // app/page.tsx), visibile solo da admin dietro "Mostra archiviati".
    const visible = full ? devices : devices.filter((d) => !d.archiviato);
    return NextResponse.json({ devices: visible });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Scrittura: riservata all'amministrazione.
export async function POST(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const body = (await req.json()) as Device;
    if (!body.codice) {
      return NextResponse.json({ error: "Codice obbligatorio" }, { status: 400 });
    }
    const devices = await upsertDevice(body);
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const codice = req.nextUrl.searchParams.get("codice");
    if (!codice) {
      return NextResponse.json({ error: "Codice obbligatorio" }, { status: 400 });
    }
    const devices = await deleteDevice(codice);
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
