import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { archiveDevice, unarchiveDevice } from "@/lib/devices";
import type { ArchiveStatus } from "@/lib/device-types";

export const runtime = "nodejs";

interface ArchivioBody {
  tipo: ArchiveStatus;
}

// Riservata all'amministrazione: segna un dispositivo come venduto/rottamato.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const body = (await req.json()) as ArchivioBody;
    if (body.tipo !== "venduto" && body.tipo !== "rottamato") {
      return NextResponse.json({ error: "Tipo di archiviazione non valido" }, { status: 400 });
    }
    const devices = await archiveDevice(codice, body.tipo);
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// Riservata all'amministrazione: riporta un dispositivo archiviato in magazzino attivo.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const devices = await unarchiveDevice(codice);
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
