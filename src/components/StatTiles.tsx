"use client";

interface StatTile {
  key: string;
  label: string;
  value: number;
  color: string;
  active: boolean;
}

interface StatTilesProps {
  tiles: StatTile[];
  onSelect: (key: string) => void;
}

// Riga di statistiche cliccabili, condivisa tra ricerca pubblica e admin:
// un click su una tessera filtra per quello stato (o lo azzera se già
// l'unico attivo).
export function StatTiles({ tiles, onSelect }: StatTilesProps) {
  return (
    <div className="stats-row">
      {tiles.map((t) => (
        <button
          key={t.key}
          className={`stat-tile ${t.active ? "active" : ""}`}
          type="button"
          style={{ "--stat-color": t.color } as React.CSSProperties}
          onClick={() => onSelect(t.key)}
        >
          <span className="stat-count">{t.value}</span>
          <span className="stat-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
