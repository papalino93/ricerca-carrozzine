import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listDevices } from "@/lib/devices";
import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { IconClienti, IconCommessa, IconFidelity, IconNoleggio } from "@/components/ReceptionIcons";
import { DeskClock } from "@/components/DeskClock";
import { DeskSearch } from "@/components/DeskSearch";

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

interface WatchRow {
  code: string;
  who: string;
  when: string;
  /** Vero quando la scadenza è già passata o è oggi. */
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
  const [settings, devices, commesse, clients] = await Promise.all([
    getSettings().catch(() => null),
    listDevices().catch(() => []),
    listCommesse().catch(() => []),
    listClients().catch(() => []),
  ]);

  const attivi = devices.filter((d) => !d.archiviato);
  const disponibili = attivi.filter((d) => d.stato === "disponibile").length;
  const daConsegnare = commesse.filter((c) => c.stato !== "ritirata").length;
  const soglia = settings?.sogliaPremioPunti ?? 0;
  const oltreSoglia = soglia > 0 ? clients.filter((c) => c.punti >= soglia).length : 0;

  // "Da tenere d'occhio": le scadenze che oggi si scoprono solo entrando nelle
  // singole pagine. Consegne previste, rientri oltre la data concordata e
  // ausili da verificare, i più urgenti per primi.
  const watch: WatchRow[] = [];

  for (const c of commesse) {
    if (c.stato === "ritirata" || !c.consegnaPrevista) continue;
    const giorni = daysUntil(c.consegnaPrevista);
    if (giorni > 7) continue;
    watch.push({
      code: c.numero,
      who: `${c.cliente} — ${c.riparazione && !c.vendita ? "riparazione" : "commessa"}`,
      when: giorni < 0 ? `in ritardo di ${-giorni} gg` : giorni === 0 ? "consegna oggi" : fmtDate(c.consegnaPrevista),
      urgent: giorni <= 0,
      href: "/commesse",
      rank: giorni,
    });
  }

  for (const d of attivi) {
    if (d.stato !== "noleggiato" || !d.alPrevisto) continue;
    const giorni = daysUntil(d.alPrevisto);
    if (giorni > 3) continue;
    watch.push({
      code: d.codice,
      who: `${d.cliente ?? "—"} — rientro`,
      when: giorni < 0 ? `${-giorni} gg fa` : giorni === 0 ? "rientro oggi" : fmtDate(d.alPrevisto),
      urgent: giorni <= 0,
      href: "/noleggi",
      rank: giorni - 0.5,
    });
  }

  for (const d of attivi) {
    if (d.stato !== "da_verificare") continue;
    watch.push({
      code: d.codice,
      who: [d.marca, d.modello].filter(Boolean).join(" ") || d.categoria,
      when: "da verificare",
      urgent: false,
      href: "/noleggi",
      rank: 50,
    });
  }

  watch.sort((a, b) => a.rank - b.rank);
  const watchTop = watch.slice(0, 6);

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
            <DeskClock />
            <Link href="/admin" className="desk-admin-link">
              Amministrazione ↗
            </Link>
          </div>
        </div>

        <DeskSearch />

        <div className="desk-layout">
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

          <div className="desk-watch">
            <h2>Da tenere d&apos;occhio</h2>
            {watchTop.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>
                Nessuna scadenza nei prossimi giorni.
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
