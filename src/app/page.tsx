import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { IconClienti, IconCommessa, IconFidelity, IconNoleggio } from "@/components/ReceptionIcons";
import { LiveClock } from "@/components/LiveClock";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const CARDS = [
  {
    href: "/noleggi",
    icon: <IconNoleggio />,
    color: "info",
    label: "Noleggia un ausilio",
    sub: "Cerca disponibilità",
  },
  {
    href: "/commesse",
    icon: <IconCommessa />,
    color: "warn",
    label: "Nuova commessa",
    sub: "Vendita o riparazione",
  },
  {
    href: "/fidelity",
    icon: <IconFidelity />,
    color: "purple",
    label: "Fidelity card",
    sub: "Iscrivi o aggiungi punti",
  },
  {
    href: "/clienti",
    icon: <IconClienti />,
    color: "accent",
    label: "Clienti",
    sub: "Anagrafica e storico",
  },
];

export default async function ReceptionPage() {
  const logoUrl = await getSettings()
    .then((s) => s.logoUrl || null)
    .catch(() => null);

  return (
    <div className="reception">
      <div className="reception-top">
        <div className="reception-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl || "/logo.png"} alt="Ricerca Ausili" />
        </div>
        <Link href="/admin" className="reception-admin-link">
          Amministrazione ↗
        </Link>
      </div>

      <div className="reception-hero">
        <div className="reception-greet">
          <h1>{greeting()}</h1>
          <p>
            {todayLabel()} · <LiveClock />
          </p>
        </div>

        <div className="reception-grid">
          {CARDS.map((c) => (
            <Link key={c.href} href={c.href} className="reception-card">
              <span className={`reception-icon reception-icon-${c.color}`}>{c.icon}</span>
              <span className="reception-label">{c.label}</span>
              <span className="reception-sub">{c.sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
