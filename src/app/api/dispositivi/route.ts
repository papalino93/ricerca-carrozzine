import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { deleteDevice, listDevices, upsertDevice, type Device } from "@/lib/devices";
import { toPublicDevice } from "@/lib/device-types";

export const runtime = "nodejs";

// Accessibile a chiunque sia autenticato (vedi proxy.ts): telefono e contratto
// restano comunque riservati alla sola amministrazione, non vengono
// restituiti qui (vedi toPublicDevice).
export async function GET() {
  try {
    const devices = await listDevices();
    return NextResponse.json({ devices: devices.map(toPublicDevice) });
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
