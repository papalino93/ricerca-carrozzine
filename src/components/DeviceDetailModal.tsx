"use client";

import { useEffect, useRef, useState } from "react";
import {
  STATUS_LABEL,
  STATUS_OPTIONS,
  type Device,
  type DeviceStatus,
} from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";
import { Toast } from "./Toast";

interface HistoryEvent {
  data: string;
  codice: string;
  evento: "noleggio" | "restituzione" | "sanificazione";
  cliente: string | null;
  telefono: string | null;
  contratto: string | null;
  nota: string | null;
}

const EVENT_LABEL: Record<HistoryEvent["evento"], string> = {
  noleggio: "Noleggio",
  restituzione: "Restituzione",
  sanificazione: "Sanificazione",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DeviceDetailModalProps {
  device: Device;
  isNew: boolean;
  autoRent?: boolean;
  categories: string[];
  sottocategorie: string[];
  marche: string[];
  existingCodici: string[];
  onClose: () => void;
  onSaved: (devices: Device[]) => void;
  onDeleted: (devices: Device[]) => void;
  onDuplicate: (seed: Device) => void;
}

// Vista unica per un dispositivo: informazioni, modifica, cambio stato,
// noleggio, storico e azioni (documento/duplica/elimina) in un solo posto,
// aperta con un click sulla riga della tabella in AdminDevicesClient.
export function DeviceDetailModal({
  device,
  isNew,
  autoRent,
  categories,
  sottocategorie,
  marche,
  existingCodici,
  onClose,
  onSaved,
  onDeleted,
  onDuplicate,
}: DeviceDetailModalProps) {
  const [form, setForm] = useState<Device>(device);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [renting, setRenting] = useState(Boolean(autoRent));
  const [rentCliente, setRentCliente] = useState("");
  const [rentTelefono, setRentTelefono] = useState("");
  const [rentContratto, setRentContratto] = useState("");
  const [rentDal, setRentDal] = useState(todayIso());
  const [showDoc, setShowDoc] = useState(false);
  const [events, setEvents] = useState<HistoryEvent[] | null>(isNew ? [] : null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // Il componente è montato con una `key` diversa ogni volta che si apre un
  // dispositivo diverso (o si passa a "Duplica"): niente da sincronizzare
  // qui, lo stato iniziale sopra riflette già il device corretto.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/dispositivi/${encodeURIComponent(device.codice)}/eventi`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Impossibile leggere lo storico");
        if (!cancelled) setEvents(body.events);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [device.codice, isNew]);

  function applyUpdate(devices: Device[]) {
    onSaved(devices);
    const updated = devices.find((d) => d.codice === form.codice);
    if (updated) setForm(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const codice = form.codice.trim();
    if (!codice) {
      setError("Il codice è obbligatorio");
      return;
    }
    if (isNew && existingCodici.some((c) => c.toLowerCase() === codice.toLowerCase())) {
      setError(`Esiste già un dispositivo con codice "${codice}".`);
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
      onSaved(body.devices);
      showToast(isNew ? "Dispositivo aggiunto" : "Modifiche salvate");
      if (isNew) onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminare definitivamente ${form.codice}?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi?codice=${encodeURIComponent(form.codice)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
      onDeleted(body.devices);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRent(e: React.FormEvent) {
    e.preventDefault();
    if (!rentCliente.trim()) {
      setError("Il nome del cliente è obbligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(form.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "noleggio",
          cliente: rentCliente,
          telefono: rentTelefono,
          contratto: rentContratto,
          dal: rentDal,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      applyUpdate(body.devices);
      setRenting(false);
      showToast("Noleggio confermato");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLifecycle(tipo: "restituzione" | "sanificazione") {
    if (tipo === "restituzione" && !confirm(`Segnare ${form.codice} come restituito?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(form.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      applyUpdate(body.devices);
      showToast(tipo === "restituzione" ? "Segnato come restituito" : "Segnato come sanificato");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(form.codice)}/foto`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Caricamento foto non riuscito");
      applyUpdate(body.devices);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoRemove() {
    setUploadingPhoto(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(form.codice)}/foto`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rimozione foto non riuscita");
      applyUpdate(body.devices);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal wide" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>{isNew ? "Nuovo dispositivo" : `${form.codice} — ${form.marca} ${form.modello}`}</h3>
            <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
              ×
            </button>
          </div>

          {error ? <div className="banner error">{error}</div> : null}

          {!isNew ? (
            <div className="detail-status-row">
              <span className={`pill ${form.stato}`}>{STATUS_LABEL[form.stato]}</span>
              {form.stato === "disponibile" && !renting ? (
                <button className="btn primary" type="button" onClick={() => setRenting(true)}>
                  Noleggia
                </button>
              ) : null}
              {form.stato === "noleggiato" ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => handleLifecycle("restituzione")}
                  disabled={saving}
                >
                  Segna restituito
                </button>
              ) : null}
              {form.stato === "da_pulire" ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => handleLifecycle("sanificazione")}
                  disabled={saving}
                >
                  Segna sanificato
                </button>
              ) : null}
            </div>
          ) : null}

          {renting ? (
            <form className="panel" onSubmit={handleConfirmRent} style={{ margin: "0 0 16px" }}>
              <h2>Assegna a un cliente</h2>
              <div className="field">
                <label>Cliente</label>
                <input
                  value={rentCliente}
                  onChange={(e) => setRentCliente(e.target.value)}
                  placeholder="Nome e cognome"
                  autoFocus
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Telefono</label>
                  <input value={rentTelefono} onChange={(e) => setRentTelefono(e.target.value)} />
                </div>
                <div className="field">
                  <label>Numero contratto</label>
                  <input value={rentContratto} onChange={(e) => setRentContratto(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Dal</label>
                <input type="date" value={rentDal} onChange={(e) => setRentDal(e.target.value)} />
              </div>
              <div className="card-actions">
                <button className="btn" type="button" onClick={() => setRenting(false)}>
                  Annulla
                </button>
                <button className="btn primary" type="submit" disabled={saving}>
                  {saving ? "Salvataggio…" : "Conferma noleggio"}
                </button>
              </div>
            </form>
          ) : null}

          <form onSubmit={handleSave}>
            <div className="field-row">
              <div className="field">
                <label>Codice</label>
                <input
                  value={form.codice}
                  disabled={!isNew}
                  onChange={(e) => setForm({ ...form, codice: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Categoria</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    — seleziona —
                  </option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Sottocategoria (facoltativa)</label>
                <input
                  list="detail-sottocategorie-list"
                  value={form.sottocategoria ?? ""}
                  onChange={(e) => setForm({ ...form, sottocategoria: e.target.value || null })}
                  placeholder="es. Autospinta, Transito, Bimbi…"
                />
                <datalist id="detail-sottocategorie-list">
                  {sottocategorie.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
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
                <label>Marca</label>
                <input
                  list="detail-marche-list"
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                />
                <datalist id="detail-marche-list">
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
                <label>Sanificazione (ultima)</label>
                <input
                  type="date"
                  value={form.sanificazione ?? ""}
                  onChange={(e) => setForm({ ...form, sanificazione: e.target.value || null })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Cliente</label>
                <input
                  value={form.cliente ?? ""}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value || null })}
                />
              </div>
              <div className="field">
                <label>Telefono cliente</label>
                <input
                  value={form.telefono ?? ""}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value || null })}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Numero contratto</label>
                <input
                  value={form.contratto ?? ""}
                  onChange={(e) => setForm({ ...form, contratto: e.target.value || null })}
                />
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
            <div className="field">
              <label>Nota</label>
              <textarea
                rows={2}
                value={form.nota ?? ""}
                onChange={(e) => setForm({ ...form, nota: e.target.value || null })}
              />
            </div>

            <div className="field">
              <label>Foto</label>
              {!isNew ? (
                <div className="photo-field">
                  {form.foto ? (
                    <img className="photo-preview" src={form.foto} alt={`Foto ${form.codice}`} />
                  ) : null}
                  <div className="card-actions" style={{ marginTop: 0 }}>
                    <label className="btn">
                      {uploadingPhoto ? "Caricamento…" : form.foto ? "Cambia foto" : "Carica foto"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhoto}
                        style={{ display: "none" }}
                      />
                    </label>
                    {form.foto ? (
                      <button
                        className="btn danger"
                        type="button"
                        onClick={handlePhotoRemove}
                        disabled={uploadingPhoto}
                      >
                        Rimuovi foto
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="hint">Salva il dispositivo per poter caricare una foto.</p>
              )}
            </div>

            <div className="card-actions">
              <button className="btn primary" type="submit" disabled={saving}>
                {saving ? "Salvataggio…" : isNew ? "Aggiungi dispositivo" : "Salva modifiche"}
              </button>
            </div>
          </form>

          {!isNew ? (
            <div className="detail-section">
              <h2>Storico</h2>
              {events === null ? <p className="hint">Caricamento…</p> : null}
              {events && events.length === 0 ? (
                <p className="hint">Nessun evento registrato per questo dispositivo.</p>
              ) : null}
              {events && events.length > 0 ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Evento</th>
                        <th>Cliente</th>
                        <th>Telefono</th>
                        <th>Contratto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, i) => (
                        <tr key={i}>
                          <td>{fmtDate(e.data)}</td>
                          <td>
                            <span
                              className={`pill ${
                                e.evento === "noleggio"
                                  ? "noleggiato"
                                  : e.evento === "restituzione"
                                    ? "da_pulire"
                                    : "disponibile"
                              }`}
                            >
                              {EVENT_LABEL[e.evento]}
                            </span>
                          </td>
                          <td>{e.cliente ?? "—"}</td>
                          <td>{e.telefono ?? "—"}</td>
                          <td>{e.contratto ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isNew ? (
            <div className="detail-section card-actions">
              <button className="btn" type="button" onClick={() => setShowDoc(true)}>
                Genera documento
              </button>
              <button className="btn" type="button" onClick={() => onDuplicate(form)}>
                Duplica
              </button>
              <button className="btn danger" type="button" onClick={handleDelete} disabled={saving}>
                Elimina
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {showDoc ? <DocumentPanel device={form} onClose={() => setShowDoc(false)} /> : null}
      <Toast message={toast} />
    </>
  );
}
