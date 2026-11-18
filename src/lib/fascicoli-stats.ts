// Calcola solo sull'elenco di FascicoloRecord già in memoria (vedi
// device-stats.ts per lo stesso principio sul magazzino): nessuna lettura
// aggiuntiva da Google Sheets.

import type { FascicoloRecord } from "./fascicoli-types";

export interface YearlyFascicoliStats {
  anno: number;
  totale: number;
  asl: number;
  privati: number;
}

function yearOf(iso: string): number | null {
  const year = Number(iso.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/** Anni per cui esiste almeno una fascicolazione creata, dal più recente. */
export function availableFascicoliYears(fascicoli: FascicoloRecord[]): number[] {
  const years = new Set<number>();
  for (const f of fascicoli) {
    const year = yearOf(f.dataCreazione);
    if (year) years.add(year);
  }
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

export function yearlyFascicoliStats(fascicoli: FascicoloRecord[], anno: number): YearlyFascicoliStats {
  const delAnno = fascicoli.filter((f) => yearOf(f.dataCreazione) === anno);
  const asl = delAnno.filter((f) => f.contenuto.prescrizione.praticaAsl).length;
  return { anno, totale: delAnno.length, asl, privati: delAnno.length - asl };
}
