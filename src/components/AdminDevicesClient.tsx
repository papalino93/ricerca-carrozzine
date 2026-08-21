"use client";

import { useMemo, useState } from "react";
import { STATUS_LABEL, STATUS_OPTIONS, type Device, type DeviceStatus } from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";
import { RentDeviceModal } from "./RentDeviceModal";
import { HistoryPanel } from "./HistoryPanel";
import { BrandHeader } from "./BrandHeader";

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
};

interface AdminDevicesClientProps {
  initialDevices: Device[];
  logoUrl?: string | null;
}

export function AdminDevicesClient({ initialDevices, logoUrl }: AdminDevicesClientProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [form, setForm] = useState<Device>(EMPTY_FORM);
  const [editingCodice, setEditingCodice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docDevice, setDocDevice] = useState<Device | null>(null);
  const [rentDevice, setRentDevice] = useState<Device | null>(null);
  const [historyDevice, setHistoryDevice] = useState<Device | null>(null);

  const categorie = useMemo(
    () => Array.from(new Set(devices.map((d) => d.categoria).filter(Boolean))).sort(),
    [devices]
  );
  const marche = useMemo(
    () => Array.from(new Set(devices.map((d) => d.marca).filter(Boolean))).sort(),
    [devices]
  );

  function startEdit(d: Device) {
    setForm(d);
    setEditingCodice(d.codice);
    setError(null);
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingCodice(null);
    setError(null);
  }

  function startDuplicate(d: Device) {
    setForm({
      ...EMPTY_FORM,
      categoria: d.categoria,
      marca: d.marca,
      modello: d.modello,
      larghezza: d.larghezza,
    });
    setEditingCodice(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const codice = form.codice.trim();
    if (!codice) {
      setError("Il codice è obbligatorio");
      return;
    }
    if (!editingCodice && devices.some((d) => d.codice.toLowerCase() === codice.toLowerCase())) {
      setError(`Esiste già un dispositivo con codice "${codice}": usa Modifica invece di crearne uno nuovo.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dispositivi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, codice }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setDevices(body.devices);
      startNew();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(codice: string) {
    if (!confirm(`Eliminare definitivamente ${codice}?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi?codice=${encodeURIComponent(codice)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      setDevices(body.devices);
      if (editingCodice === codice) startNew();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReturn(codice: string) {
    if (!confirm(`Segnare ${codice} come restituito? Andrà in "da pulire".`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "restituzione" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      setDevices(body.devices);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSanitize(codice: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "sanificazione" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      setDevices(body.devices);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap wide">
      <BrandHeader logoUrl={logoUrl} eyebrow="Amministrazione" />
      <header className="page-header">
        <div className="top-nav">
          <h1>Dispositivi</h1>
          <a href="/admin/impostazioni">Impostazioni azienda →</a>
        </div>
        <p className="sub">{devices.length} unità in magazzino</p>
      </header>

      {error ? <div className="banner error">{error}</div> : null}

      <form className="panel" onSubmit={handleSubmit}>
        <h2>{editingCodice ? `Modifica ${editingCodice}` : "Nuovo dispositivo"}</h2>
        <div className="field-row">
          <div className="field">
            <label>Codice</label>
            <input
              value={form.codice}
              disabled={Boolean(editingCodice)}
              onChange={(e) => setForm({ ...form, codice: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>Categoria</label>
            <input
              list="categorie-list"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
            <datalist id="categorie-list">
              {categorie.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Marca</label>
            <input
              list="marche-list"
              value={form.marca}
              onChange={(e) => setForm({ ...form, marca: e.target.value })}
            />
            <datalist id="marche-list">
              {marche.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Modello</label>
            <input value={form.modello} onChange={(e) => setForm({ ...form, modello: e.target.value })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Larghezza seduta (cm, se applicabile)</label>
            <input
              type="number"
              value={form.larghezza ?? ""}
              onChange={(e) =>
                setForm({ ...form, larghezza: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div className="field">
            <label>Stato</label>
            <select
              value={form.stato}
              onChange={(e) => setForm({ ...form, stato: e.target.value as DeviceStatus })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Cliente</label>
            <input value={form.cliente ?? ""} onChange={(e) => setForm({ ...form, cliente: e.target.value || null })} />
          </div>
          <div className="field">
            <label>Telefono cliente</label>
            <input value={form.telefono ?? ""} onChange={(e) => setForm({ ...form, telefono: e.target.value || null })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Numero contratto</label>
            <input value={form.contratto ?? ""} onChange={(e) => setForm({ ...form, contratto: e.target.value || null })} />
          </div>
          <div className="field">
            <label>Dal (inizio noleggio)</label>
            <input
              type="date"
              value={form.dal ?? ""}
              onChange={(e) => setForm({ ...form, dal: e.target.value || null })}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Sanificazione (ultima)</label>
            <input
              type="date"
              value={form.sanificazione ?? ""}
              onChange={(e) => setForm({ ...form, sanificazione: e.target.value || null })}
            />
          </div>
          <div className="field">
            <label>Nota</label>
            <input value={form.nota ?? ""} onChange={(e) => setForm({ ...form, nota: e.target.value || null })} />
          </div>
        </div>
        <div className="card-actions">
          {editingCodice ? (
            <button className="btn" type="button" onClick={startNew}>
              Annulla modifica
            </button>
          ) : null}
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : editingCodice ? "Salva modifiche" : "Aggiungi dispositivo"}
          </button>
        </div>
      </form>

      <div className="panel admin-table-wrap">
        <h2>Tutti i dispositivi</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Codice</th>
              <th>Categoria</th>
              <th>Marca / modello</th>
              <th>Largh.</th>
              <th>Stato</th>
              <th>Cliente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.codice}>
                <td>{d.codice}</td>
                <td>{d.categoria}</td>
                <td>
                  {d.marca} {d.modello}
                </td>
                <td>{d.larghezza ?? "—"}</td>
                <td>
                  <span className={`pill ${d.stato}`}>{STATUS_LABEL[d.stato]}</span>
                </td>
                <td>{d.cliente ?? "—"}</td>
                <td>
                  <div className="card-actions" style={{ marginTop: 0 }}>
                    {d.stato === "disponibile" ? (
                      <button className="btn primary" type="button" onClick={() => setRentDevice(d)}>
                        Noleggia
                      </button>
                    ) : null}
                    {d.stato === "noleggiato" ? (
                      <button className="btn primary" type="button" onClick={() => handleReturn(d.codice)} disabled={saving}>
                        Segna restituito
                      </button>
                    ) : null}
                    {d.stato === "da_pulire" ? (
                      <button className="btn primary" type="button" onClick={() => handleSanitize(d.codice)} disabled={saving}>
                        Segna sanificato
                      </button>
                    ) : null}
                    <button className="btn" type="button" onClick={() => setDocDevice(d)}>
                      Documento
                    </button>
                    <button className="btn" type="button" onClick={() => setHistoryDevice(d)}>
                      Storico
                    </button>
                    <button className="btn" type="button" onClick={() => startEdit(d)}>
                      Modifica
                    </button>
                    <button className="btn" type="button" onClick={() => startDuplicate(d)}>
                      Duplica
                    </button>
                    <button className="btn danger" type="button" onClick={() => handleDelete(d.codice)}>
                      Elimina
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {docDevice ? <DocumentPanel device={docDevice} onClose={() => setDocDevice(null)} /> : null}
      {rentDevice ? (
        <RentDeviceModal
          device={rentDevice}
          onClose={() => setRentDevice(null)}
          onRented={(updated) => setDevices(updated)}
        />
      ) : null}
      {historyDevice ? (
        <HistoryPanel device={historyDevice} onClose={() => setHistoryDevice(null)} />
      ) : null}
    </div>
  );
}
