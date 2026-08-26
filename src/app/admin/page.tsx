import Link from "next/link";
import { listDevices } from "@/lib/devices";
import { listCommesse } from "@/lib/commesse";
import { listClients } from "@/lib/clients";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const LONG_RENTAL_DAYS = 30;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

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

export default async function HubPage() {
  const [devices, commesse, clients, settings] = await Promise.all([
    listDevices().catch(() => []),
    listCommesse().catch(() => []),
    listClients().catch(() => []),
    getSettings().catch(() => null),
  ]);

  const activeDevices = devices.filter((d) => !d.archiviato);
  const noleggiati = activeDevices.filter((d) => d.stato === "noleggiato");
  const longRentals = noleggiati.filter((d) => (daysSince(d.dal) ?? 0) > LONG_RENTAL_DAYS);

  const commesseAperte = commesse.filter((c) => c.stato !== "ritirata");
  const commessePronte = commesse.filter((c) => c.stato === "pronta");

  const puntiTotali = clients.reduce((sum, c) => sum + c.punti, 0);
  const sogliaPunti = settings?.sogliaPremioPunti ?? 0;
  const clientiVicini = sogliaPunti > 0 ? clients.filter((c) => c.punti >= sogliaPunti).length : 0;

  const cards = [
    {
      href: "/admin/magazzino",
      icon: "♿",
      color: "info",
      num: noleggiati.length,
      label: "Noleggi attivi",
      flag: longRentals.length > 0 ? `${longRentals.length} da oltre ${LONG_RENTAL_DAYS}gg` : null,
      flagTone: "danger",
      cta: "Vai a Magazzino",
    },
    {
      href: "/admin/commesse",
      icon: "🛠",
      color: "warn",
      num: commesseAperte.length,
      label: "Commesse aperte",
      flag: commessePronte.length > 0 ? `${commessePronte.length} pronte per la consegna` : null,
      flagTone: "warn",
      cta: "Vai a Commesse",
    },
    {
      href: "/admin/clienti",
      icon: "◍",
      color: "accent",
      num: clients.length,
      label: "Clienti in anagrafica",
      flag: null,
      flagTone: "warn",
      cta: "Vai a Clienti",
    },
    {
      href: "/admin/fidelity",
      icon: "♥",
      color: "purple",
      num: puntiTotali,
      label: "Punti fedeltà assegnati",
      flag: clientiVicini > 0 ? `${clientiVicini} vicini al premio` : null,
      flagTone: "purple",
      cta: "Vai a Fidelity",
    },
  ];

  return (
    <div className="wrap hub">
      <div className="hub-top">
        <div>
          <h1>{greeting()}</h1>
          <p className="sub" style={{ textTransform: "capitalize" }}>
            {todayLabel()} — ecco la situazione di oggi
          </p>
        </div>
        <Link href="/admin/impostazioni" className="hub-settings-link">
          ⚙ Impostazioni
        </Link>
      </div>

      <div className="hub-grid">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="hub-card">
            <div className="hub-card-top">
              <span className={`hub-icon hub-icon-${c.color}`}>{c.icon}</span>
              {c.flag ? <span className={`hub-flag hub-flag-${c.flagTone}`}>{c.flag}</span> : null}
            </div>
            <div className="hub-num">{c.num.toLocaleString("it-IT")}</div>
            <div className="hub-label">{c.label}</div>
            <div className="hub-cta">{c.cta} →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
