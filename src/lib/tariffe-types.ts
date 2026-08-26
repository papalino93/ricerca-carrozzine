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
