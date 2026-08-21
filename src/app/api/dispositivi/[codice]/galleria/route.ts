import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { addDevicePhoto, listDevicePhotos, removeDevicePhoto } from "@/lib/photos";
import { imageToDataUri } from "@/lib/image-to-data-uri";

export const runtime = "nodejs";

// Riservata all'amministrazione: galleria di foto aggiuntive per dispositivo
// (oltre alla foto principale gestita da /foto), lista aperta e non a slot fissi.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ codice: string }> }
) {
  const unauthorized = await requireBasicAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const { codice } = await params;
    const photos = await listDevicePhotos(codice);
    return NextResponse.json({ photos });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

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
    const tipo = form.get("tipo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file ricevuto" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Il file deve essere un'immagine" }, { status: 400 });
    }

    const dataUri = await imageToDataUri(Buffer.from(await file.arrayBuffer()));
    const photos = await addDevicePhoto({
      codice,
      tipo: typeof tipo === "string" ? tipo : "",
      immagine: dataUri,
    });
    return NextResponse.json({ photos });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
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
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Id foto obbligatorio" }, { status: 400 });
    }
    const photos = await removeDevicePhoto(codice, id);
    return NextResponse.json({ photos });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
