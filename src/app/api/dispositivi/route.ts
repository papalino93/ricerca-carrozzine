import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { deleteDevice, listDevices, upsertDevice, type Device } from "@/lib/devices";

export const runtime = "nodejs";

// Pubblica: la pagina di ricerca la usa senza autenticazione.
export async function GET() {
  try {
    const devices = await listDevices();
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// Scrittura: riservata all'amministrazione.
export async function POST(req: NextRequest) {
  const unauthorized = requireBasicAuth(req);
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
  const unauthorized = requireBasicAuth(req);
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
