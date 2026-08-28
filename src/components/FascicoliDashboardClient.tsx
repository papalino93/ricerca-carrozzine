"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/clients";
import { FASCICOLO_STATO_LABEL, type FascicoloRecord } from "@/lib/fascicoli-types";
import { matchesQuery } from "@/lib/search-match";
import { StatTiles } from "./StatTiles";

interface FascicoliDashboardClientProps {
  fascicoli: FascicoloRecord[];
  clients: ClientRecord[];
}

function fmtDateOra(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function FascicoliDashboardClient({ fascicoli, clients }: FascicoliDashboardClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const daCompletare = fascicoli.filter((f) => f.stato === "bozza" || f.stato === "in_lavorazione").length;
  const completati = fascicoli.filter((f) =>
    ["completo", "prodotto", "consegnato", "archiviato"].includes(f.stato)
  ).length;

  const ultimiCreati = [...fascicoli]
    .sort((a, b) => b.dataCreazione.localeCompare(a.dataCreazione))
    .slice(0, 5);
  const ultimiModificati = [...fascicoli]
    .sort((a, b) => b.ultimaModifica.localeCompare(a.ultimaModifica))
    .slice(0, 5);

  // Ricerca rapida unica su clienti e fascicoli: chi cerca "Rossi" o un
  // numero commessa non deve sapere in anticipo se sta cercando una
  // persona o una pratica già aperta.
  const risultatiRicerca = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { clientiTrovati: [], fascicoliTrovati: [] };
    const clientiTrovati = clients
      .filter((c) => matchesQuery(`${c.nome} ${c.codiceFiscale ?? ""}`.toLowerCase(), q))
      .slice(0, 6);
    const fascicoliTrovati = fascicoli
      .filter((f) => matchesQuery(`${f.numero} ${f.clienteNome} ${f.commessa ?? ""}`.toLowerCase(), q))
      .slice(0, 6);
    return { clientiTrovati, fascicoliTrovati };
  }, [query, clients, fascicoli]);

  const tiles = [
    { key: "totale", label: "Fascicoli totali", value: fascicoli.length, color: "#175c22", active: false },
    { key: "da_completare", label: "Da completare", value: daCompletare, color: "#2F5A8A", active: false },
    { key: "completati", label: "Completati", value: completati, color: "#1F7A3D", active: false },
  ];

  return (
    <div className="wrap wide">
      <header className="page-header with-action">
        <div className="page-header-text">
          <div className="page-title-row">
            <h1>Fascicoli Plantari</h1>
          </div>
          <p className="sub">Anagrafica, anamnesi e produzione dei plantari su misura, in un unico fascicolo digitale.</p>
        </div>
        <Link href="/admin/fascicoli/nuovo" className="btn primary">
          + Nuovo fascicolo
        </Link>
      </header>

      <div className="panel">
        <StatTiles
          tiles={tiles}
          onSelect={(key) => {
            if (key === "da_completare") router.push("/admin/fascicoli/archivio?stato=bozza,in_lavorazione");
            else if (key === "completati") router.push("/admin/fascicoli/archivio?stato=completo,prodotto,consegnato,archiviato");
            else router.push("/admin/fascicoli/archivio");
          }}
        />
      </div>

      <div className="panel">
        <h2>🔎 Cerca cliente o fascicolo</h2>
        <input
          className="searchbox"
          placeholder="Nome, codice fiscale, numero fascicolo o commessa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim() ? (
          risultatiRicerca.clientiTrovati.length === 0 && risultatiRicerca.fascicoliTrovati.length === 0 ? (
            <p className="hint">Nessun risultato. Puoi creare un nuovo fascicolo da qui.</p>
          ) : (
            <>
              {risultatiRicerca.fascicoliTrovati.length > 0 ? (
                <ul className="search-result-list">
                  {risultatiRicerca.fascicoliTrovati.map((f) => (
                    <li key={f.numero}>
                      <Link href={`/admin/fascicoli/${f.numero}`} className="search-result-item">
                        <strong>{f.numero}</strong> — {f.clienteNome}{" "}
                        <span className={`pill fascicolo-${f.stato}`}>{FASCICOLO_STATO_LABEL[f.stato]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {risultatiRicerca.clientiTrovati.length > 0 ? (
                <ul className="search-result-list">
                  {risultatiRicerca.clientiTrovati.map((c) => (
                    <li key={c.nome}>
                      <Link href={`/admin/fascicoli/nuovo?cliente=${encodeURIComponent(c.nome)}`} className="search-result-item">
                        <strong>{c.nome}</strong>
                        {c.codiceFiscale ? ` — CF ${c.codiceFiscale}` : ""} — nuovo fascicolo per questo cliente
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )
        ) : null}
      </div>

      <div className="panel">
        <div className="page-title-row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Ultimi fascicoli creati</h2>
          <Link href="/admin/fascicoli/archivio" className="btn-link">
            📁 Vai all&apos;archivio
          </Link>
        </div>
        {ultimiCreati.length === 0 ? (
          <p className="empty">
            <b>Nessun fascicolo ancora</b>
            Crea il primo fascicolo plantare con &quot;+ Nuovo fascicolo&quot;.
          </p>
        ) : (
          <ul className="search-result-list">
            {ultimiCreati.map((f) => (
              <li key={f.numero}>
                <Link href={`/admin/fascicoli/${f.numero}`} className="search-result-item">
                  <strong>{f.numero}</strong> — {f.clienteNome} · creato il {fmtDateOra(f.dataCreazione)}{" "}
                  <span className={`pill fascicolo-${f.stato}`}>{FASCICOLO_STATO_LABEL[f.stato]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>Modificati di recente</h2>
        {ultimiModificati.length === 0 ? (
          <p className="hint">Nessuna modifica ancora registrata.</p>
        ) : (
          <ul className="search-result-list">
            {ultimiModificati.map((f) => (
              <li key={f.numero}>
                <Link href={`/admin/fascicoli/${f.numero}`} className="search-result-item">
                  <strong>{f.numero}</strong> — {f.clienteNome} · {fmtDateOra(f.ultimaModifica)}
                  {f.operatore ? ` · ${f.operatore}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
