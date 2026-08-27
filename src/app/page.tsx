import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listDevices } from "@/lib/devices";
import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { getWeather } from "@/lib/weather";
import { IconClienti, IconCommessa, IconFidelity, IconNoleggio } from "@/components/ReceptionIcons";
import { DeskClock } from "@/components/DeskClock";
import { DeskSearch } from "@/components/DeskSearch";

export const dynamic = "force-dynamic";

/** "Oggi" nel fuso di Scandicci, non del server (che gira su UTC): fra
 * mezzanotte e le due di notte l'ora italiana è già il giorno dopo di
 * quella UTC, e senza questo una consegna prevista per oggi risulterebbe
 * "in ritardo" o "domani" a seconda dell'ora. */
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
}

/** Giorno, data e ora di Scandicci calcolati sul server, per averli già
 * scritti nell'HTML che arriva al browser. Senza, il riquadro in cima alla
 * home partirebbe vuoto e la data comparirebbe solo dopo l'idratazione:
 * chi apre la pagina vede uno spazio bianco al posto di "giovedì 27
 * agosto". Da lì in poi ci pensa il componente client a far scorrere i
 * minuti. */
function oraDiScandicci(): { giorno: string; data: string; ora: string } {
  const now = new Date();
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", ...opts }).format(now);
  return {
    giorno: fmt({ weekday: "long" }),
    data: fmt({ day: "numeric", month: "long" }),
    ora: fmt({ hour: "2-digit", minute: "2-digit" }),
  };
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

/** Giorni fra oggi e una data: negativo se è già passata. */
function daysUntil(iso: string): number {
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
const NOLEGGIO_LUNGO_GG = 180;

/** Quante righe al massimo può occupare ciascuna categoria non urgente.
 *
 * Serve perché le categorie non sono grandi uguali: i noleggi lunghi sono
 * decine, i guasti tre. Con un'unica classifica per urgenza i primi
 * riempirebbero da soli tutto il riquadro e i secondi non comparirebbero
 * mai, che è esattamente il contrario di ciò che l'elenco deve fare —
 * mostrare le cose su cui si può agire adesso. Le scadenze vere (rientri e
 * consegne) non hanno tetto: se sono tante, sono tante. */
const MAX_GUASTI = 3;
const MAX_DA_VERIFICARE = 3;
const MAX_DA_PULIRE = 2;
const MAX_NOLEGGI_LUNGHI = 3;

/** Righe mostrate: oltre questa soglia l'elenco smette di essere una
 * scorsa d'occhio e diventa una pagina da leggere. */
const MAX_RIGHE = 10;

interface WatchRow {
  code: string;
  who: string;
  when: string;
  /** Vero per ciò che è già scaduto: si colora di rosso. */
  urgent: boolean;
  /** Colore dello stato a destra, con la stessa tavolozza delle pastiglie
   * del magazzino: chi legge riconosce "guasto" dal colore prima ancora di
   * leggere la parola. */
  tone?: "broken" | "check" | "clean";
  href: string;
  /** Solo per le scadenze, che si ordinano fra loro: più è basso, più è
   * urgente. Gli altri gruppi hanno già un ordine proprio. */
  rank?: number;
}

export default async function ReceptionPage() {
  // Letture indipendenti, quindi in parallelo: sommarle in serie
  // aggiungerebbe un round-trip verso Google Sheets per ognuna a ogni
  // apertura della home. Ogni lettura fallisce per conto suo: se il foglio
  // non risponde la home resta comunque utilizzabile come menu.
  const [settingsR, devicesR, commesseR, clientsR, weather] = await Promise.all([
    getSettings().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: null })
    ),
    listDevices().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof listDevices>> })
    ),
    listCommesse().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof listCommesse>> })
    ),
    listClients().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof listClients>> })
    ),
    getWeather(),
  ]);

  const settings = settingsR.v;
  const devices = devicesR.v;
  const commesse = commesseR.v;
  const clients = clientsR.v;
  // Se anche una sola lettura è fallita i numeri qui sotto non sono reali:
  // vanno dichiarati tali, altrimenti la home mostrerebbe "0 disponibili,
  // nessuna scadenza" — indistinguibile da una giornata tranquilla, sulla
  // schermata che resta aperta sul banco tutto il giorno.
  const datiParziali =
    !settingsR.ok || !devicesR.ok || !commesseR.ok || !clientsR.ok;

  const attivi = devices.filter((d) => !d.archiviato);
  const daConsegnare = commesse.filter((c) => c.stato !== "ritirata").length;
  const soglia = settings?.sogliaPremioPunti ?? 0;
  const oltreSoglia = soglia > 0 ? clients.filter((c) => c.punti >= soglia).length : 0;

  // "Da tenere d'occhio": le cose su cui si può agire oggi e che
  // altrimenti si scoprirebbero solo entrando pagina per pagina. Ogni riga
  // porta al record: il codice dell'ausilio o il numero di scheda finisce
  // nella ricerca della pagina di destinazione.
  //
  // L'elenco si costruisce per gruppi, non con un'unica classifica: prima
  // le scadenze (che non hanno tetto), poi il magazzino fermo, infine i
  // noleggi che durano da troppo. Vedi i MAX_* sopra per il perché.

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
      who: `${d.cliente ?? "—"} — rientro`,
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
      who: `${c.cliente} — ${c.riparazione && !c.vendita ? "riparazione" : "commessa"}`,
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
  const fermi = (
    stato: "guasto" | "da_verificare" | "da_pulire",
    etichetta: string,
    tone: "broken" | "check" | "clean",
    max: number
  ) =>
    attivi
      .filter((d) => d.stato === stato)
      .slice(0, max)
      .map<WatchRow>((d) => ({
        code: d.codice,
        who: [d.marca, d.modello].filter(Boolean).join(" ") || d.categoria,
        when: etichetta,
        tone,
        urgent: false,
        href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
      }));

  const magazzino = [
    ...fermi("guasto", "guasto", "broken", MAX_GUASTI),
    ...fermi("da_verificare", "da verificare", "check", MAX_DA_VERIFICARE),
    ...fermi("da_pulire", "da sanificare", "clean", MAX_DA_PULIRE),
  ];

  // 3. Noleggi fuori da molto tempo: non sono un errore, ma prima o poi
  //    vanno richiamati. Si mostrano i più vecchi, che sono anche quelli
  //    per cui la telefonata è più tardiva.
  const lunghi = attivi
    .filter((d) => d.stato === "noleggiato" && d.dal && !gia.has(d.codice))
    .map((d) => ({ d, giorni: daysSince(d.dal as string) }))
    .filter((x) => x.giorni > NOLEGGIO_LUNGO_GG)
    .sort((a, b) => b.giorni - a.giorni)
    .slice(0, MAX_NOLEGGI_LUNGHI)
    .map<WatchRow>(({ d, giorni }) => ({
      code: d.codice,
      who: `${d.cliente ?? "—"} — noleggio lungo`,
      when: `da ${giorni} gg`,
      urgent: false,
      href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
    }));

  const watchTop = [...scadenze, ...magazzino, ...lunghi].slice(0, MAX_RIGHE);

  // I quattro riquadri sono pulsanti, non statistiche. Prima mostravano un
  // numero grande: al banco "Commesse 0" si legge come "qui non c'è
  // niente" invece che come "da qui ne apri una nuova", che è il contrario
  // di quello che serve. Ora il disegno e il nome della sezione sono la
  // cosa grande, e sotto c'è scritto cosa ci si fa.
  //
  // Il numero resta solo dove segnala del lavoro da fare, come pastiglia
  // in alto a destra, e sparisce quando è zero: così un numero visibile
  // vuol dire sempre "guarda qui", mai "non c'è niente".
  const rientriVicini = attivi.filter(
    (d) => d.stato === "noleggiato" && d.alPrevisto && daysUntil(d.alPrevisto) <= 3
  ).length;

  // Un solo colore (verde, il brand) per tutte e quattro: il colore resta
  // così libero per fare davvero il suo lavoro — segnalare cose che
  // richiedono attenzione, come nel pannello "Da tenere d'occhio" — invece
  // di essere speso per distinguere quattro pulsanti di navigazione che
  // hanno già icona e posizione fissa per farlo.
  const TILES = [
    {
      href: "/noleggi",
      icon: <IconNoleggio />,
      label: "Noleggia",
      sub: "Consegne, rientri e magazzino",
      badge: rientriVicini,
      badgeLabel: "in scadenza",
    },
    {
      href: "/commesse",
      icon: <IconCommessa />,
      label: "Commesse",
      sub: "Nuove, in lavorazione e archivio",
      badge: daConsegnare,
      badgeLabel: "da lavorare",
    },
    {
      href: "/fidelity",
      icon: <IconFidelity />,
      label: "Fidelity",
      sub: "Tessere, punti e premi",
      badge: oltreSoglia,
      badgeLabel: "con premio",
    },
    {
      href: "/clienti",
      icon: <IconClienti />,
      label: "Clienti",
      sub: "Anagrafica e storico",
      badge: 0,
      badgeLabel: "",
    },
  ];

  return (
    <div className="desk">
      <div className="desk-inner">
        <div className="desk-top">
          <Link href="/" className="desk-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings?.logoUrl || "/logo.png"} alt="Medical Center" />
          </Link>
          <div className="desk-top-right">
            <DeskClock weather={weather} iniziale={oraDiScandicci()} />
            <Link href="/admin" className="desk-admin-link">
              Amministrazione ↗
            </Link>
          </div>
        </div>

        <DeskSearch />

        {datiParziali ? (
          <div className="banner error" style={{ marginBottom: 16 }}>
            Google Sheets non risponde: i numeri qui sotto potrebbero non essere aggiornati.
            Ricarica la pagina fra qualche istante.
          </div>
        ) : null}

        <div className="desk-layout">
          <div className="desk-tiles">
            {TILES.map((t) => (
              <Link key={t.href} href={t.href} className="desk-tile">
                {t.badge > 0 ? (
                  <span className="desk-tile-badge">
                    {t.badge} {t.badgeLabel}
                  </span>
                ) : null}
                <span className="desk-tile-icon">{t.icon}</span>
                <span className="desk-tile-label">{t.label}</span>
                <span className="desk-tile-sub">{t.sub}</span>
              </Link>
            ))}
          </div>

          <div className="desk-watch">
            <h2>Da tenere d&apos;occhio</h2>
            {watchTop.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                {datiParziali
                  ? "Elenco non disponibile: Google Sheets non risponde."
                  : "Nessuna scadenza nei prossimi giorni."}
              </p>
            ) : (
              <ul>
                {watchTop.map((r, i) => (
                  <li key={`${r.code}-${i}`}>
                    <Link href={r.href}>
                      <span className="desk-watch-code">{r.code}</span>
                      <span className="desk-watch-who">{r.who}</span>
                      <span
                        className={`desk-watch-when${r.urgent ? " urgent" : r.tone ? ` tone-${r.tone}` : ""}`}
                      >
                        {r.when}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
