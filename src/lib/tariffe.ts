import "server-only";
import { readSheet, writeSheet } from "./sheets";
import { type Tariffa } from "./tariffe-types";

export type { Tariffa, TariffaUnita } from "./tariffe-types";
export { findTariffa, fmtTariffa } from "./tariffe-types";

const TAB = "Tariffe";
const HEADER = ["Categoria", "Sottocategoria", "Importo", "Unita", "Nota"];

// Tariffario fornito dall'utente ("TARIFFE NOLEGGIO DAL 01/03/2026"): usato
// solo per popolare la tab la prima volta che viene letta vuota, così non
// deve ridigitare a mano una ventina di righe già note. Modificabile/
// cancellabile liberamente da Impostazioni → Tariffe una volta importato.
const DEFAULT_TARIFFE: Tariffa[] = [
  { categoria: "Carrozzine", sottocategoria: null, importo: 3.5, unita: "giorno", nota: null },
  { categoria: "Carrozzine", sottocategoria: "Elettrica", importo: 8, unita: "giorno", nota: null },
  { categoria: "Rollatori", sottocategoria: null, importo: 2.5, unita: "giorno", nota: null },
  { categoria: "Stampelle", sottocategoria: null, importo: 1, unita: "giorno", nota: null },
  { categoria: "Aste per flebo", sottocategoria: null, importo: 1.5, unita: "giorno", nota: null },
  { categoria: "Deambulatori ascellari", sottocategoria: null, importo: 2.5, unita: "giorno", nota: null },
  { categoria: "Elettromedicali vari", sottocategoria: "Elettrostimolatore", importo: 3.5, unita: "giorno", nota: null },
  { categoria: "Elettromedicali vari", sottocategoria: "Ultrasuono", importo: 3.5, unita: "giorno", nota: null },
  { categoria: "Magnetoterapia", sottocategoria: null, importo: 6, unita: "giorno", nota: null },
  { categoria: "Magnetoterapia", sottocategoria: "Con cuscino 40x40", importo: 7, unita: "giorno", nota: null },
  { categoria: "Magnetoterapia", sottocategoria: "Con materasso", importo: 8, unita: "giorno", nota: null },
  { categoria: "Kinetek", sottocategoria: null, importo: 85, unita: "settimana", nota: null },
  { categoria: "Letti", sottocategoria: null, importo: 3, unita: "giorno", nota: "+ ritiro e consegna 20/30€" },
  { categoria: "Alzamalati", sottocategoria: null, importo: 2, unita: "giorno", nota: null },
  { categoria: "Sollevatori", sottocategoria: "Idraulico", importo: 3.5, unita: "giorno", nota: null },
  { categoria: "Sollevatori", sottocategoria: "Elettrico", importo: 5.5, unita: "giorno", nota: null },
  { categoria: "Sponde", sottocategoria: null, importo: 2.5, unita: "giorno", nota: null },
  { categoria: "Compressori", sottocategoria: null, importo: 1.5, unita: "giorno", nota: "+ 35€ materassino" },
];

function toTariffa(row: string[]): Tariffa | null {
  const [categoria, sottocategoria, importo, unita, nota] = row;
  if (!categoria) return null;
  return {
    categoria,
    sottocategoria: sottocategoria || null,
    importo: Number(importo) || 0,
    unita: unita === "settimana" ? "settimana" : "giorno",
    nota: nota || null,
  };
}

function toRow(t: Tariffa): string[] {
  return [t.categoria, t.sottocategoria ?? "", String(t.importo), t.unita, t.nota ?? ""];
}

async function saveAllTariffe(tariffe: Tariffa[]): Promise<void> {
  await writeSheet(TAB, [HEADER, ...tariffe.map(toRow)]);
}

export async function listTariffe(): Promise<Tariffa[]> {
  const rows = await readSheet(TAB);
  // Solo se il foglio non esiste proprio (nessuna riga, nemmeno
  // l'intestazione): un foglio con la sola intestazione significa che le
  // tariffe sono state eliminate di proposito, e riscriverci dentro i valori
  // predefiniti le farebbe ricomparire tutte al primo ricaricamento.
  if (rows.length === 0) {
    await saveAllTariffe(DEFAULT_TARIFFE);
    return DEFAULT_TARIFFE;
  }
  return rows.slice(1).map(toTariffa).filter((t): t is Tariffa => t !== null);
}

function sameKey(a: { categoria: string; sottocategoria: string | null }, b: { categoria: string; sottocategoria: string | null }): boolean {
  return (
    a.categoria.trim().toLowerCase() === b.categoria.trim().toLowerCase() &&
    (a.sottocategoria ?? "").trim().toLowerCase() === (b.sottocategoria ?? "").trim().toLowerCase()
  );
}

/** Aggiunge una tariffa, o sostituisce quella esistente con la stessa coppia categoria/sottocategoria. */
export async function upsertTariffa(t: Tariffa): Promise<Tariffa[]> {
  if (!t.categoria.trim()) throw new Error("La categoria è obbligatoria");
  if (!(t.importo > 0)) throw new Error("L'importo deve essere maggiore di zero");
  const tariffe = await listTariffe();
  const idx = tariffe.findIndex((x) => sameKey(x, t));
  if (idx >= 0) tariffe[idx] = t;
  else tariffe.push(t);
  await saveAllTariffe(tariffe);
  return tariffe;
}

export async function removeTariffa(categoria: string, sottocategoria: string | null): Promise<Tariffa[]> {
  const tariffe = await listTariffe();
  const next = tariffe.filter((x) => !sameKey(x, { categoria, sottocategoria }));
  await saveAllTariffe(next);
  return next;
}
