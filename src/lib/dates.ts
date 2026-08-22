// Utilità di date condivise tra la scheda dispositivo (admin) e il noleggio
// rapido dalla ricerca: stessa logica, un solo posto dove correggerla.

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Somma giorni a una data ISO yyyy-mm-dd, per le scelte rapide "+30/60/90 giorni". */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
