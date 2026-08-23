"use client";

import { useMemo, useState } from "react";
import { STATUS_COLOR, STATUS_OPTIONS, type Device, type DeviceStatus } from "@/lib/device-types";
import { DeviceCard } from "./DeviceCard";
import { BrandHeader } from "./BrandHeader";
import { StatTiles } from "./StatTiles";
import { DocumentPanel } from "./DocumentPanel";
import { QuickRentModal } from "./QuickRentModal";
import { readJson } from "@/lib/fetch-json";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import { matchesQuery } from "@/lib/search-match";

// Deve combaciare con le etichette del righello (35/40/45/50/55, distanziate
// in modo uniforme): usare un altro WMIN qui sposta i punti rispetto alle
// etichette (es. 44 finiva visivamente sotto l'etichetta "45").
const WMIN = 35;
const WMAX = 55;
const RULER_TICKS = [35, 40, 45, 50, 55];

// La larghezza seduta ha senso solo per le carrozzine: se in futuro si
// aggiungono altre categorie (rollatori, stampelle...) il filtro si nasconde
// da solo quando non è quella la categoria selezionata.
const WIDTH_RELEVANT_CATEGORY = "Carrozzine";

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

const ALL_STATUSES = new Set(STATUS_OPTIONS.map((o) => o.key));

