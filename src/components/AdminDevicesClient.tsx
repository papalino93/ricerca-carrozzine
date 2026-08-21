"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_LABEL, STATUS_OPTIONS, type Device, type DeviceStatus } from "@/lib/device-types";
import { BrandHeader } from "./BrandHeader";
import { DeviceDetailModal } from "./DeviceDetailModal";

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
  sanificazione: null,
  nota: null,
  foto: null,
  sottocategoria: null,
};

interface AdminDevicesClientProps {
  initialDevices: Device[];
  logoUrl?: string | null;
  categories: string[];
}

export function AdminDevicesClient({ initialDevices, logoUrl, categories }: AdminDevicesClientProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [detail, setDetail] = useState<{ device: Device; isNew: boolean } | null>(null);
  const [detailKey, setDetailKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("Tutte");
  const [statusFilter, setStatusFilter] = useState<Set<DeviceStatus>>(
    new Set(STATUS_OPTIONS.map((o) => o.key))
  );

  const marche = useMemo(
    () => Array.from(new Set(devices.map((d) => d.marca).filter(Boolean))).sort(),
    [devices]
  );
  const sottocategorie = useMemo(
    () => Array.from(new Set(devices.map((d) => d.sottocategoria).filter(Boolean))).sort() as string[],
    [devices]
  );
  const visibleDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          (categoryFilter === "Tutte" || d.categoria === categoryFilter) && statusFilter.has(d.stato)
      ),
    [devices, categoryFilter, statusFilter]
  );

  function toggleStatusFilter(key: DeviceStatus) {
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

  return (
    <div className="wrap wide">
      <BrandHeader logoUrl={logoUrl} eyebrow="Amministrazione" />
      <header className="page-header">
        <div className="top-nav">
          <h1>Dispositivi</h1>
          <span>
            <Link href="/">← Ricerca pubblica</Link>
            {" · "}
            <a href="/admin/impostazioni">Impostazioni azienda →</a>
          </span>
        </div>
        <p className="sub">{devices.length} unità in magazzino</p>
        <div className="card-actions" style={{ marginTop: 12 }}>
          <button className="btn primary" type="button" onClick={openNew}>
            + Aggiungi dispositivo
          </button>
        </div>
      </header>

      <div className="panel admin-table-wrap">
        <div className="top-nav" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Tutti i dispositivi</h2>
          <div className="field" style={{ minWidth: 200, margin: 0 }}>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
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
        </div>
        <p className="hint" style={{ marginBottom: 10 }}>
          Clicca su un dispositivo per vedere i dettagli, le note, lo storico e cambiarne lo stato.
        </p>
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Codice</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Marca / modello</th>
              <th>Largh.</th>
              <th>Stato</th>
              <th>Cliente</th>
            </tr>
          </thead>
          <tbody>
            {visibleDevices.map((d) => (
              <tr key={d.codice} className="clickable-row" onClick={() => openExisting(d)}>
                <td>{d.foto ? <img className="photo-thumb" src={d.foto} alt="" /> : null}</td>
                <td>{d.codice}</td>
                <td>{d.categoria}</td>
                <td>{d.sottocategoria ?? "—"}</td>
                <td>
                  {d.marca} {d.modello}
                </td>
                <td>{d.larghezza ?? "—"}</td>
                <td>
                  <span className={`pill ${d.stato}`}>{STATUS_LABEL[d.stato]}</span>
                </td>
                <td>{d.cliente ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? (
        <DeviceDetailModal
          key={detailKey}
          device={detail.device}
          isNew={detail.isNew}
          categories={categories}
          sottocategorie={sottocategorie}
          marche={marche}
          existingCodici={devices.map((d) => d.codice)}
          onClose={() => setDetail(null)}
          onSaved={(updated) => setDevices(updated)}
          onDeleted={(updated) => {
            setDevices(updated);
            setDetail(null);
          }}
          onDuplicate={openDuplicate}
        />
      ) : null}
    </div>
  );
}
