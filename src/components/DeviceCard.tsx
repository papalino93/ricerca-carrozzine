"use client";

import { useState } from "react";
import { STATUS_LABEL, type Device } from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";
import { DevicePublicViewModal } from "./DevicePublicViewModal";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface DeviceCardProps {
  device: Device;
  exactWidth?: boolean;
  statusColor: string;
  /**
   * Se passato, mostra "Noleggia" sulle card disponibili (solo dove ha
   * senso: ricerca pubblica). La modale di noleggio vive nel chiamante,
   * non qui: appena il noleggio va a buon fine questa card può sparire
   * dall'elenco filtrato (stato non più "disponibile"), e portandosi via
   * anche il verbale di consegna che dovrebbe apparire subito dopo.
   */
  onRent?: () => void;
}

export function DeviceCard({ device: d, exactWidth, statusColor, onRent }: DeviceCardProps) {
  const [showDoc, setShowDoc] = useState(false);
  const [showView, setShowView] = useState(false);

  return (
    <div className="card" id={`device-${d.codice}`}>
      <div className="w-badge" style={exactWidth ? { borderColor: statusColor } : undefined}>
        {d.larghezza ?? "—"}
        <small>{d.larghezza != null ? "CM SEDUTA" : "N/D"}</small>
      </div>
      <div className="card-body">
        <div className="card-top">
          {d.foto ? (
            <img className="card-photo" src={d.foto} alt={`${d.marca} ${d.modello}`} />
          ) : null}
          <span className="code">{d.codice}</span>
          <span className="model">
            {d.marca} {d.modello}
          </span>
          <span className={`pill ${d.stato}`}>{STATUS_LABEL[d.stato]}</span>
        </div>
        <div className="meta">
          {d.categoria}
          {d.cliente ? ` · dal ${fmtDate(d.dal)} — ${d.cliente}` : ""}
          {d.stato === "disponibile" && d.sanificazione
            ? ` · sanificata il ${fmtDate(d.sanificazione)}`
            : ""}
        </div>
        {d.nota ? <div className="note">{d.nota}</div> : null}
        <div className="card-actions">
          {onRent && d.stato === "disponibile" ? (
            <button className="btn primary" type="button" onClick={onRent}>
              Noleggia
            </button>
          ) : null}
          <button className="btn" type="button" onClick={() => setShowView(true)}>
            Visualizza
          </button>
          <button className="btn" type="button" onClick={() => setShowDoc(true)}>
            Genera documento
          </button>
        </div>
      </div>
      {showDoc ? <DocumentPanel device={d} onClose={() => setShowDoc(false)} /> : null}
      {showView ? <DevicePublicViewModal device={d} onClose={() => setShowView(false)} /> : null}
    </div>
  );
}
