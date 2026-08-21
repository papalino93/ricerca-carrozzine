"use client";

import { useState } from "react";
import type { Device } from "@/lib/devices";
import type { DocumentoTipo } from "@/lib/pdf/VerbaleDocument";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DocumentPanelProps {
  device: Device;
  onClose: () => void;
}

export function DocumentPanel({ device, onClose }: DocumentPanelProps) {
  const [tipo, setTipo] = useState<DocumentoTipo>("consegna");
  const [numeroContratto, setNumeroContratto] = useState(device.codice);
  const [data, setData] = useState(device.dal || todayIso());
  const [clienteNome, setClienteNome] = useState(device.cliente ?? "");
  const [clienteTelefono, setClienteTelefono] = useState(device.telefono ?? "");
  const [note, setNote] = useState(device.nota ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          numeroContratto,
          data,
          note,
          dispositivo: {
            codice: device.codice,
            categoria: device.categoria,
            marca: device.marca,
            modello: device.modello,
            larghezza: device.larghezza,
          },
          cliente: { nome: clienteNome, telefono: clienteTelefono },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Generazione del PDF non riuscita");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verbale-${tipo}-${device.codice}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Genera documento — {device.codice}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        <div className="doc-type-tabs">
          <button
            className={`chip ${tipo === "consegna" ? "active" : ""}`}
            onClick={() => setTipo("consegna")}
            type="button"
          >
            Verbale di consegna
          </button>
          <button
            className={`chip ${tipo === "restituzione" ? "active" : ""}`}
            onClick={() => setTipo("restituzione")}
            type="button"
          >
            Verbale di restituzione
          </button>
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        <div className="field-row">
          <div className="field">
            <label>Numero contratto</label>
            <input value={numeroContratto} onChange={(e) => setNumeroContratto(e.target.value)} />
          </div>
          <div className="field">
            <label>{tipo === "consegna" ? "Data di consegna" : "Data di restituzione"}</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Cliente</label>
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Nome e cognome" />
          </div>
          <div className="field">
            <label>Telefono cliente</label>
            <input value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} placeholder="Telefono" />
          </div>
        </div>

        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="doc-preview">
          <div>
            <b>{device.marca} {device.modello}</b> · {device.categoria}
            {device.larghezza ? ` · ${device.larghezza} cm seduta` : ""}
          </div>
          <div>Codice: {device.codice}</div>
        </div>

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={onClose} type="button">
            Annulla
          </button>
          <button className="btn primary" onClick={handleDownload} disabled={loading} type="button">
            {loading ? "Generazione…" : "Scarica PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
