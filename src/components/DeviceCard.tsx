"use client";

import { useState } from "react";
import { STATUS_LABEL, type Device } from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";
import { DevicePublicViewModal } from "./DevicePublicViewModal";
import { QuickRentModal } from "./QuickRentModal";

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
  /** Se passato, mostra "Noleggia" sulle card disponibili (solo dove ha senso: ricerca pubblica). */
  onRented?: (devices: Device[]) => void;
}

export function DeviceCard({ device: d, exactWidth, statusColor, onRented }: DeviceCardProps) {
  const [showDoc, setShowDoc] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showRent, setShowRent] = useState(false);

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
          {onRented && d.stato === "disponibile" ? (
            <button className="btn primary" type="button" onClick={() => setShowRent(true)}>
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
      {showRent && onRented ? (
        // Non chiude qui: dopo il noleggio confermato, QuickRentModal
        // mostra da solo il verbale di consegna, e si chiude solo quando
        // l'operatore chiude quello (altrimenti l'occasione di stamparlo
        // subito, senza tornare in admin, andrebbe persa).
        <QuickRentModal device={d} onClose={() => setShowRent(false)} onRented={onRented} />
      ) : null}
    </div>
  );
}