export function SearchClient({ initialDevices, logoUrl, categories }: SearchClientProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  // Prima la larghezza serviva solo a ORDINARE per vicinanza: si digitava
  // 44 e si continuava a vedere anche la 35 e la 55. Ora, quando c'è un
  // valore, filtra davvero: nasconde chi è più lontano di questa tolleranza.
  const [widthTolerance, setWidthTolerance] = useState(2);
  const [category, setCategory] = useState("Tutte");
  const [subcategory, setSubcategory] = useState("Tutte");
  const [statuses, setStatuses] = useState<Set<string>>(
    new Set(["disponibile", "da_pulire"])
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("larghezza");
  // Vivono qui, non nella singola DeviceCard: appena il noleggio viene
  // confermato il dispositivo passa a "noleggiato" e sparisce dall'elenco
  // filtrato (che per default mostra solo Disponibile/Da pulire) — se il
  // verbale di consegna fosse dentro la card, sparirebbe con lei prima che
  // l'operatore lo veda.
  const [rentingDevice, setRentingDevice] = useState<Device | null>(null);
  const [docPrompt, setDocPrompt] = useState<Device | null>(null);

  const categoryOptions = useMemo(() => ["Tutte", ...categories], [categories]);

  const subcategoryOptions = useMemo(() => {
    const pool = category === "Tutte" ? devices : devices.filter((d) => d.categoria === category);
    const values = Array.from(new Set(pool.map((d) => d.sottocategoria).filter(Boolean))).sort();
    return values as string[];
  }, [devices, category]);

  const stats = useMemo(() => {
    const counts: Record<DeviceStatus, number> = {
      disponibile: 0,
      noleggiato: 0,
      da_pulire: 0,
      guasto: 0,
      da_verificare: 0,
    };
    for (const d of devices) counts[d.stato] += 1;
    return counts;
  }, [devices]);

  async function refreshDevices() {
    try {
      const res = await fetch("/api/dispositivi");
      const body = await readJson(res);
      if (!res.ok) return;
      setDevices(body.devices);
      setLastRefresh(new Date());
    } catch {
      // Silenzioso: un aggiornamento in background che fallisce non deve
      // interrompere chi sta lavorando con i dati già a schermo.
    }
  }

  useAutoRefresh(refreshDevices);

  const isSearching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    // Una ricerca libera è una richiesta puntuale ("trova questo codice/
    // cliente"): ignora i filtri di categoria/stato/larghezza e guarda
    // in tutto il magazzino, altrimenti un dispositivo noleggiato o guasto
    // resterebbe invisibile anche cercandolo per codice esatto.
    let list = q
      ? devices.filter((d) => {
          const hay = [d.codice, d.marca, d.modello, d.cliente, d.telefono, d.contratto, d.larghezza]
            .filter((v) => v != null && v !== "")
            .join(" ")
            .toLowerCase();
          return matchesQuery(hay, q);
        })
      : devices.filter((d) => {
          if (category !== "Tutte" && d.categoria !== category) return false;
          if (subcategory !== "Tutte" && d.sottocategoria !== subcategory) return false;
          if (!statuses.has(d.stato)) return false;
          if (
            width != null &&
            (d.larghezza == null || Math.abs(d.larghezza - width) > widthTolerance)
          )
            return false;
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
  }, [devices, category, subcategory, statuses, query, width, widthTolerance, sortBy]);

  function toggleStatus(key: string) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectOnlyStatus(key: DeviceStatus) {
    setStatuses((prev) => (prev.size === 1 && prev.has(key) ? new Set(ALL_STATUSES) : new Set([key])));
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
          <h1>Trova l&apos;ausilio giusto</h1>
          <a href="/admin">Area amministrazione →</a>
        </div>
        <p className="sub">{devices.length} ausili in magazzino</p>
      </header>

      <div className="panel hero-search">
        <input
          className="searchbox hero-searchbox"
          placeholder="Cerca codice, marca, modello, larghezza…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {!isSearching ? (
        <>
          <StatTiles
            tiles={[
              {
                key: "__all__",
                label: "Totale",
                value: devices.length,
                color: "var(--accent)",
                active: statuses.size === ALL_STATUSES.size,
              },
              ...STATUS_OPTIONS.map((o) => ({
                key: o.key,
                label: o.label,
                value: stats[o.key],
                color: STATUS_COLOR[o.key],
                active: statuses.size === 1 && statuses.has(o.key),
              })),
            ]}
            onSelect={(key) => (key === "__all__" ? setStatuses(new Set(ALL_STATUSES)) : selectOnlyStatus(key as DeviceStatus))}
          />

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
                    // Il filtro larghezza non ha senso fuori da "Tutte"/
                    // Carrozzine: il pannello sparisce, ma senza questo il
                    // filtro restava comunque attivo e nascosto, escludendo
                    // in silenzio tutti gli ausili dell'altra categoria.
                    if (c !== "Tutte" && c !== WIDTH_RELEVANT_CATEGORY) setWidth(null);
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

          {category === "Tutte" || category === WIDTH_RELEVANT_CATEGORY ? (
          <div className="panel">
            <h2>Larghezza seduta</h2>
            <div className="width-row">
              <div className="stepper">
                <button aria-label="diminuisci" type="button" onClick={() => setWidth(clamp((width ?? 41) - 1, WMIN, WMAX))}>
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
                Tutte le larghezze
              </button>
            </div>
            {width ? (
              <div className="chips" style={{ marginTop: 10 }}>
                <span className="hint" style={{ margin: "0 6px 0 0" }}>Tolleranza:</span>
                {[0, 1, 2].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip ${widthTolerance === t ? "active" : ""}`}
                    onClick={() => setWidthTolerance(t)}
                  >
                    {t === 0 ? "esatta" : `± ${t} cm`}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="ruler-wrap">
              {/* Pallini, marker ed etichette sono TUTTI figli diretti di questo
                  stesso div, posizionati con la stessa identica percentuale:
                  è l'unico modo per garantire che coincidano esattamente, senza
                  dipendere da bordi/padding che possono far divergere la "base"
                  della percentuale tra elementi fratelli in contenitori diversi. */}
              <div className="ruler-line">
                {/* Stessa lista mostrata sotto come risultati (categoria/
                    sottocategoria/stato già applicati): un pallino qui
                    corrisponde sempre a una card effettivamente visibile,
                    così il click per scorrere alla card la trova sempre. */}
                {filtered
                  .filter((d) => d.larghezza)
                  .map((d) => {
                    const pct = clamp((((d.larghezza as number) - WMIN) / (WMAX - WMIN)) * 100, 0, 100);
                    return (
                      <div
                        key={d.codice}
                        className="ruler-dot"
                        style={{ left: `${pct}%`, background: STATUS_COLOR[d.stato] }}
                        title={`${d.codice} · ${d.larghezza}cm — clicca per vederlo nei risultati`}
                        onClick={() => {
                          document
                            .getElementById(`device-${d.codice}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
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
                {RULER_TICKS.map((v, i) => {
                  const pct = ((v - WMIN) / (WMAX - WMIN)) * 100;
                  const isFirst = i === 0;
                  const isLast = i === RULER_TICKS.length - 1;
                  return (
                    <span
                      key={v}
                      className="ruler-tick"
                      style={{
                        left: `${pct}%`,
                        transform: isFirst ? "none" : isLast ? "translateX(-100%)" : "translateX(-50%)",
                      }}
                    >
                      {v}
                      {isLast ? " cm" : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          ) : null}

          <div className="panel">
            <h2>Stato</h2>
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
        </>
      ) : null}

      {/* Spiega le icone-azione delle card qui sotto: senza, "＋"/"📄" da
          soli (senza il testo che avevano prima, e senza il tooltip al
          passaggio del mouse che non esiste su telefono) non sono chiari
          a chi non li ha ancora imparati a memoria. */}
      <div className="action-legend">
        <span className="legend-item">
          <span className="legend-swatch">＋</span> Noleggia
        </span>
        <span className="legend-item">
          <span className="legend-swatch">📄</span> Genera documento
        </span>
      </div>

      <div className="results-head">
        <span className="count">
          <b>{filtered.length}</b> unità trovate
          <button type="button" className="refresh-hint" onClick={refreshDevices}>
            {lastRefresh
              ? `· aggiornato alle ${lastRefresh.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · aggiorna`
              : "· aggiorna"}
          </button>
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
            onRent={() => setRentingDevice(d)}
          />
        ))
      )}

      {rentingDevice ? (
        <QuickRentModal
          device={rentingDevice}
          onClose={() => setRentingDevice(null)}
          onRented={(updated) => {
            setDevices(updated);
            setRentingDevice(null);
            setDocPrompt(updated.find((d) => d.codice === rentingDevice.codice) ?? rentingDevice);
          }}
        />
      ) : null}
      {docPrompt ? (
        <DocumentPanel device={docPrompt} forcedTipo="consegna" onClose={() => setDocPrompt(null)} />
      ) : null}
    </div>
  );
}
