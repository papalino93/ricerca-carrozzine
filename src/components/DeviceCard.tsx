"use client";

import { useState } from "react";
import { STATUS_LABEL, type Device } from "@/lib/device-types";
import { DocumentPanel } from "./DocumentPanel";

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
  adminActions?: React.ReactNode;
}

export function DeviceCard({ device: d, exactWidth, statusColor, adminActions }: DeviceCardProps) {
  const [showDoc, setShowDoc] = useState(false);

  return (
    <div className="card">
      <div className="w-badge" style={exactWidth ? { borderColor: statusColor } : undefined}>
        {d.larghezza ?? "?"}
        <small>CM SEDUTA</small>
      </div>
      <div className="card-body">
        <div className="card-top">
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
          <button className="btn" type="button" onClick={() => setShowDoc(true)}>
            Genera documento
          </button>
          {adminActions}
        </div>
      </div>
      {showDoc ? <DocumentPanel device={d} onClose={() => setShowDoc(false)} /> : null}
    </div>
  );
}
