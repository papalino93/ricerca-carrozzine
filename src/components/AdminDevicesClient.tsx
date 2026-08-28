"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useMemo, useRef, useState } from "react";
import { ARCHIVE_LABEL, STATUS_COLOR, STATUS_LABEL, STATUS_OPTIONS, type Device, type DeviceStatus } from "@/lib/device-types";
import { DeviceDetailModal } from "./DeviceDetailModal";
import { DocumentPanel } from "./DocumentPanel";
import type { DocumentoTipo } from "@/lib/pdf/VerbaleDocument";
import type { Tariffa } from "@/lib/tariffe-types";
import { StatTiles } from "./StatTiles";
import { Toast } from "./Toast";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import { matchesQuery } from "@/lib/search-match";

const EMPTY_FORM: Device = {
  codice: "",
  categoria: "",
  marca: "",
  modello: "",
  larghezza: null,
  stato: "disponibile",
  cliente: null,
  telefono: null,
  contratto: null,
  dal: null,
  alPrevisto: null,
  sanificazione: null,
  nota: null,
  foto: null,
  sottocategoria: null,
  prezzoAcquisto: null,
  prezzoVendita: null,
  archiviato: null,
  tariffaApplicata: null,
  tariffaUnita: null,
  dataPrimoNoleggio: null,
};

type IssueFilter = "stale" | "incomplete" | "overdue" | "duesoon" | "longrental" | null;

// Soglia oltre la quale un noleggio va ricontrollato anche senza una data
// di rientro prevista scaduta (es. rientro previsto mai impostato): a
// differenza di overdueCount/dueSoonCount, guarda solo da quanto è iniziato
// il noleggio, non se una scadenza è stata superata.
const LONG_RENTAL_DAYS = 30;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Giorni da oggi a una data futura (negativo se già passata). */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

interface AdminDevicesClientProps {
  initialDevices: Device[];
  categories: string[];
  tariffe: Tariffa[];
}

