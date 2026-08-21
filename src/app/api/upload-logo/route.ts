import { NextRequest, NextResponse } from "next/server";
import { imageToDataUri } from "@/lib/image-to-data-uri";

export const runtime = "nodejs";

// Protetta dal middleware (stessa Basic Auth dell'admin). Il logo viene
// salvato come data URI dentro la cella LogoURL del foglio Google (tab
// Impostazioni), non su uno storage esterno.
export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ url: dataUri });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
