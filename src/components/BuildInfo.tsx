// Indicatore di versione, minuscolo e in un angolo, per poter verificare a
// colpo d'occhio se quello che si sta guardando è davvero l'ultimo deploy
// (vedi next.config.ts per come SHA/data arrivano qui). Niente da mostrare
// in sviluppo locale, dove SHA resta vuoto.
// Fuso orario Italia forzato esplicitamente: senza, sul server (Vercel gira
// in UTC) l'orario mostrato sarebbe indietro di 1-2 ore rispetto a quello
// reale del deploy, a seconda dell'ora legale.
function fmt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export function BuildInfo() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.11";
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA;
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
      v{version}
      {sha ? ` · ${sha}` : ""}
      {time ? ` · ${time}` : ""}
    </div>
  );
}
