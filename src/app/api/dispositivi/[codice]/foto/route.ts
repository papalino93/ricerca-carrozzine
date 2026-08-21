import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { setDevicePhoto } from "@/lib/devices";
import { imageToDataUri } from "@/lib/image-to-data-uri";

export const runtime = "nodejs";

// Riservata all'amministrazione: salva la foto come data URI nella riga del dispositivo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file ricevuto" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Il file deve essere un'immagine" },
        { status: 400 }
      );
    }

    const dataUri = await imageToDataUri(Buffer.from(await file.arrayBuffer()));
    const devices = await setDevicePhoto(codice, dataUri);
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const devices = await setDevicePhoto(codice, null);
    return NextResponse.json({ devices });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
