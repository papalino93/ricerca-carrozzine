import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

// Il logo viene salvato come data URI dentro la cella LogoURL del foglio
// Google (tab Impostazioni), non su uno storage esterno: niente account o
// token da configurare. Le celle di Google Sheets hanno un limite di 50.000
// caratteri, quindi comprimiamo l'immagine finché non ci sta con margine.
const MAX_DATA_URI_LENGTH = 45_000;

// Protetta dal middleware (stessa Basic Auth dell'admin).
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

    const original = Buffer.from(await file.arrayBuffer());

    let width = 480;
    let quality = 82;
    let dataUri = "";
    for (let attempt = 0; attempt < 6; attempt++) {
      const resized = await sharp(original)
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        // Appiattisce la trasparenza su bianco: JPEG comprime molto meglio
        // del PNG ed è il formato che il generatore di PDF sa leggere con certezza.
        .flatten({ background: "#ffffff" })
        .jpeg({ quality })
        .toBuffer();
      dataUri = `data:image/jpeg;base64,${resized.toString("base64")}`;
      if (dataUri.length <= MAX_DATA_URI_LENGTH) break;
      width = Math.round(width * 0.75);
      quality = Math.max(40, quality - 15);
    }

    if (dataUri.length > MAX_DATA_URI_LENGTH) {
      return NextResponse.json(
        {
          error:
            "Il logo è troppo pesante anche dopo la compressione: prova un'immagine più semplice o più piccola.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: dataUri });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
