"use client";

import { useMemo, useState } from "react";
import type { Device } from "@/lib/device-types";
import { availableStatsYears, yearlyDeviceStats } from "@/lib/device-stats";

function fmtEuro(n: number): string {
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export function DeviceYearlyStats({ devices }: { devices: Device[] }) {
  const years = useMemo(() => availableStatsYears(devices), [devices]);
  const [anno, setAnno] = useState(() => years[0] ?? new Date().getFullYear());
  const stats = useMemo(() => yearlyDeviceStats(devices, anno), [devices, anno]);

  return (
    <div className="panel">
      <div className="top-nav" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Statistiche magazzino</h2>
        <div className="field" style={{ minWidth: 140, margin: 0 }}>
          <select value={anno} onChange={(e) => setAnno(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="stats-row">
        <div className="stat-tile" style={{ "--stat-color": "#1F7A3D" } as React.CSSProperties}>
          <span className="stat-count">{stats.aggiunti.conteggio}</span>
          <span className="stat-label">Articoli aggiunti nel {anno}</span>
          <span className="hint">{fmtEuro(stats.aggiunti.totaleAcquisto)} di acquisto</span>
        </div>
        <div className="stat-tile" style={{ "--stat-color": "#2F5A8A" } as React.CSSProperties}>
          <span className="stat-count">{stats.venduti.conteggio}</span>
          <span className="stat-label">Articoli venduti nel {anno}</span>
          <span className="hint">{fmtEuro(stats.venduti.totaleVendita)} di vendita</span>
        </div>
      </div>
    </div>
  );
}
