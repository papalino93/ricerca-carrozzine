// Nessuna dipendenza da googleapis: calcola solo su un elenco di Device già
// in memoria, così lo stesso elenco caricato per il magazzino alimenta anche
// le statistiche, senza una seconda lettura da Google Sheets.

import type { Device } from "./device-types";

export interface YearlyDeviceStats {
  anno: number;
  aggiunti: { conteggio: number; totaleAcquisto: number };
  venduti: { conteggio: number; totaleVendita: number };
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const year = Number(iso.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/** Anni per cui esiste almeno un dato (inserimento o vendita), dal più
 * recente: popola il selettore senza mostrare anni vuoti. */
export function availableStatsYears(devices: Device[]): number[] {
  const years = new Set<number>();
  for (const d of devices) {
    const inserito = yearOf(d.dataInserimento);
    if (inserito) years.add(inserito);
    const venduto = yearOf(d.dataArchiviazione);
    if (venduto) years.add(venduto);
  }
  const currentYear = new Date().getFullYear();
  years.add(currentYear);
  return [...years].sort((a, b) => b - a);
}

export function yearlyDeviceStats(devices: Device[], anno: number): YearlyDeviceStats {
  const aggiuntiAnno = devices.filter((d) => yearOf(d.dataInserimento) === anno);
  const vendutiAnno = devices.filter(
    (d) => d.archiviato === "venduto" && yearOf(d.dataArchiviazione) === anno
  );

  return {
    anno,
    aggiunti: {
      conteggio: aggiuntiAnno.length,
      totaleAcquisto: aggiuntiAnno.reduce((n, d) => n + (d.prezzoAcquisto ?? 0), 0),
    },
    venduti: {
      conteggio: vendutiAnno.length,
      totaleVendita: vendutiAnno.reduce((n, d) => n + (d.prezzoVendita ?? 0), 0),
    },
  };
}
