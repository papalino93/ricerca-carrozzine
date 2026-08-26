// Tipi e funzione di ricerca condivisi tra client e server (nessuna
// dipendenza da googleapis, a differenza di tariffe.ts): il form di
// noleggio è un componente client e deve poter cercare la tariffa
// applicabile senza importare il modulo "server-only".

export type TariffaUnita = "giorno" | "settimana";

export interface Tariffa {
  categoria: string;
  /** Sottocategoria specifica (es. "Elettrica" per le carrozzine elettriche),
   * o null se la tariffa vale per l'intera categoria. */
  sottocategoria: string | null;
  importo: number;
  unita: TariffaUnita;
  /** Costi accessori a testo libero (es. "+ ritiro e consegna 20/30€"),
   * non calcolati automaticamente: l'operatore li applica a mano. */
  nota: string | null;
}

function sameKey(
  a: { categoria: string; sottocategoria: string | null },
  b: { categoria: string; sottocategoria: string | null }
): boolean {
  return (
    a.categoria.trim().toLowerCase() === b.categoria.trim().toLowerCase() &&
    (a.sottocategoria ?? "").trim().toLowerCase() === (b.sottocategoria ?? "").trim().toLowerCase()
  );
}

/** La tariffa più specifica per un dispositivo: quella con la sua sottocategoria
 * esatta se esiste, altrimenti quella generale della categoria, altrimenti nessuna. */
export function findTariffa(tariffe: Tariffa[], categoria: string, sottocategoria: string | null): Tariffa | null {
  const bySub = sottocategoria
    ? tariffe.find((t) => sameKey(t, { categoria, sottocategoria }))
    : undefined;
  if (bySub) return bySub;
  return tariffe.find((t) => sameKey(t, { categoria, sottocategoria: null })) ?? null;
}

export function fmtTariffa(t: Tariffa): string {
  const importo = t.importo.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${importo} € al ${t.unita === "settimana" ? "settimana" : "giorno"}`;
}

export function fmtEuro(importo: number): string {
  return `${importo.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Giorni tra due date ISO yyyy-mm-dd, minimo 1 (anche un noleggio dello
 * stesso giorno conta come un giorno, non zero). */
export function giorniTra(dalIso: string, aIso: string): number {
  const dal = new Date(`${dalIso}T00:00:00Z`).getTime();
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((a - dal) / 86_400_000));
}

/** Totale per `giorni` di noleggio: a settimana arrotonda per eccesso alla
 * settimana intera (pratica standard di noleggio), non frazioni. */
export function calcolaTotale(importo: number, unita: TariffaUnita, giorni: number): number {
  return unita === "settimana" ? Math.ceil(giorni / 7) * importo : giorni * importo;
}
