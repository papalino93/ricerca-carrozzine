"use client";

import { useState } from "react";
import type { Device } from "@/lib/device-types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RentDeviceModalProps {
  device: Device;
  onClose: () => void;
  onRented: (devices: Device[]) => void;
}

export function RentDeviceModal({ device, onClose, onRented }: RentDeviceModalProps) {
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contratto, setContratto] = useState("");
  const [dal, setDal] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente.trim()) {
      setError("Il nome del cliente è obbligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dispositivi/${encodeURIComponent(device.codice)}/eventi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "noleggio", cliente, telefono, contratto, dal }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Operazione non riuscita");
      onRented(body.devices);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Noleggia {device.codice}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
            ×
          </button>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Cliente</label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome e cognome" autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Telefono</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="field">
              <label>Numero contratto</label>
              <input value={contratto} onChange={(e) => setContratto(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Dal</label>
            <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} />
          </div>
          <div className="card-actions" style={{ marginTop: 16 }}>
            <button className="btn" onClick={onClose} type="button">
              Annulla
            </button>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Conferma noleggio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
