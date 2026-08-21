"use client";

import { useMemo, useState } from "react";
import { STATUS_COLOR, STATUS_OPTIONS, type Device } from "@/lib/device-types";
import { DeviceCard } from "./DeviceCard";
import { Logo } from "./Logo";

const WMIN = 33;
const WMAX = 55;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

interface SearchClientProps {
  initialDevices: Device[];
}

export function SearchClient({ initialDevices }: SearchClientProps) {
  const [devices] = useState(initialDevices);
  const [width, setWidth] = useState<number | null>(null);
  const [category, setCategory] = useState("Tutte");
  const [statuses, setStatuses] = useState<Set<string>>(
    new Set(["disponibile", "da_pulire"])
  );
  const [query, setQuery] = useState("");

  const categories = useMemo(
    () => ["Tutte", ...Array.from(new Set(devices.map((d) => d.categoria).filter(Boolean)))],
    [devices]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = devices.filter((d) => {
      if (category !== "Tutte" && d.categoria !== category) return false;
      if (!statuses.has(d.stato)) return false;
      if (q) {
        const hay = [d.codice, d.marca, d.modello, d.cliente, d.telefono, d.contratto]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (width) {
      list = [...list].sort((a, b) => {
        const da = a.larghezza == null ? 999 : Math.abs(a.larghezza - width);
        const db = b.larghezza == null ? 999 : Math.abs(b.larghezza - width);
        return da - db;
      });
    } else {
      list = [...list].sort((a, b) => (a.larghezza ?? 999) - (b.larghezza ?? 999));
    }
    return list;
  }, [devices, category, statuses, query, width]);

  function toggleStatus(key: string) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="wrap">
      <header className="page-header">
        <p className="eyebrow">Magazzino noleggio</p>
        <div className="brand-row">
          <Logo />
          <h1>Ricerca Ausili</h1>
        </div>
        <p className="sub">
          {devices.length} unità censite · ricerca disponibilità per carrozzine e altri
          dispositivi a noleggio
        </p>
      </header>

      <div className="panel">
        <h2>Larghezza seduta richiesta (se applicabile)</h2>
        <div className="width-row">
          <div className="stepper">
            <button aria-label="diminuisci" type="button" onClick={() => setWidth(clamp((width ?? 44) - 1, WMIN, WMAX))}>
              −
            </button>
            <div className="val">{width ? `${width} cm` : "—"}</div>
            <button aria-label="aumenta" type="button" onClick={() => setWidth(clamp((width ?? 40) + 1, WMIN, WMAX))}>
              +
            </button>
          </div>
          <button className="clear-width" type="button" onClick={() => setWidth(null)}>
            Nessun filtro larghezza
          </button>
        </div>
        <div className="ruler-wrap">
          <div className="ruler-line">
            {devices
              .filter((d) => d.larghezza)
              .map((d) => {
                const pct = clamp((((d.larghezza as number) - WMIN) / (WMAX - WMIN)) * 100, 0, 100);
                return (
                  <div
                    key={d.codice}
                    className="ruler-dot"
                    style={{ left: `${pct}%`, background: STATUS_COLOR[d.stato] }}
                    title={`${d.codice} · ${d.larghezza}cm`}
                  />
                );
              })}
            {width ? (
              <div
                className="ruler-target"
                data-label={`${width} cm`}
                style={{ left: `${clamp(((width - WMIN) / (WMAX - WMIN)) * 100, 0, 100)}%` }}
              />
            ) : null}
          </div>
          <div className="ruler-ticks">
            <span>35</span>
            <span>40</span>
            <span>45</span>
            <span>50</span>
            <span>55 cm</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Categoria</h2>
        <div className="chips">
          {categories.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? "active" : ""}`}
              type="button"
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Stato e ricerca libera</h2>
        <div className="toggle-row" style={{ marginBottom: 12 }}>
          <div className="chips">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`chip ${statuses.has(o.key) ? "active" : ""}`}
                type="button"
                onClick={() => toggleStatus(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <input
          className="searchbox"
          placeholder="Cerca per cliente, telefono, contratto, marca, modello o codice…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="results-head">
        <span className="count">
          <b>{filtered.length}</b> unità trovate
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <b>Nessuna corrispondenza</b>
          Prova ad allargare i filtri di stato o categoria.
        </div>
      ) : (
        filtered.map((d) => (
          <DeviceCard
            key={d.codice}
            device={d}
            exactWidth={Boolean(width && d.larghezza === width)}
            statusColor={STATUS_COLOR[d.stato]}
          />
        ))
      )}
    </div>
  );
}
