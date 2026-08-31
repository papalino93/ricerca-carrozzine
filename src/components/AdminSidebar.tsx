"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChiudi,
  IconClienti,
  IconCommessa,
  IconFascicoli,
  IconFidelity,
  IconImpostazioni,
  IconMagazzino,
  IconMenu,
  IconNoleggio,
} from "./ReceptionIcons";
import { LogoutButton } from "./LogoutButton";

// Gestione e configurazione (il "dietro le quinte"): il lavoro di ogni
// giorno al banco vive altrove, vedi il link "Operatore banco" più sotto —
// qui restano le stesse aree ma con il dettaglio in più che serve per la
// configurazione (tariffe, controllo qualità sulle commesse, ecc.).
const NAV_ITEMS = [
  { href: "/admin", label: "Magazzino", icon: <IconMagazzino /> },
  { href: "/admin/registro", label: "Registro noleggi", icon: <IconNoleggio /> },
  { href: "/admin/commesse", label: "Commesse", icon: <IconCommessa /> },
  { href: "/admin/fascicoli", label: "Fascicoli Plantari", icon: <IconFascicoli /> },
  { href: "/admin/clienti", label: "Clienti", icon: <IconClienti /> },
  { href: "/admin/fidelity", label: "Fidelity", icon: <IconFidelity /> },
];

export function AdminSidebar() {
  const pathname = usePathname();
  // Solo su schermi stretti: su desktop il pulsante resta nascosto via CSS
  // e il menu è sempre visibile come prima (vedi media query in globals.css).
  const [open, setOpen] = useState(false);

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-top">
        <Link href="/" className="admin-sidebar-brand" onClick={() => setOpen(false)}>
          {/* Versione bianca del marchio: la sidebar è verde scuro, quindi qui
              serve il logo in negativo, non quello a colori caricato da
              Impostazioni (usato invece sulle pagine a sfondo chiaro). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/medical-center-brand.png" alt="" />
          <p className="eyebrow">Amministrazione</p>
        </Link>
        <button
          type="button"
          className="admin-sidebar-toggle"
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <IconChiudi /> : <IconMenu />}
        </button>
      </div>
      <div className={`admin-sidebar-menu ${open ? "open" : ""}`}>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-sidebar-link ${
                pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
                  ? "active"
                  : ""
              }`}
              onClick={() => setOpen(false)}
            >
              <span className="admin-sidebar-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-divider" />
        <Link href="/" className="admin-sidebar-link muted" onClick={() => setOpen(false)}>
          Operatore banco ↗
        </Link>
        {/* Dentro al menu, non fuori: su telefono il menu si chiude e questo
            resterebbe l'unica voce visibile accanto al logo. In fondo alla
            sidebar ci va comunque su desktop, grazie a margin-top: auto. */}
        <Link
          href="/admin/impostazioni"
          className={`admin-sidebar-link muted admin-sidebar-footer ${pathname === "/admin/impostazioni" ? "active" : ""}`}
          onClick={() => setOpen(false)}
        >
          <span className="admin-sidebar-icon">
            <IconImpostazioni />
          </span>
          Impostazioni
        </Link>
        <LogoutButton
          className="admin-sidebar-link muted admin-sidebar-logout"
          onLogout={() => setOpen(false)}
        />
      </div>
    </aside>
  );
}
