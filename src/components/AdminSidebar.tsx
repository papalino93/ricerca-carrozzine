"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  logoUrl?: string | null;
}

// L'operatività di ogni giorno: separata da Impostazioni (configurazione
// tecnica), che vive a parte più sotto — vedi la home (/admin) per il
// perché di questa distinzione.
const NAV_ITEMS = [
  { href: "/admin", label: "Home" },
  { href: "/admin/magazzino", label: "Magazzino" },
  { href: "/admin/registro", label: "Registro noleggi" },
  { href: "/admin/commesse", label: "Commesse" },
  { href: "/admin/clienti", label: "Clienti" },
  { href: "/admin/fidelity", label: "Fidelity" },
];

export function AdminSidebar({ logoUrl }: AdminSidebarProps) {
  const pathname = usePathname();
  // Solo su schermi stretti: su desktop il pulsante resta nascosto via CSS
  // e il menu è sempre visibile come prima (vedi media query in globals.css).
  const [open, setOpen] = useState(false);

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-top">
        <Link href="/admin" className="admin-sidebar-brand" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl || "/logo.png"} alt="" />
          <div>
            <div className="name">Ricerca Ausili</div>
            <p className="eyebrow">Amministrazione</p>
          </div>
        </Link>
        <button
          type="button"
          className="admin-sidebar-toggle"
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "×" : "☰"}
        </button>
      </div>
      <div className={`admin-sidebar-menu ${open ? "open" : ""}`}>
        <nav>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-sidebar-link ${pathname === item.href ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-divider" />
        <Link
          href="/admin/impostazioni"
          className={`admin-sidebar-link muted ${pathname === "/admin/impostazioni" ? "active" : ""}`}
          onClick={() => setOpen(false)}
        >
          ⚙ Impostazioni
        </Link>
        <Link href="/" className="admin-sidebar-link muted" onClick={() => setOpen(false)}>
          Vai alla ricerca ↗
        </Link>
      </div>
    </aside>
  );
}
