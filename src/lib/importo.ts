/**
 * Legge un numero scritto da una persona dentro il foglio Google.
 *
 * I fogli si modificano anche a mano, e in italiano una cifra si scrive
 * con la virgola: `Number("100,50")` però vale NaN. Da lì il danno si
 * propaga in silenzio, in modi diversi a seconda di chi legge — c'era chi
 * riscriveva "NaN" nella cella al salvataggio successivo (perdendo la
 * cifra originale) e chi, con `Number(v) || 0`, trasformava una tariffa da
 * 12,50 € in una tariffa da zero.
 *
 * Si accettano quindi la virgola come separatore decimale, il punto come
 * separatore delle migliaia, il simbolo di valuta e gli spazi. Quello che
 * resta incomprensibile torna null e non NaN: chi chiama decide cosa fare
 * di una cifra mancante, mentre NaN si propaga da solo.
 */
export function parseNumero(v: string | undefined | null): number | null {
  if (v == null) return null;
  const testo = v.trim();
  if (testo === "") return null;
  const pulito = testo
    .replace(/[€\s ]/g, "")
    // Il punto separa le migliaia solo se ha esattamente tre cifre dopo:
    // in "1.234,50" va tolto, in "100.50" è il separatore decimale.
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(pulito);
  return Number.isFinite(n) ? n : null;
}
