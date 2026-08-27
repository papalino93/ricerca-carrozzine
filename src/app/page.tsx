import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listDevices } from "@/lib/devices";
import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { listHistory } from "@/lib/history";
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

/** Oltre questa durata un noleggio va ricontrollato: stessa soglia usata
 * dalla sezione "Attenzione" del magazzino. */
const NOLEGGIO_LUNGO_GG = 30;

const EVENTO_LABEL = {
  noleggio: "Consegna",
  restituzione: "Rientro",
  sanificazione: "Sanificato",
} as const;

const EVENTO_PILL = {
  noleggio: "noleggiato",
  restituzione: "da_pulire",
  sanificazione: "disponibile",
} as const;

interface WatchRow {
  code: string;
  who: string;
  when: string;
  /** Vero per ciò che è già scaduto: si colora di rosso. */
  urgent: boolean;
  href: string;
  /** Per ordinare: più è basso, più è urgente. */
  rank: number;
}

export default async function ReceptionPage() {
  // Letture indipendenti, quindi in parallelo: sommarle in serie
  // aggiungerebbe un round-trip verso Google Sheets per ognuna a ogni
  // apertura della home. Ogni lettura fallisce per conto suo: se il foglio
  // non risponde la home resta comunque utilizzabile come menu.
  const [settingsR, devicesR, commesseR, clientsR, weather, history] = await Promise.all([
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
    listHistory().catch(() => []),
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
  const disponibili = attivi.filter((d) => d.stato === "disponibile").length;
  const daConsegnare = commesse.filter((c) => c.stato !== "ritirata").length;
  const soglia = settings?.sogliaPremioPunti ?? 0;
  const oltreSoglia = soglia > 0 ? clients.filter((c) => c.punti >= soglia).length : 0;

  // "Da tenere d'occhio": ciò che richiede una decisione oggi e che
  // altrimenti si scoprirebbe solo entrando nelle singole pagine. Ordinato
  // per urgenza reale, non per tipo. Ogni riga porta al record: il codice o
  // il numero di scheda finisce nella ricerca della pagina di destinazione.
  const watch: WatchRow[] = [];

  // Un dispositivo può rientrare in più casi (fuori data E oltre 30 giorni):
  // si segnala una volta sola, con il motivo più grave.
  const gia = new Set<string>();

  // 1. Rientri oltre la data concordata.
  for (const d of attivi) {
    if (d.stato !== "noleggiato" || !d.alPrevisto) continue;
    const giorni = daysUntil(d.alPrevisto);
    if (giorni > 3) continue;
    gia.add(d.codice);
    watch.push({
      code: d.codice,
      who: `${d.cliente ?? "—"} — rientro`,
      when: giorni < 0 ? `scaduto da ${-giorni} gg` : giorni === 0 ? "rientro oggi" : fmtDate(d.alPrevisto),
      urgent: giorni <= 0,
      href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
      rank: giorni - 0.5,
    });
  }

  // 2. Consegne di commesse in scadenza o già in ritardo.
  for (const c of commesse) {
    if (c.stato === "ritirata" || !c.consegnaPrevista) continue;
    const giorni = daysUntil(c.consegnaPrevista);
    if (giorni > 7) continue;
    watch.push({
      code: c.numero,
      who: `${c.cliente} — ${c.riparazione && !c.vendita ? "riparazione" : "commessa"}`,
      when: giorni < 0 ? `in ritardo di ${-giorni} gg` : giorni === 0 ? "consegna oggi" : fmtDate(c.consegnaPrevista),
      urgent: giorni <= 0,
      href: `/commesse?q=${encodeURIComponent(c.numero)}`,
      rank: giorni,
    });
  }

  // 3. Noleggi che durano da oltre un mese: non sono in errore, ma vanno
  // ricontrollati (l'ausilio è fuori da tanto e spesso il contratto va
  // rinnovato o chiuso).
  for (const d of attivi) {
    if (d.stato !== "noleggiato" || !d.dal || gia.has(d.codice)) continue;
    const giorni = daysSince(d.dal);
    if (giorni <= NOLEGGIO_LUNGO_GG) continue;
    gia.add(d.codice);
    watch.push({
      code: d.codice,
      who: `${d.cliente ?? "—"} — noleggio lungo`,
      when: `da ${giorni} gg`,
      urgent: false,
      href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
      // Dopo le scadenze vere, ma prima delle segnalazioni di magazzino;
      // fra loro, prima i noleggi che durano da più tempo.
      rank: 20 - Math.min(giorni / 365, 1),
    });
  }

  // 4. Ausili fermi in magazzino perché guasti o da verificare.
  for (const d of attivi) {
    if (d.stato !== "da_verificare" && d.stato !== "guasto") continue;
    watch.push({
      code: d.codice,
      who: [d.marca, d.modello].filter(Boolean).join(" ") || d.categoria,
      when: d.stato === "guasto" ? "guasto" : "da verificare",
      urgent: false,
      href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
      rank: d.stato === "guasto" ? 40 : 50,
    });
  }

  watch.sort((a, b) => a.rank - b.rank);
  const watchTop = watch.slice(0, 8);

  // Ultimi movimenti registrati: listHistory restituisce già dal più
  // recente. Solo i codici ancora esistenti, per non mandare a vuoto il
  // link di un ausilio nel frattempo eliminato.
  const codiciNoti = new Set(devices.map((d) => d.codice));
  const movimenti = history.filter((e) => codiciNoti.has(e.codice)).slice(0, 6);

  const STATO = [
    {
      key: "disponibile",
      label: "Disponibili",
      value: disponibili,
      color: "ok",
      href: "/noleggi",
    },
    {
      key: "noleggiato",
      label: "Noleggiati",
      value: attivi.filter((d) => d.stato === "noleggiato").length,
      color: "rent",
      href: "/noleggi",
    },
    {
      key: "da_pulire",
      label: "Da pulire",
      value: attivi.filter((d) => d.stato === "da_pulire").length,
      color: "clean",
      href: "/noleggi",
    },
    {
      key: "guasto",
      label: "Guasti",
      value: attivi.filter((d) => d.stato === "guasto").length,
      color: "broken",
      href: "/noleggi",
    },
    {
      key: "da_verificare",
      label: "Da verificare",
      value: attivi.filter((d) => d.stato === "da_verificare").length,
      color: "check",
      href: "/noleggi",
    },
  ];

  const TILES = [
    {
      href: "/noleggi",
      icon: <IconNoleggio />,
      color: "info",
      label: "Noleggia",
      sub: "ausili disponibili",
      value: disponibili,
    },
    {
      href: "/commesse",
      icon: <IconCommessa />,
      color: "warn",
      label: "Commesse",
      sub: "da consegnare",
      value: daConsegnare,
    },
    {
      href: "/fidelity",
      icon: <IconFidelity />,
      color: "purple",
      label: "Fidelity",
      sub: soglia > 0 ? "oltre soglia premio" : "programma fedeltà",
      value: oltreSoglia,
    },
    {
      href: "/clienti",
      icon: <IconClienti />,
      color: "accent",
      label: "Clienti",
      sub: "in anagrafica",
      value: clients.length,
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
            <DeskClock weather={weather} />
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
          <div className="desk-left">
            <div className="desk-tiles">
              {TILES.map((t) => (
                <Link key={t.href} href={t.href} className={`desk-tile desk-tile-${t.color}`}>
                  <span className="desk-tile-top">
                    <span className="desk-tile-icon">{t.icon}</span>
                    <span className="desk-tile-value">{t.value}</span>
                  </span>
                  <span className="desk-tile-label">{t.label}</span>
                  <span className="desk-tile-sub">{t.sub}</span>
                </Link>
              ))}
            </div>

            {/* Il magazzino in una riga: quanti ausili sono in ciascuno
                stato, e ogni voce filtra la ricerca su quello stato. Serve
                a rispondere al banco senza aprire il magazzino. */}
            <div className="desk-stato">
              <h2>Magazzino</h2>
              <div className="desk-stato-row">
                {STATO.map((s) => (
                  <Link key={s.key} href={s.href} className={`desk-stato-item desk-stato-${s.color}`}>
                    <span className="desk-stato-n">{s.value}</span>
                    <span className="desk-stato-l">{s.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Ultimi movimenti: cosa è successo di recente (consegne,
                rientri, sanificazioni). È l'informazione che l'operatore
                cerca quando subentra a un collega. */}
            {movimenti.length > 0 ? (
              <div className="desk-recent">
                <h2>Ultimi movimenti</h2>
                <ul>
                  {movimenti.map((m, i) => (
                    <li key={`${m.codice}-${m.data}-${i}`}>
                      <Link href={`/noleggi?q=${encodeURIComponent(m.codice)}`}>
                        <span className={`desk-recent-tag ${EVENTO_PILL[m.evento]}`}>
                          {EVENTO_LABEL[m.evento]}
                        </span>
                        <span className="desk-recent-code">{m.codice}</span>
                        <span className="desk-recent-who">{m.cliente || "—"}</span>
                        <span className="desk-recent-when">{fmtDate(m.data)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
                      <span className={`desk-watch-when${r.urgent ? " urgent" : ""}`}>{r.when}</span>
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
