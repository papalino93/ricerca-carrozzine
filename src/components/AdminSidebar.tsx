"use client";

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

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl || "/logo.png"} alt="" />
        <div>
          <div className="name">Ricerca Ausili</div>
          <p className="eyebrow">Amministrazione</p>
        </div>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-sidebar-link ${pathname === item.href ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-divider" />
      <Link href="/" className="admin-sidebar-link muted">
        Vedi ricerca pubblica ↗
      </Link>
    </aside>
  );
}
