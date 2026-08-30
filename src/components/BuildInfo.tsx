// Indicatore di versione, minuscolo e in un angolo, per poter verificare a
// colpo d'occhio se quello che si sta guardando è davvero l'ultimo deploy
// (vedi next.config.ts per come SHA/data arrivano qui). Niente da mostrare
// in sviluppo locale, dove SHA resta vuoto.
function fmt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BuildInfo() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA;
  if (!sha) return null;
  const time = fmt(process.env.NEXT_PUBLIC_BUILD_TIME ?? "");
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 4,
        right: 6,
        fontSize: 10,
        lineHeight: 1,
        color: "#8a938c",
        opacity: 0.55,
        pointerEvents: "none",
        zIndex: 9999,
        fontFamily: "monospace",
      }}
    >
      {sha}
      {time ? ` · ${time}` : ""}
    </div>
  );
}
