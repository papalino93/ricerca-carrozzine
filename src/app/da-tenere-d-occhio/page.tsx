import Link from "next/link";
import { listDevices } from "@/lib/devices";
import { listCommesse } from "@/lib/commesse";
import { buildWatchGroups } from "@/lib/watchlist";
import { FrontBar } from "@/components/FrontBar";

export const dynamic = "force-dynamic";

/** Elenco completo di "Da tenere d'occhio", senza il tetto per gruppo che
 * la home applica per non superare l'altezza delle quattro card (vedi
 * PREVIEW_CAP in app/page.tsx). Stesso raggruppamento, stesso ordine. */
export default async function DaTenereDOcchioPage() {
  const [devicesR, commesseR] = await Promise.all([
    listDevices().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof listDevices>> })
    ),
    listCommesse().then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof listCommesse>> })
    ),
  ]);

  const datiParziali = !devicesR.ok || !commesseR.ok;
  const groups = buildWatchGroups(devicesR.v, commesseR.v);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <>
      <FrontBar />
      <div className="wrap">
        <header className="page-header">
          <h1>Da tenere d&apos;occhio</h1>
          <p className="sub">
            {datiParziali
              ? "Elenco non disponibile: Google Sheets non risponde."
              : total > 0
                ? `${total} posizioni su cui c'è qualcosa da fare.`
                : "Nessuna scadenza né magazzino fermo al momento."}
          </p>
        </header>

        {total > 0 ? (
          <div className="desk-watch desk-watch-full">
            {groups.map((g) => (
              <div key={g.key}>
                <div className={`desk-watch-group ${g.tone}`}>
                  <span className="dot" aria-hidden="true" />
                  {g.label}
                  <span className="count">{g.rows.length}</span>
                </div>
                <ul>
                  {g.rows.map((r, i) => (
                    <li key={`${r.code}-${i}`}>
                      <Link href={r.href}>
                        <span className="desk-watch-code">{r.code}</span>
                        <span className="desk-watch-who">
                          <span className="desk-watch-cat">{r.cat}</span>
                          {r.rest ? <span className="desk-watch-rest">{r.rest}</span> : null}
                        </span>
                        {g.showWhen ? (
                          <span className={`desk-watch-when${r.urgent ? " urgent" : ""}`}>{r.when}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
