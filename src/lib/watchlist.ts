import type { Device } from "./devices";
import type { CommessaRecord } from "./commesse";

/** "Oggi" nel fuso di Scandicci, non del server (che gira su UTC): fra
 * mezzanotte e le due di notte l'ora italiana è già il giorno dopo di
 * quella UTC, e senza questo una consegna prevista per oggi risulterebbe
 * "in ritardo" o "domani" a seconda dell'ora. */
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

/** Giorni fra oggi e una data: negativo se è già passata. */
export function daysUntil(iso: string): number {
  const target = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date(`${todayIso()}T00:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}

/** Giorni trascorsi da una data. */
function daysSince(iso: string): number {
  return -daysUntil(iso);
}

/** Oltre questa durata un noleggio merita una telefonata: il contratto va
 * rinnovato, chiuso o l'ausilio recuperato.
 *
 * Sei mesi e non un mese: qui la durata mediana di un noleggio è di circa
 * sei settimane, quindi "oltre trenta giorni" descrive la normalità — due
 * noleggi su tre — e segnalarli tutti significa non segnalare niente. */
export const NOLEGGIO_LUNGO_GG = 180;

export interface WatchRow {
  code: string;
  /** Categoria del dispositivo (o tipo di pratica per le commesse, che non
   * hanno un dispositivo): sempre la prima parola accanto al codice, per
   * riconoscere di cosa si tratta senza dover leggere il resto. */
  cat: string;
  rest: string;
  when: string;
  /** Vero per ciò che è già scaduto: il testo si colora di rosso anche
   * dentro un gruppo già rosso, per distinguerlo da chi è solo imminente. */
  urgent: boolean;
  href: string;
  /** Solo per le scadenze, che si ordinano fra loro: più è basso, più è
   * urgente. */
  rank?: number;
}

export type WatchTone = "urgent" | "broken" | "check" | "clean" | "neutral";

export interface WatchGroup {
  key: string;
  label: string;
  tone: WatchTone;
  /** Il "quando" (data, giorni di ritardo, giorni di noleggio) è
   * informazione utile riga per riga solo qui: nei gruppi di magazzino
   * fermo (guasto/da verificare/da sanificare) è lo stesso per ogni riga
   * del gruppo — già detto dall'intestazione — e ripeterlo sarebbe rumore. */
  showWhen: boolean;
  rows: WatchRow[];
}

/** Costruisce l'elenco "da tenere d'occhio" al completo, raggruppato per
 * motivo: prima le scadenze vere (che non hanno un tetto), poi il
 * magazzino fermo, infine i noleggi che durano da troppo. Un gruppo vuoto
 * non compare. Non applica limiti: sta a chi chiama decidere quante righe
 * mostrare (la home ne mostra un'anteprima, la pagina dedicata tutte). */
export function buildWatchGroups(devices: Device[], commesse: CommessaRecord[]): WatchGroup[] {
  const attivi = devices.filter((d) => !d.archiviato);

  // 1. Scadenze vere: rientri oltre la data concordata e consegne di
  //    commesse in ritardo o imminenti. Fra loro si ordinano per urgenza,
  //    perché un rientro scaduto da tre giorni viene prima di una consegna
  //    prevista fra due.
  const scadenze: WatchRow[] = [];

  // Un ausilio può ricadere in più casi (fuori data E in noleggio da mesi):
  // va segnalato una volta sola, con il motivo più grave.
  const gia = new Set<string>();

  for (const d of attivi) {
    if (d.stato !== "noleggiato" || !d.alPrevisto) continue;
    const giorni = daysUntil(d.alPrevisto);
    if (giorni > 3) continue;
    gia.add(d.codice);
    scadenze.push({
      code: d.codice,
      cat: d.categoria,
      rest: d.cliente ?? "—",
      when: giorni < 0 ? `scaduto da ${-giorni} gg` : giorni === 0 ? "rientro oggi" : fmtDate(d.alPrevisto),
      urgent: giorni <= 0,
      href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
      rank: giorni - 0.5,
    });
  }

  for (const c of commesse) {
    if (c.stato === "ritirata" || !c.consegnaPrevista) continue;
    const giorni = daysUntil(c.consegnaPrevista);
    if (giorni > 7) continue;
    scadenze.push({
      code: c.numero,
      cat: c.riparazione && !c.vendita ? "riparazione" : "commessa",
      rest: c.cliente,
      when: giorni < 0 ? `in ritardo di ${-giorni} gg` : giorni === 0 ? "consegna oggi" : fmtDate(c.consegnaPrevista),
      urgent: giorni <= 0,
      href: `/commesse?q=${encodeURIComponent(c.numero)}`,
      rank: giorni,
    });
  }

  scadenze.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  // 2. Magazzino fermo: ausili che esistono ma non si possono noleggiare
  //    finché qualcuno non ci mette mano. Sono lavoro arretrato e, a
  //    differenza dei noleggi, nessuna scadenza li farà emergere da soli.
  const fermi = (stato: "guasto" | "da_verificare" | "da_pulire", etichetta: string): WatchRow[] =>
    attivi
      .filter((d) => d.stato === stato)
      .map((d) => ({
        code: d.codice,
        cat: d.categoria,
        rest: [d.marca, d.modello].filter(Boolean).join(" "),
        when: etichetta,
        urgent: false,
        href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
      }));

  // 3. Noleggi fuori da molto tempo: non sono un errore, ma prima o poi
  //    vanno richiamati. Si mostrano i più vecchi, che sono anche quelli
  //    per cui la telefonata è più tardiva.
  const lunghi = attivi
    .filter((d) => d.stato === "noleggiato" && d.dal && !gia.has(d.codice))
    .map((d) => ({ d, giorni: daysSince(d.dal as string) }))
    .filter((x) => x.giorni > NOLEGGIO_LUNGO_GG)
    .sort((a, b) => b.giorni - a.giorni)
    .map<WatchRow>(({ d, giorni }) => ({
      code: d.codice,
      cat: d.categoria,
      rest: d.cliente ?? "—",
      when: `a noleggio da ${giorni} gg`,
      urgent: false,
      href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
    }));

  const groups: WatchGroup[] = [
    { key: "scadenze", label: "Scadenze", tone: "urgent", showWhen: true, rows: scadenze },
    { key: "guasto", label: "Guasto", tone: "broken", showWhen: false, rows: fermi("guasto", "guasto") },
    {
      key: "da_verificare",
      label: "Da verificare",
      tone: "check",
      showWhen: false,
      rows: fermi("da_verificare", "da verificare"),
    },
    {
      key: "da_pulire",
      label: "Da sanificare",
      tone: "clean",
      showWhen: false,
      rows: fermi("da_pulire", "da sanificare"),
    },
    {
      key: "lunghi",
      label: `A noleggio da oltre ${NOLEGGIO_LUNGO_GG} gg`,
      tone: "neutral",
      showWhen: true,
      rows: lunghi,
    },
  ];

  return groups.filter((g) => g.rows.length > 0);
}