export function AdminDevicesClient({ initialDevices, categories, tariffe }: AdminDevicesClientProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [detail, setDetail] = useState<{ device: Device; isNew: boolean; autoRent?: boolean } | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("Tutte");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<DeviceStatus>>(
    new Set(STATUS_OPTIONS.map((o) => o.key))
  );
  const [issueFilter, setIssueFilter] = useState<IssueFilter>(null);
  // I dispositivi venduti/rottamati restano nel magazzino (storico intatto)
  // ma non devono intasare la vista normale: nascosti finché non si chiede
  // esplicitamente di vederli.
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docPrompt, setDocPrompt] = useState<{ device: Device; tipo: DocumentoTipo } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Vedi →" in Attenzione cambia i filtri ma l'elenco filtrato è sotto,
  // fuori dallo schermo: senza scroll sembrava che il pulsante non facesse
  // nulla (l'utente lo cliccava e non vedeva cambiare niente in vista). Un
  // id invece di un ref: un ref catturato dentro l'array memoizzato di
  // "alerts" viene segnalato dal linter come lettura potenziale durante il
  // render, anche se qui scatta solo dentro un onClick.
  function goToList() {
    document.getElementById("device-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function refreshDevices() {
    try {
      // ?vista=admin: a differenza della pagina di ricerca, qui servono
      // anche telefono e numero contratto per operare sui noleggi.
      const res = await fetch("/api/dispositivi?vista=admin");
      const body = await readJson(res);
      if (!res.ok) return;
      setDevices(body.devices);
      setLastRefresh(new Date());
    } catch {
      // Silenzioso: un aggiornamento in background che fallisce non deve
      // interrompere chi sta lavorando con i dati già a schermo. La modale
      // di un dispositivo aperta resta com'è: ha una sua copia locale,
      // decisa quando è stata aperta.
    }
  }

  useAutoRefresh(refreshDevices);

  const marche = useMemo(
    () => Array.from(new Set(devices.map((d) => d.marca).filter(Boolean))).sort(),
    [devices]
  );
  const sottocategorie = useMemo(
    () => Array.from(new Set(devices.map((d) => d.sottocategoria).filter(Boolean))).sort() as string[],
    [devices]
  );

  // Un dispositivo venduto/rottamato non è più magazzino attivo: contarlo
  // qui gonfierebbe le tessere di stato con unità che non ci sono più.
  const activeDevices = useMemo(() => devices.filter((d) => !d.archiviato), [devices]);
  const archivedCount = devices.length - activeDevices.length;

  const stats = useMemo(() => {
    const counts: Record<DeviceStatus, number> = {
      disponibile: 0,
      noleggiato: 0,
      da_pulire: 0,
      guasto: 0,
      da_verificare: 0,
    };
    for (const d of activeDevices) counts[d.stato] += 1;
    return counts;
  }, [activeDevices]);

  const alerts = useMemo(() => {
    // Attenzione al caso "mai sanificato": con `?? 0` un ausilio senza
    // alcuna data di sanificazione risultava a 0 giorni, quindi "a posto",
    // mentre uno sanificato 31 giorni fa veniva segnalato. Esattamente al
    // contrario del rischio reale. Nessuna data = caso peggiore.
    const staleCount = activeDevices.filter(
      (d) => d.stato === "disponibile" && (daysSince(d.sanificazione) ?? Infinity) > 30
    ).length;
    const incompleteCount = activeDevices.filter((d) => !(d.marca && d.modello)).length;
    // Prima dell'introduzione di "AlPrevisto" non c'era alcun modo di sapere
    // quali noleggi fossero scaduti: l'unico modo era ricordarselo o
    // controllare il contratto cartaceo. Sono in overdueCount solo i
    // noleggi CON una data prevista superata: senza data non si può dire
    // che sia in ritardo, semplicemente non è stata impostata.
    const overdueCount = activeDevices.filter(
      (d) => d.stato === "noleggiato" && d.alPrevisto != null && (daysUntil(d.alPrevisto) ?? 1) < 0
    ).length;
    const dueSoonCount = activeDevices.filter((d) => {
      if (d.stato !== "noleggiato" || d.alPrevisto == null) return false;
      const days = daysUntil(d.alPrevisto);
      return days != null && days >= 0 && days <= 7;
    }).length;
    const longRentalCount = activeDevices.filter(
      (d) => d.stato === "noleggiato" && (daysSince(d.dal) ?? 0) > LONG_RENTAL_DAYS
    ).length;
    return [
      longRentalCount > 0 && {
        text: `${longRentalCount} noleggi attivi da oltre ${LONG_RENTAL_DAYS} giorni: da verificare`,
        color: STATUS_COLOR.guasto,
        onClick: () => {
          setStatusFilter(new Set(["noleggiato"]));
          setCategoryFilter("Tutte");
          setIssueFilter("longrental");
          goToList();
        },
      },
      overdueCount > 0 && {
        text: `${overdueCount} noleggi scaduti`,
        color: STATUS_COLOR.guasto,
        onClick: () => {
          setStatusFilter(new Set(["noleggiato"]));
          setCategoryFilter("Tutte");
          setIssueFilter("overdue");
          goToList();
        },
      },
      dueSoonCount > 0 && {
        text: `${dueSoonCount} noleggi in scadenza nei prossimi 7 giorni`,
        color: STATUS_COLOR.da_verificare,
        onClick: () => {
          setStatusFilter(new Set(["noleggiato"]));
          setCategoryFilter("Tutte");
          setIssueFilter("duesoon");
          goToList();
        },
      },
      stats.da_pulire > 0 && {
        text: `${stats.da_pulire} ausili in attesa di sanificazione`,
        color: STATUS_COLOR.da_pulire,
        onClick: () => {
          setStatusFilter(new Set(["da_pulire"]));
          setCategoryFilter("Tutte");
          setIssueFilter(null);
          goToList();
        },
      },
      stats.guasto > 0 && {
        text: `${stats.guasto} ausili guasti da riparare`,
        color: STATUS_COLOR.guasto,
        onClick: () => {
          setStatusFilter(new Set(["guasto"]));
          setCategoryFilter("Tutte");
          setIssueFilter(null);
          goToList();
        },
      },
      stats.da_verificare > 0 && {
        text: `${stats.da_verificare} ausili da verificare`,
        color: STATUS_COLOR.da_verificare,
        onClick: () => {
          setStatusFilter(new Set(["da_verificare"]));
          setCategoryFilter("Tutte");
          setIssueFilter(null);
          goToList();
        },
      },
      staleCount > 0 && {
        text: `${staleCount} sanificazioni scadute da oltre 30 giorni`,
        color: STATUS_COLOR.da_pulire,
        onClick: () => {
          setStatusFilter(new Set(["disponibile"]));
          setCategoryFilter("Tutte");
          setIssueFilter("stale");
          goToList();
        },
      },
      incompleteCount > 0 && {
        text: `${incompleteCount} dispositivi con marca o modello mancanti`,
        color: STATUS_COLOR.da_verificare,
        onClick: () => {
          setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.key)));
          setCategoryFilter("Tutte");
          setIssueFilter("incomplete");
          goToList();
        },
      },
    ].filter(Boolean) as { text: string; color: string; onClick: () => void }[];
  }, [activeDevices, stats]);

  const visibleDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter((d) => {
      if (!showArchived && d.archiviato) return false;
      if (categoryFilter !== "Tutte" && d.categoria !== categoryFilter) return false;
      if (!statusFilter.has(d.stato)) return false;
      // Stessa regola del conteggio in "Attenzione" (?? Infinity, mai
      // sanificato = caso peggiore): con `?? 0` il filtro escludeva proprio i
      // dispositivi senza data che l'avviso aveva contato, e "Vedi →"
      // rispondeva "Nessun dispositivo".
      if (issueFilter === "stale" && !(d.stato === "disponibile" && (daysSince(d.sanificazione) ?? Infinity) > 30))
        return false;
      if (issueFilter === "incomplete" && d.marca && d.modello) return false;
      if (issueFilter === "overdue" && !(d.stato === "noleggiato" && d.alPrevisto != null && (daysUntil(d.alPrevisto) ?? 1) < 0))
        return false;
      if (issueFilter === "duesoon") {
        const days = d.stato === "noleggiato" ? daysUntil(d.alPrevisto) : null;
        if (days == null || days < 0 || days > 7) return false;
      }
      if (issueFilter === "longrental" && !(d.stato === "noleggiato" && (daysSince(d.dal) ?? 0) > LONG_RENTAL_DAYS))
        return false;
      if (q) {
        const hay = [d.codice, d.marca, d.modello, d.cliente, d.telefono, d.contratto, d.larghezza, d.sottocategoria]
          .filter((v) => v != null && v !== "")
          .join(" ")
          .toLowerCase();
        if (!matchesQuery(hay, q)) return false;
      }
      return true;
    });
  }, [devices, categoryFilter, statusFilter, issueFilter, query, showArchived]);

  function toggleStatusFilter(key: DeviceStatus) {
    setIssueFilter(null);
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openNew() {
    setDetail({ device: EMPTY_FORM, isNew: true });
    setDetailKey((k) => k + 1);
  }

  function openExisting(d: Device) {
    setDetail({ device: d, isNew: false });
    setDetailKey((k) => k + 1);
  }

  function openDuplicate(d: Device) {
    setDetail({
      device: {
        ...EMPTY_FORM,
        categoria: d.categoria,
        sottocategoria: d.sottocategoria,
        marca: d.marca,
        modello: d.modello,
        larghezza: d.larghezza,
      },
      isNew: true,
    });
    setDetailKey((k) => k + 1);
  }

  async function quickReturn(e: React.MouseEvent, d: Device) {
    e.stopPropagation();
    if (!confirm(`Segnare ${d.codice} come restituito? Andrà in "da pulire".`)) return;
    setSaving(true);
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
      showToast(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function quickSanitize(e: React.MouseEvent, codice: string) {
    e.stopPropagation();
    setSaving(true);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "sanificazione" }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      setDevices(body.devices);
      showToast(`${codice} segnato come sanificato`);
    } catch (err) {
      showToast(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function quickRent(e: React.MouseEvent, d: Device) {
    e.stopPropagation();
    setDetail({ device: d, isNew: false, autoRent: true });
    setDetailKey((k) => k + 1);
  }

  return (
    <div className="wrap wide">
      <header className="page-header with-action">
        <div className="page-header-text">
          <h1>Magazzino</h1>
          <p className="sub">
            {activeDevices.length} unità in magazzino
            {archivedCount > 0 ? ` (+ ${archivedCount} archiviate)` : ""}
            <button type="button" className="refresh-hint" onClick={refreshDevices}>
              {lastRefresh
                ? `· aggiornato alle ${lastRefresh.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · aggiorna`
                : "· aggiorna"}
            </button>
          </p>
        </div>
        <button className="btn primary" type="button" onClick={openNew}>
          + Aggiungi dispositivo
        </button>
      </header>

      <StatTiles
        tiles={[
          {
            key: "__all__",
            label: "Totale",
            value: activeDevices.length,
            color: "var(--accent)",
            active: statusFilter.size === STATUS_OPTIONS.length && issueFilter === null,
          },
          ...STATUS_OPTIONS.map((o) => ({
            key: o.key,
            label: o.label,
            value: stats[o.key],
            color: STATUS_COLOR[o.key],
            active: issueFilter === null && statusFilter.size === 1 && statusFilter.has(o.key),
          })),
        ]}
        onSelect={(key) => {
          setIssueFilter(null);
          if (key === "__all__") setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.key)));
          else setStatusFilter(new Set([key as DeviceStatus]));
        }}
      />

      <div className="panel">
        <h2>Attenzione</h2>
        {alerts.length === 0 ? (
          <p className="hint" style={{ margin: 0, color: "var(--ok-fg)" }}>
            Tutto sotto controllo: nessuna criticità da segnalare.
          </p>
        ) : (
          <div className="attention-list">
            {alerts.map((a, i) => (
              <div
                key={i}
                className="attention-item clickable"
                style={{ background: "var(--accent-bg)" }}
                onClick={a.onClick}
              >
                <span className="attention-dot" style={{ background: a.color }} />
                <span className="attention-text">{a.text}</span>
                <button
                  className="attention-link"
                  style={{ color: a.color }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    a.onClick();
                  }}
                >
                  Vedi →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" id="device-list">
        <input
          className="searchbox"
          style={{ marginBottom: 14 }}
          placeholder="Cerca per cliente, codice, marca, modello, telefono…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="top-nav" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Tutti i dispositivi</h2>
          <div className="field" style={{ minWidth: 200, margin: 0 }}>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setIssueFilter(null);
                setCategoryFilter(e.target.value);
              }}
            >
              <option value="Tutte">Tutte le categorie</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 16 }}>
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`chip ${statusFilter.has(o.key) ? "active" : ""}`}
              type="button"
              onClick={() => toggleStatusFilter(o.key)}
            >
              {o.label}
            </button>
          ))}
          {archivedCount > 0 ? (
            <button
              className={`chip ${showArchived ? "active" : ""}`}
              type="button"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Nascondi archiviati" : `Mostra archiviati (${archivedCount})`}
            </button>
          ) : null}
        </div>
        <p className="hint" style={{ marginBottom: 10 }}>
          Clicca su un dispositivo per vedere i dettagli, le note, lo storico e cambiarne lo stato.
          <span className="mobile-scroll-hint"> Scorri la tabella lateralmente per vedere tutte le colonne.</span>
        </p>
        {/* Legenda delle icone-azione della colonna a destra: fissa sopra la
            tabella (non scorre via con lo scroll laterale). */}
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
        </div>
        <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th className="sticky-col sticky-left">Codice</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Marca / modello</th>
              <th>Largh.</th>
              <th>Stato</th>
              <th>Cliente</th>
              <th>Dal</th>
              <th className="sticky-col sticky-right">Azione</th>
            </tr>
          </thead>
          <tbody>
            {visibleDevices.map((d) => (
              <tr
                key={d.codice}
                className="clickable-row"
                onClick={() => {
                  // Con un'azione rapida in corso (restituzione/sanificazione),
                  // aprire un'altra riga sovrapporrebbe due modali e, se la
                  // riga aperta è la stessa appena aggiornata dal server,
                  // rischierebbe di ripetere l'azione su dati già superati.
                  if (!saving) openExisting(d);
                }}
              >
                <td>{d.foto ? <img className="photo-thumb" src={d.foto} alt="" /> : null}</td>
                <td className="sticky-col sticky-left">{d.codice}</td>
                <td>{d.categoria}</td>
                <td>{d.sottocategoria ?? "—"}</td>
                <td>
                  {d.marca} {d.modello}
                </td>
                <td>{d.larghezza ?? "—"}</td>
                <td>
                  {d.archiviato ? (
                    <span className="pill archiviato">{ARCHIVE_LABEL[d.archiviato]}</span>
                  ) : (
                    <span className={`pill ${d.stato}`}>{STATUS_LABEL[d.stato]}</span>
                  )}
                </td>
                <td>{d.cliente ?? "—"}</td>
                <td>
                  {d.stato === "noleggiato" && d.dal ? (
                    <>
                      {fmtDate(d.dal)}
                      {(daysSince(d.dal) ?? 0) > LONG_RENTAL_DAYS ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 700,
                            color: STATUS_COLOR.guasto,
                          }}
                        >
                          {daysSince(d.dal)} giorni
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="action-cell sticky-col sticky-right">
                  {!d.archiviato && d.stato === "disponibile" ? (
                    <button
                      className="btn primary icon-only"
                      type="button"
                      title="Noleggia"
                      aria-label="Noleggia"
                      onClick={(e) => quickRent(e, d)}
                    >
                      ＋
                    </button>
                  ) : null}
                  {!d.archiviato && d.stato === "noleggiato" ? (
                    <button
                      className="btn primary icon-only"
                      type="button"
                      title="Segna restituito"
                      aria-label="Segna restituito"
                      onClick={(e) => quickReturn(e, d)}
                      disabled={saving}
                    >
                      ↩
                    </button>
                  ) : null}
                  {!d.archiviato && d.stato === "da_pulire" ? (
                    <button
                      className="btn primary icon-only"
                      type="button"
                      title="Segna sanificato"
                      aria-label="Segna sanificato"
                      onClick={(e) => quickSanitize(e, d.codice)}
                      disabled={saving}
                    >
                      ✓
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {visibleDevices.length === 0 ? (
          <div className="hint" style={{ padding: "20px 0", textAlign: "center" }}>
            Nessun dispositivo corrisponde ai filtri attivi.{" "}
            <button
              className="btn"
              type="button"
              onClick={() => {
                setIssueFilter(null);
                setCategoryFilter("Tutte");
                setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.key)));
                setQuery("");
              }}
            >
              Azzera filtri
            </button>
          </div>
        ) : null}
      </div>

      {detail ? (
        <DeviceDetailModal
          key={detailKey}
          device={detail.device}
          isNew={detail.isNew}
          autoRent={detail.autoRent}
          categories={categories}
          sottocategorie={sottocategorie}
          marche={marche}
          tariffe={tariffe}
          existingCodici={devices.map((d) => d.codice)}
          onClose={() => setDetail(null)}
          onSaved={(updated) => setDevices(updated)}
          onDeleted={(updated) => {
            setDevices(updated);
            setDetail(null);
            showToast("Dispositivo eliminato");
          }}
          onDuplicate={openDuplicate}
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
