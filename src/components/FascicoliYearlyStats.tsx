"use client";

import { useMemo, useState } from "react";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { availableFascicoliYears, yearlyFascicoliStats } from "@/lib/fascicoli-stats";

export function FascicoliYearlyStats({ fascicoli }: { fascicoli: FascicoloRecord[] }) {
  const years = useMemo(() => availableFascicoliYears(fascicoli), [fascicoli]);
  const [anno, setAnno] = useState(() => years[0] ?? new Date().getFullYear());
  const stats = useMemo(() => yearlyFascicoliStats(fascicoli, anno), [fascicoli, anno]);

  return (
    <div className="panel">
      <div className="top-nav" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Statistiche fascicolazioni</h2>
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
        <div className="stat-tile" style={{ "--stat-color": "#175c22" } as React.CSSProperties}>
          <span className="stat-count">{stats.totale}</span>
          <span className="stat-label">Plantari {anno}</span>
        </div>
        <div className="stat-tile" style={{ "--stat-color": "#2F5A8A" } as React.CSSProperties}>
          <span className="stat-count">{stats.asl}</span>
          <span className="stat-label">Pratiche ASL</span>
        </div>
        <div className="stat-tile" style={{ "--stat-color": "#6B4E93" } as React.CSSProperties}>
          <span className="stat-count">{stats.privati}</span>
          <span className="stat-label">Privati</span>
        </div>
      </div>
    </div>
  );
}
