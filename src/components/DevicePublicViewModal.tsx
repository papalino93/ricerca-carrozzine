"use client";

import { STATUS_LABEL, type Device } from "@/lib/device-types";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface DevicePublicViewModalProps {
  device: Device;
  onClose: () => void;
}

// Vista di sola lettura per la ricerca pubblica: nessuna modifica, nessuno
// storico (riservato all'amministrazione) — solo le informazioni utili a
// un operatore per decidere se questo è l'ausilio giusto.
export function DevicePublicViewModal({ device: d, onClose }: DevicePublicViewModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
          {d.nota ? (
            <div>
              <dt>Nota</dt>
              <dd>{d.nota}</dd>
            </div>
          ) : null}
        </dl>

        <div className="card-actions" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
