import "server-only";
import sharp from "sharp";

// Le celle di Google Sheets hanno un limite di 50.000 caratteri: restiamo
// sotto con margine per qualunque immagine venga salvata in una cella
// (logo aziendale, foto dispositivo, ecc.).
const MAX_DATA_URI_LENGTH = 45_000;

/**
 * Ridimensiona/comprime un'immagine finché il suo data URI (JPEG, sfondo
 * appiattito su bianco) non entra in una cella del foglio Google.
 * Lancia un errore se non ci riesce nemmeno alla compressione massima.
 */
export async function imageToDataUri(original: Buffer): Promise<string> {
  let width = 480;
  let quality = 82;
  let dataUri = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const resized = await sharp(original)
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality })
      .toBuffer();
    dataUri = `data:image/jpeg;base64,${resized.toString("base64")}`;
    if (dataUri.length <= MAX_DATA_URI_LENGTH) return dataUri;
    width = Math.round(width * 0.75);
    quality = Math.max(40, quality - 15);
  }

  throw new Error(
    "L'immagine è troppo pesante anche dopo la compressione: prova un'immagine più semplice o più piccola."
  );
}
