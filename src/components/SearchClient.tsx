"use client";

import { useMemo, useState } from "react";
import { STATUS_COLOR, STATUS_OPTIONS, type Device } from "@/lib/device-types";
import { DeviceCard } from "./DeviceCard";
import { BrandHeader } from "./BrandHeader";

const WMIN = 33;
const WMAX = 55;

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

interface SearchClientProps {
  initialDevices: Device[];
  logoUrl?: string | null;
  categories: string[];
}

type SortKey = "larghezza" | "codice" | "marca" | "stato" | "cliente";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "larghezza", label: "Larghezza" },
  { key: "codice", label: "Codice" },
  { key: "marca", label: "Marca" },
  { key: "stato", label: "Stato" },
  { key: "cliente", label: "Cliente" },
];

export function SearchClient({ initialDevices, logoUrl, categories }: SearchClientProps) {
  const [devices] = useState(initialDevices);
  const [width, setWidth] = useState<number | null>(null);
  const [category, setCategory] = useState("Tutte");
  const [subcategory, setSubcategory] = useState("Tutte");
  const [statuses, setStatuses] = useState<Set<string>>(
    new Set(["disponibile", "da_pulire"])
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("larghezza");

  const categoryOptions = useMemo(() => ["Tutte", ...categories], [categories]);

  const subcategoryOptions = useMemo(() => {
    const pool = category === "Tutte" ? devices : devices.filter((d) => d.categoria === category);
    const values = Array.from(new Set(pool.map((d) => d.sottocategoria).filter(Boolean))).sort();
    return values as string[];
  }, [devices, category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = devices.filter((d) => {
      if (category !== "Tutte" && d.categoria !== category) return false;
      if (subcategory !== "Tutte" && d.sottocategoria !== subcategory) return false;
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

    if (sortBy === "larghezza" && width) {
      list = [...list].sort((a, b) => {
        const da = a.larghezza == null ? 999 : Math.abs(a.larghezza - width);
        const db = b.larghezza == null ? 999 : Math.abs(b.larghezza - width);
        return da - db;
      });
    } else if (sortBy === "larghezza") {
      list = [...list].sort((a, b) => (a.larghezza ?? 999) - (b.larghezza ?? 999));
    } else if (sortBy === "stato") {
      list = [...list].sort((a, b) => a.stato.localeCompare(b.stato));
    } else {
      list = [...list].sort((a, b) => (a[sortBy] ?? "").localeCompare(b[sortBy] ?? ""));
    }
    return list;
  }, [devices, category, subcategory, statuses, query, width, sortBy]);

  function toggleStatus(key: string) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleWidthInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      setWidth(null);
      return;
    }
    const n = Number(raw);
    // Non applichiamo il clamp qui: farlo a ogni tasto premuto correggeva
    // il valore a metà digitazione (es. scrivendo "44" cifra per cifra il
    // primo "4" veniva forzato a 33, poi il secondo "4" si accodava a
    // quello diventando "334" e quindi clampato a 55). Si limita solo
    // quando l'utente esce dal campo, vedi handleWidthBlur.
    if (!Number.isNaN(n)) setWidth(n);
  }

  function handleWidthBlur() {
    setWidth((w) => (w == null ? null : clamp(w, WMIN, WMAX)));
  }

  return (
    <div className="wrap">
      <BrandHeader logoUrl={logoUrl} eyebrow="Magazzino noleggio" />
      <header className="page-header">
        <div className="top-nav">
          <h1>Trova un ausilio disponibile</h1>
          <a href="/admin">Area amministrazione →</a>
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
            <input
              className="val"
              type="number"
              inputMode="numeric"
              min={WMIN}
              max={WMAX}
              placeholder="—"
              value={width ?? ""}
              onChange={handleWidthInput}
              onBlur={handleWidthBlur}
              aria-label="Larghezza seduta in centimetri"
            />
            <button aria-label="aumenta" type="button" onClick={() => setWidth(clamp((width ?? 40) + 1, WMIN, WMAX))}>
              +
            </button>
          </div>
          <span className="hint" style={{ margin: 0 }}>cm</span>
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
          {categoryOptions.map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? "active" : ""}`}
              type="button"
              onClick={() => {
                setCategory(c);
                setSubcategory("Tutte");
              }}
            >
              {c}
            </button>
          ))}
        </div>
        {subcategoryOptions.length > 0 ? (
          <div className="chips" style={{ marginTop: 10 }}>
            {["Tutte", ...subcategoryOptions].map((s) => (
              <button
                key={s}
                className={`chip ${subcategory === s ? "active" : ""}`}
                type="button"
                onClick={() => setSubcategory(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
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
        <label className="sort-select">
          Ordina per
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
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
