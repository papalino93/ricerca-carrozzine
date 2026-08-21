// Genera le icone PNG (PWA + apple-touch + favicon) dal logo raster
// sorgente in scripts/brand-src/logo-source.png, usando sharp.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.join(root, "scripts/brand-src/logo-source.png");

const INK = "#16302E";

/** Icona piena, senza sfondo (per il favicon del browser). */
async function renderTransparent(size, outPath) {
  const inner = Math.round(size * 0.86);
  const padLeft = Math.floor((size - inner) / 2);
  const padRight = size - inner - padLeft;
  const info = await sharp(source)
    .resize(inner, inner, { fit: "contain" })
    .extend({
      top: padLeft,
      bottom: padRight,
      left: padLeft,
      right: padRight,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);
  if (info.width !== size || info.height !== size) {
    throw new Error(`${outPath}: expected ${size}x${size}, got ${info.width}x${info.height}`);
  }
  console.log("wrote", outPath, `${info.width}x${info.height}`);
}

/** Icona su sfondo verde-petrolio arrotondato (per home screen / PWA). */
async function renderBadge(size, outPath) {
  const radius = Math.round(size * 0.22);
  const roundedCorners = Buffer.from(
    `<svg width="${size}" height="${size}"><rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${INK}"/></svg>`
  );
  const logo = await sharp(source)
    .resize(Math.round(size * 0.66), Math.round(size * 0.66), { fit: "contain" })
    .toBuffer();

  await sharp(roundedCorners)
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log("wrote", outPath);
}

/** Incapsula un PNG in un .ico valido (supportato da tutti i browser/OS moderni). */
function pngToIco(pngPath, icoPath, size) {
  const png = readFileSync(pngPath);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  writeFileSync(icoPath, Buffer.concat([header, entry, png]));
  console.log("wrote", icoPath);
}

await renderBadge(512, path.join(root, "public/icon-512.png"));
await renderBadge(192, path.join(root, "public/icon-192.png"));
await renderBadge(180, path.join(root, "public/apple-icon.png"));
await renderTransparent(32, path.join(root, "public/favicon-32.png"));
await renderTransparent(160, path.join(root, "public/logo.png"));

pngToIco(
  path.join(root, "public/favicon-32.png"),
  path.join(root, "src/app/favicon.ico"),
  32
);
