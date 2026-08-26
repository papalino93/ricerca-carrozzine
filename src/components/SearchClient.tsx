"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { STATUS_COLOR, STATUS_OPTIONS, type Device, type DeviceStatus } from "@/lib/device-types";
import { DeviceCard } from "./DeviceCard";
import { BrandHeader } from "./BrandHeader";
import { StatTiles } from "./StatTiles";
import { DocumentPanel } from "./DocumentPanel";
import { QuickRentModal } from "./QuickRentModal";
import { Toast } from "./Toast";
import type { DocumentoTipo } from "@/lib/pdf/VerbaleDocument";
import type { Tariffa } from "@/lib/tariffe-types";
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
  tariffe: Tariffa[];
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

export function SearchClient({ initialDevices, logoUrl, categories, tariffe }: SearchClientProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  // Prima la larghezza serviva solo a ORDINARE per vicinanza: si digitava
  // 44 e si continuava a vedere anche la 35 e la 55. Ora, quando c'è un
  // valore, filtra davvero: nasconde chi è più lontano di questa tolleranza.
  const [widthTolerance, setWidthTolerance] = useState(2);
  const [category, setCategory] = useState("Tutte");
  const [subcategory, setSubcategory] = useState("Tutte");
  // "da_verificare" incluso di default: ora si può risolvere direttamente
  // da qui (vedi DevicePublicViewModal), quindi deve essere visibile senza
  // dover prima toccare il filtro stato.
  const [statuses, setStatuses] = useState<Set<string>>(
    new Set(["disponibile", "da_pulire", "da_verificare"])
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("larghezza");
  // Vivono qui, non nella singola DeviceCard: appena il noleggio viene
  // confermato il dispositivo passa a "noleggiato" e sparisce dall'elenco
  // filtrato (che per default mostra solo Disponibile/Da pulire) — se il
  // verbale di consegna fosse dentro la card, sparirebbe con lei prima che
  // l'operatore lo veda.
  const [rentingDevice, setRentingDevice] = useState<Device | null>(null);
  const [docPrompt, setDocPrompt] = useState<{ device: Device; tipo: DocumentoTipo } | null>(null);
  // Come rentingDevice/docPrompt: azioni rapide di "Segna restituito" /
  // "Segna sanificato" ora possibili anche dalla ricerca pubblica, non solo
  // dall'area amministratore (prima l'operatore doveva sempre passare da
  // /admin anche solo per chiudere un noleggio).
  const [busyCodice, setBusyCodice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // In ordine alfabetico (tranne "Tutte", sempre prima): con più di una
  // manciata di categorie, cercarne una a colpo d'occhio nell'ordine
  // "storico" del foglio diventava difficile.
  const categoryOptions = useMemo(
    () => ["Tutte", ...[...categories].sort((a, b) => a.localeCompare(b, "it"))],
    [categories]
  );

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

  async function handleReturn(d: Device) {
    if (!confirm(`Segnare ${d.codice} come restituito? Andrà in "da pulire".`)) return;
    setBusyCodice(d.codice);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(d.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "restituzione" }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      setDevices(body.devices);
      showToast(`${d.codice} segnato come restituito`);
      // Il ritorno svuota cliente/telefono/contratto sul dispositivo: usiamo
      // "d" (lo stato di prima) per il verbale di restituzione, non la
      // versione aggiornata appena arrivata dall'API.
      setDocPrompt({ device: d, tipo: "restituzione" });
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusyCodice(null);
    }
  }

  async function handleSanitize(d: Device) {
    setBusyCodice(d.codice);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(d.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "sanificazione" }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      setDevices(body.devices);
      showToast(`${d.codice} segnato come sanificato`);
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setBusyCodice(null);
    }
  }

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
          <Link href="/admin">Area amministrazione →</Link>
        </div>
        <p className="sub">
          <Link href="/">← Home</Link> · {devices.length} ausili in magazzino
        </p>
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
                    // La larghezza ha senso solo dentro "Carrozzine": il
                    // pannello sparisce anche per "Tutte" (categorie miste),
                    // ma senza questo il filtro restava comunque attivo e
                    // nascosto, escludendo in silenzio tutti gli altri ausili.
                    if (c !== WIDTH_RELEVANT_CATEGORY) setWidth(null);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            {/* Solo dopo aver scelto una categoria specifica: sotto "Tutte" i
                sottotipi di categorie diverse finivano mescolati nella stessa
                riga (es. "Autospinta" delle carrozzine insieme a sottotipi di
                tutt'altro), e due chip "Tutte" una sopra l'altra, senza
                nessuna etichetta, sembravano un errore invece di due livelli
                diversi. */}
            {category !== "Tutte" && subcategoryOptions.length > 0 ? (
              <div style={{ marginTop: 14 }}>
                <p className="hint" style={{ margin: "0 0 6px" }}>Tipo</p>
                <div className="chips">
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
              </div>
            ) : null}
          </div>

          {category === WIDTH_RELEVANT_CATEGORY ? (
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
        <span className="legend-label">Legenda delle icone:</span>
        <span className="legend-item">
          <span className="legend-swatch">＋</span> Noleggia
        </span>
        <span className="legend-item">
          <span className="legend-swatch">↩</span> Segna restituito
        </span>
        <span className="legend-item">
          <span className="legend-swatch">✓</span> Segna sanificato
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
            onReturn={() => handleReturn(d)}
            onSanitize={() => handleSanitize(d)}
            busy={busyCodice === d.codice}
            onUpdated={setDevices}
          />
        ))
      )}

      {rentingDevice ? (
        <QuickRentModal
          device={rentingDevice}
          tariffe={tariffe}
          onClose={() => setRentingDevice(null)}
          onRented={(updated) => {
            setDevices(updated);
            setRentingDevice(null);
            setDocPrompt({
              device: updated.find((d) => d.codice === rentingDevice.codice) ?? rentingDevice,
              tipo: "consegna",
            });
          }}
        />
      ) : null}
      {docPrompt ? (
        <DocumentPanel
          device={docPrompt.device}
          forcedTipo={docPrompt.tipo}
          onClose={() => setDocPrompt(null)}
        />
      ) : null}
      <Toast message={toast} />
    </div>
  );
}
