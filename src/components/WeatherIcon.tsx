import type { WeatherIconKind } from "@/lib/weather";

/** Icone meteo costruite con primitive semplici (cerchi, linee, archi),
 * stessa famiglia visiva delle altre icone dell'app. */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const RAGGI = [
  [12, 2, 12, 3.6],
  [12, 20.4, 12, 22],
  [2, 12, 3.6, 12],
  [20.4, 12, 22, 12],
  [4.9, 4.9, 6.1, 6.1],
  [17.9, 17.9, 19.1, 19.1],
  [19.1, 4.9, 17.9, 6.1],
  [6.1, 17.9, 4.9, 19.1],
];

function Sole() {
  return (
    <>
      <circle cx="12" cy="12" r="4.2" />
      {RAGGI.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </>
  );
}

function Luna() {
  return <path d="M20 14.5A8.5 8.5 0 1 1 10.2 4a6.8 6.8 0 0 0 9.8 10.5Z" />;
}

/** Sagoma di nuvola condivisa, opzionalmente spostata in basso per lasciare
 * spazio a sole o luna che spuntano dietro. */
function Nuvola({ y = 0 }: { y?: number }) {
  return <path d={`M7.5 ${18 + y}h9a3.6 3.6 0 0 0 .3-7.2 5.3 5.3 0 0 0-10.1 1.2 3.1 3.1 0 0 0 .8 6Z`} />;
}

export function WeatherIcon({ tipo, notte = false }: { tipo: WeatherIconKind; notte?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...S} aria-hidden="true">
      {tipo === "sereno" ? (
        notte ? (
          <Luna />
        ) : (
          <Sole />
        )
      ) : null}

      {tipo === "poche-nuvole" ? (
        <>
          {notte ? (
            <path d="M17.8 8.6A5 5 0 0 1 12 3a4 4 0 1 0 5.8 5.6Z" />
          ) : (
            <>
              <circle cx="9" cy="7.6" r="2.9" />
              <line x1="9" y1="1.9" x2="9" y2="3.1" />
              <line x1="3.3" y1="7.6" x2="4.5" y2="7.6" />
              <line x1="5" y1="3.6" x2="5.8" y2="4.4" />
              <line x1="13" y1="3.6" x2="12.2" y2="4.4" />
            </>
          )}
          <Nuvola y={1.5} />
        </>
      ) : null}

      {tipo === "nuvoloso" ? <Nuvola /> : null}

      {tipo === "nebbia" ? (
        <>
          <Nuvola y={-2.5} />
          <line x1="5" y1="19" x2="14" y2="19" />
          <line x1="8" y1="21.5" x2="17" y2="21.5" />
        </>
      ) : null}

      {tipo === "pioggia" ? (
        <>
          <Nuvola y={-3} />
          <line x1="9" y1="17.5" x2="8.2" y2="20.5" />
          <line x1="13" y1="17.5" x2="12.2" y2="20.5" />
        </>
      ) : null}

      {tipo === "neve" ? (
        <>
          <Nuvola y={-3} />
          <line x1="8.4" y1="18.2" x2="8.4" y2="21" />
          <line x1="7.2" y1="19.6" x2="9.6" y2="19.6" />
          <line x1="13.4" y1="18.2" x2="13.4" y2="21" />
          <line x1="12.2" y1="19.6" x2="14.6" y2="19.6" />
        </>
      ) : null}

      {tipo === "temporale" ? (
        <>
          <Nuvola y={-3.5} />
          <path d="M12.4 16.4 10.2 20h2.9l-1.4 2.6" />
        </>
      ) : null}
    </svg>
  );
}
