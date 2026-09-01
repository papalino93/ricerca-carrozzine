"use client";

import { useState } from "react";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { STATUS_LABEL, type Device, type DeviceStatus } from "@/lib/device-types";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface DevicePublicViewModalProps {
  device: Device;
  onClose: () => void;
  /**
   * Presente solo per i dispositivi "da verificare": permette di risolvere
   * il dubbio (disponibile/guasto/da pulire) e aggiornare la nota anche
   * dalla ricerca pubblica, senza dover passare da /admin solo per questo.
   * Per tutti gli altri stati la vista resta di sola lettura, come prima.
   */
  onUpdated?: (devices: Device[]) => void;
}

const RESOLVE_OPTIONS: { stato: DeviceStatus; label: string }[] = [
  { stato: "disponibile", label: "Segna disponibile" },
  { stato: "guasto", label: "Segna guasto" },
  { stato: "da_pulire", label: "Segna da pulire" },
];

export function DevicePublicViewModal({ device: d, onClose, onUpdated }: DevicePublicViewModalProps) {
  const [nota, setNota] = useState(d.nota ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canResolve = onUpdated && d.stato === "da_verificare";

  async function save(patch: Partial<Device>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dispositivi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, ...patch }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Aggiornamento non riuscito");
      onUpdated?.(body.devices);
      if (patch.stato) onClose();
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay device-public-overlay" onClick={onClose}>
      <div className="modal device-public-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {d.codice} — {d.marca} {d.modello}
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" type="button">
            ×
          </button>
        </div>

        {d.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="photo-preview" src={d.foto} alt={`Foto ${d.codice}`} style={{ marginBottom: 16 }} />
        ) : null}

        <div className="detail-status-row">
          <span className={`pill ${d.stato}`}>{STATUS_LABEL[d.stato]}</span>
        </div>

        <dl className="view-grid">
          <div>
            <dt>Categoria</dt>
            <dd>
              {d.categoria}
              {d.sottocategoria ? ` · ${d.sottocategoria}` : ""}
            </dd>
          </div>
          <div>
            <dt>Larghezza seduta</dt>
            <dd>{d.larghezza != null ? `${d.larghezza} cm` : "Non applicabile"}</dd>
          </div>
          {d.stato === "noleggiato" && d.cliente ? (
            <div>
              <dt>Cliente</dt>
              <dd>
                {d.cliente}
                {d.dal ? ` · dal ${fmtDate(d.dal)}` : ""}
              </dd>
            </div>
          ) : null}
          {d.sanificazione ? (
            <div>
              <dt>Ultima sanificazione</dt>
              <dd>{fmtDate(d.sanificazione)}</dd>
            </div>
          ) : null}
          {!canResolve && d.nota ? (
            <div>
              <dt>Nota</dt>
              <dd>{d.nota}</dd>
            </div>
          ) : null}
        </dl>

        {error ? <div className="banner error">{error}</div> : null}

        {canResolve ? (
          <div className="panel verify-panel" style={{ margin: "12px 0 0" }}>
            <h2>Da verificare</h2>
            <p className="hint" style={{ marginBottom: 10 }}>
              Controllato di persona? Risolvi qui, non serve passare dall&apos;amministrazione.
            </p>
            <div className="field">
              <label>Nota</label>
              <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
            <div className="card-actions" style={{ marginTop: 8, marginBottom: 14 }}>
              <button
                className="btn verify-save"
                type="button"
                disabled={saving || nota === (d.nota ?? "")}
                onClick={() => save({ nota: nota || null })}
              >
                Salva nota
              </button>
            </div>
            <div className="card-actions" style={{ marginTop: 0 }}>
              {RESOLVE_OPTIONS.map((o) => (
                <button
                  key={o.stato}
                  className={
                    o.stato === "disponibile"
                      ? "btn primary verify-resolve-primary"
                      : "btn verify-resolve-secondary"
                  }
                  type="button"
                  disabled={saving}
                  onClick={() => save({ stato: o.stato })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
