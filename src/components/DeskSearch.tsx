"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { matchesQuery } from "@/lib/search-match";

interface SearchDevice {
  codice: string;
  marca: string;
  modello: string;
  categoria: string;
}

interface SearchClient {
  nome: string;
  telefono: string | null;
}

interface SearchCommessa {
  numero: string;
  cliente: string;
}

interface SearchFascicolo {
  numero: string;
  clienteNome: string;
}

interface DeskSearchProps {
  devices: SearchDevice[];
  clients: SearchClient[];
  commesse: SearchCommessa[];
  fascicoli: SearchFascicolo[];
}

interface Risultato {
  key: string;
  categoria: string;
  titolo: string;
  sottotitolo: string;
  href: string;
}

const MAX_PER_CATEGORIA = 4;

/**
 * Ricerca in cima alla home: al banco la prima cosa che si fa è cercare un
 * cliente, un ausilio, una commessa o un fascicolo. Prima mandava e basta
 * il testo alla pagina Noleggi (che cerca solo tra i dispositivi) — una
 * ricerca di un cliente o di una commessa non trovava mai niente da qui,
 * bisognava già sapere in quale pagina andare a cercare. Ora i risultati
 * compaiono mentre si scrive, divisi per tipo, e portano dritti al record
 * giusto; Invio senza aver scelto un risultato mantiene il vecchio
 * comportamento (va alla ricerca dispositivi in Noleggi).
 */
export function DeskSearch({ devices, clients, commesse, fascicoli }: DeskSearchProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const risultati = useMemo<Risultato[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const out: Risultato[] = [];

    devices
      .filter((d) => matchesQuery(`${d.codice} ${d.marca} ${d.modello} ${d.categoria}`.toLowerCase(), query))
      .slice(0, MAX_PER_CATEGORIA)
      .forEach((d) =>
        out.push({
          key: `d-${d.codice}`,
          categoria: "Dispositivi",
          titolo: `${d.codice} — ${d.marca} ${d.modello}`,
          sottotitolo: d.categoria,
          href: `/noleggi?q=${encodeURIComponent(d.codice)}`,
        })
      );
    clients
      .filter((c) => matchesQuery(`${c.nome} ${c.telefono ?? ""}`.toLowerCase(), query))
      .slice(0, MAX_PER_CATEGORIA)
      .forEach((c) =>
        out.push({
          key: `c-${c.nome}`,
          categoria: "Clienti",
          titolo: c.nome,
          sottotitolo: c.telefono || "",
          href: `/clienti/${encodeURIComponent(c.nome)}`,
        })
      );
    commesse
      .filter((cm) => matchesQuery(`${cm.numero} ${cm.cliente}`.toLowerCase(), query))
      .slice(0, MAX_PER_CATEGORIA)
      .forEach((cm) =>
        out.push({
          key: `cm-${cm.numero}`,
          categoria: "Commesse",
          titolo: `Commessa ${cm.numero}`,
          sottotitolo: cm.cliente,
          href: `/admin/commesse?q=${encodeURIComponent(cm.numero)}`,
        })
      );
    fascicoli
      .filter((f) => matchesQuery(`${f.numero} ${f.clienteNome}`.toLowerCase(), query))
      .slice(0, MAX_PER_CATEGORIA)
      .forEach((f) =>
        out.push({
          key: `f-${f.numero}`,
          categoria: "Fascicoli",
          titolo: `Fascicolo ${f.numero}`,
          sottotitolo: f.clienteNome,
          href: `/admin/fascicoli/${encodeURIComponent(f.numero)}`,
        })
      );
    return out;
  }, [q, devices, clients, commesse, fascicoli]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function vaiA(r: Risultato) {
    setOpen(false);
    router.push(r.href);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (open && risultati[highlight]) {
      vaiA(risultati[highlight]);
      return;
    }
    const term = q.trim();
    router.push(term ? `/noleggi?q=${encodeURIComponent(term)}` : "/noleggi");
  }

  const showMenu = open && risultati.length > 0;
  let categoriaCorrente = "";

  return (
    <div className="autocomplete" ref={containerRef} style={{ flex: "1 1 420px", minWidth: 280, maxWidth: 620 }}>
      <form className="desk-search" onSubmit={handleSubmit} role="search">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showMenu) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, risultati.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Cerca un cliente, un ausilio, una commessa, un fascicolo…"
          aria-label="Cerca"
          autoComplete="off"
        />
        <button className="btn primary" type="submit">
          Cerca
        </button>
      </form>
      {showMenu ? (
        <ul className="autocomplete-menu" style={{ maxWidth: 620 }}>
          {risultati.map((r, i) => {
            const nuovaCategoria = r.categoria !== categoriaCorrente;
            categoriaCorrente = r.categoria;
            return (
              <li key={r.key}>
                {nuovaCategoria ? <div className="autocomplete-group-label">{r.categoria}</div> : null}
                <button
                  type="button"
                  className={`autocomplete-option ${i === highlight ? "active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => vaiA(r)}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <span className="autocomplete-option-label">{r.titolo}</span>
                  {r.sottotitolo ? <span className="autocomplete-option-sub">{r.sottotitolo}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
