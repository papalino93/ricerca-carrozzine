"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminSidebarProps {
  logoUrl?: string | null;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Magazzino" },
  { href: "/admin/impostazioni", label: "Impostazioni" },
];

export function AdminSidebar({ logoUrl }: AdminSidebarProps) {
  const pathname = usePathname();
  // Solo su schermi stretti: su desktop il pulsante resta nascosto via CSS
  // e il menu è sempre visibile come prima (vedi media query in globals.css).
  const [open, setOpen] = useState(false);

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-top">
        <div className="admin-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl || "/logo.png"} alt="" />
          <div>
            <div className="name">Ricerca Ausili</div>
            <p className="eyebrow">Amministrazione</p>
          </div>
        </div>
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
        <Link href="/" className="admin-sidebar-link muted" onClick={() => setOpen(false)}>
          Vai alla ricerca ↗
        </Link>
      </div>
    </aside>
  );
}
