import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listDevices } from "@/lib/devices";
import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { listFascicoli } from "@/lib/fascicoli";
import { getWeather } from "@/lib/weather";
import { IconClienti, IconCommessa, IconFidelity, IconNoleggio } from "@/components/ReceptionIcons";
import { DeskClock } from "@/components/DeskClock";
import { DeskSearch } from "@/components/DeskSearch";
import { buildWatchGroups, daysUntil } from "@/lib/watchlist";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

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

/** La home mostra una sintesi breve per gruppo. L'elenco non scorre più
 * dentro un riquadro stretto: i gruppi sono card affiancate e l'elenco
 * completo resta raggiungibile da "Vedi tutto". */
const PREVIEW_CAP: Record<string, number> = {
  scadenze: 3,
  guasto: 3,
  da_verificare: 3,
  da_pulire: 3,
  lunghi: 3,
};

export default async function ReceptionPage() {
  // Letture indipendenti, quindi in parallelo: sommarle in serie
  // aggiungerebbe un round-trip verso Google Sheets per ognuna a ogni
  // apertura della home. Ogni lettura fallisce per conto suo: se il foglio
  // non risponde la home resta comunque utilizzabile come menu.
  const [settingsR, devicesR, commesseR, clientsR, fascicoliR, weather] = await Promise.all([
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
    // Solo per la ricerca globale in cima alla home: se il foglio dei
    // fascicoli non risponde, la ricerca funziona lo stesso sugli altri tre
    // tipi invece di far fallire l'intera home.
    listFascicoli().then(
      (v) => v,
      () => [] as Awaited<ReturnType<typeof listFascicoli>>
    ),
    getWeather(),
  ]);

  const settings = settingsR.v;
  const devices = devicesR.v;
  const commesse = commesseR.v;
  const clients = clientsR.v;
  const fascicoli = fascicoliR;
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
  // nella ricerca della pagina di destinazione. Qui si mostra solo
  // un'anteprima (vedi PREVIEW_CAP): l'elenco completo, raggruppato allo
  // stesso modo, sta nella pagina dedicata dietro "Vedi tutto".
  const watchGroupsFull = buildWatchGroups(devices, commesse);
  const watchTotal = watchGroupsFull.reduce((n, g) => n + g.rows.length, 0);
  const watchGroups = watchGroupsFull.map((g) => ({
    ...g,
    total: g.rows.length,
    rows: g.rows.slice(0, PREVIEW_CAP[g.key] ?? g.rows.length),
  }));

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

  // Un colore diverso per sezione, di nuovo: la versione tutta verde
  // lasciava le card troppo vuote, con solo un'iconcina a distinguerle. Il
  // colore resta comunque concentrato nel cerchio dell'icona — non nello
  // sfondo dell'intera card — così riempie la card senza affollare la
  // pagina e senza competere con i colori degli alert in "Da tenere
  // d'occhio", che restano l'unico posto dove il colore segnala un
  // problema vero.
  const TILES = [
    {
      href: "/noleggi",
      icon: <IconNoleggio />,
      color: "info",
      label: "Noleggia",
      sub: "Consegne, rientri e magazzino",
      badge: rientriVicini,
      badgeLabel: "in scadenza",
    },
    {
      href: "/commesse",
      icon: <IconCommessa />,
      color: "warn",
      label: "Commesse",
      sub: "Nuove, in lavorazione e archivio",
      badge: daConsegnare,
      badgeLabel: "da lavorare",
    },
    {
      href: "/fidelity",
      icon: <IconFidelity />,
      color: "purple",
      label: "Fidelity",
      sub: "Tessere, punti e premi",
      badge: oltreSoglia,
      badgeLabel: "con premio",
    },
    {
      href: "/clienti",
      icon: <IconClienti />,
      color: "accent",
      label: "Clienti",
      sub: "Anagrafica e storico",
      badge: 0,
      badgeLabel: "",
    },
  ];

  return (
    <div className="desk">
      <div className="desk-inner">
        <div className="desk-header">
          <div className="desk-top">
            <Link href="/" className="desk-brand">
              <span className="desk-brand-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/medical-center-brand.png" alt="Medical Center" />
              </span>
            </Link>
            <DeskSearch
              devices={attivi.map((d) => ({ codice: d.codice, marca: d.marca, modello: d.modello, categoria: d.categoria }))}
              clients={clients.map((c) => ({ nome: c.nome, telefono: c.telefono || c.cellulare || null }))}
              commesse={commesse.map((c) => ({ numero: c.numero, cliente: c.cliente }))}
              fascicoli={fascicoli.map((f) => ({ numero: f.numero, clienteNome: f.clienteNome }))}
            />
            <div className="desk-top-right">
              <DeskClock weather={weather} iniziale={oraDiScandicci()} />
              <Link href="/admin" className="desk-admin-link">
                Amministrazione ↗
              </Link>
              <LogoutButton className="desk-admin-link desk-logout" />
            </div>
          </div>

        </div>

        {datiParziali ? (
          <div className="banner error" style={{ marginBottom: 16 }}>
            Google Sheets non risponde: i numeri qui sotto potrebbero non essere aggiornati.
            Ricarica la pagina fra qualche istante.
          </div>
        ) : null}

        <div className="desk-layout">
          <div className="desk-tiles">
            {TILES.map((t) => (
              <Link key={t.href} href={t.href} className={`desk-tile desk-tile-${t.color}`}>
                <span className="desk-tile-top">
                  <span className="desk-tile-icon">{t.icon}</span>
                  <span className="desk-tile-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="desk-tile-label">{t.label}</span>
                <span className="desk-tile-sub">{t.sub}</span>
                {t.badge > 0 ? (
                  <span className="desk-tile-stat">
                    {t.badge} {t.badgeLabel}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          <div className="desk-watch">
            <div className="desk-watch-head">
              <h2>Da tenere d&apos;occhio</h2>
              {watchTotal > 0 ? <span className="desk-watch-total">{watchTotal} posizioni</span> : null}
            </div>
            {watchTotal === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                {datiParziali
                  ? "Elenco non disponibile: Google Sheets non risponde."
                  : "Nessuna scadenza nei prossimi giorni."}
              </p>
            ) : (
              <>
                <div className="desk-watch-scroll desk-watch-grid">
                  {watchGroups.map((g) => (
                    <div key={g.key} className={`desk-watch-column desk-watch-column-${g.tone}`}>
                      <Link
                        href={`/da-tenere-d-occhio?gruppo=${encodeURIComponent(g.key)}`}
                        className={`desk-watch-group ${g.tone}`}
                        aria-label={`Apri categoria ${g.label}`}
                      >
                        <span className="dot" aria-hidden="true" />
                        {g.label}
                        <span className="count">{g.total}</span>
                      </Link>
                      <ul>
                        {g.rows.map((r, i) => (
                          <li key={`${r.code}-${i}`}>
                            <Link href={r.href}>
                              <span className="desk-watch-code">{r.code}</span>
                              <span className="desk-watch-who">
                                <span className="desk-watch-cat">{r.cat}</span>
                                {r.rest ? <span className="desk-watch-rest">{r.rest}</span> : null}
                              </span>
                              {g.showWhen ? (
                                <span className={`desk-watch-when${r.urgent ? " urgent" : ""}`}>
                                  {r.when}
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {g.total > g.rows.length ? (
                        <Link
                          href={`/da-tenere-d-occhio?gruppo=${encodeURIComponent(g.key)}`}
                          className="desk-watch-overflow"
                        >
                          +{g.total - g.rows.length} altre
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
                {watchTotal > 0 ? (
                  <div className="desk-watch-more">
                    <Link href="/da-tenere-d-occhio">Vedi tutto →</Link>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
