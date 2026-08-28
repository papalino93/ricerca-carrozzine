// Utilità di date condivise tra client e server (niente "server-only": la
// importano sia componenti client come DeviceDetailModal sia moduli server
// come devices.ts), un solo posto dove correggerle.

/** "Oggi" nel fuso di Scandicci, non quello del server (che gira su UTC):
 * fra mezzanotte e le due di notte l'ora italiana è già il giorno dopo di
 * quella UTC. Senza questo, un noleggio o una commessa aperti in quella
 * finestra finivano datati ieri invece che oggi. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

/** Somma giorni a una data ISO yyyy-mm-dd, per le scelte rapide "+30/60/90 giorni". */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Data (yyyy-mm-dd) nel fuso di Scandicci di un timestamp ISO completo con
 * ora (es. "2026-08-28T00:40:00.000Z"), per confrontarla con un filtro
 * "dal/al" scelto con un `<input type="date">`. Un semplice `.slice(0, 10)`
 * userebbe la data UTC del timestamp: stesso problema di todayIso, un
 * fascicolo creato fra mezzanotte e le due di notte italiane (quando in UTC
 * è ancora "ieri") risulterebbe filtrabile sul giorno sbagliato. */
export function localDateFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(iso));
}
