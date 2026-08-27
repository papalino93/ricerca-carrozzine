"use client";

import { useState } from "react";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import type { SnapshotStatus } from "@/lib/snapshot";

interface BackupManagerProps {
  initialStatus: SnapshotStatus;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "mai";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function BackupManager({ initialStatus }: BackupManagerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/backup");
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Backup non riuscito");
      setStatus((s) => ({
        primario: { ultimo: body.data, totale: s.primario.totale + (s.primario.ultimo === body.data ? 0 : 1) },
        secondario: s.secondario.configurato
          ? {
              configurato: true,
              ultimo: body.backupSecondario?.riuscito ? body.data : s.secondario.ultimo,
              totale:
                s.secondario.totale +
                (body.backupSecondario?.riuscito && s.secondario.ultimo !== body.data ? 1 : 0),
              errore: body.backupSecondario?.errore,
            }
          : s.secondario,
      }));
      setLastRun(
        body.backupSecondario?.configurato
          ? body.backupSecondario.riuscito
            ? "Backup eseguito su entrambi i fogli."
            : `Backup primario riuscito, ma quello secondario no: ${body.backupSecondario.errore ?? "errore sconosciuto"}.`
          : "Backup primario eseguito. Il secondario non è ancora configurato."
      );
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="panel">
      <h2>Backup dei dati</h2>
      <p className="hint" style={{ marginBottom: 14 }}>
        Ogni notte il magazzino viene salvato automaticamente (fino a 60 giorni di storico). Il
        backup primario vive nello stesso foglio Google di tutto il resto: se quel file si
        danneggiasse o venisse eliminato per errore, sparirebbe insieme a lui. Il backup
        secondario, su un foglio Google completamente separato, esiste apposta per quel caso.
      </p>

      {error ? <div className="banner error">{error}</div> : null}
      {lastRun ? (
        <p className="hint" style={{ margin: "0 0 14px", color: "var(--ok-fg)" }}>
          {lastRun}
        </p>
      ) : null}

      <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Stato</th>
              <th>Ultimo backup</th>
              <th>Snapshot conservati</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Primario</td>
              <td>
                <span className="pill disponibile">Attivo</span>
              </td>
              <td>{fmtDate(status.primario.ultimo)}</td>
              <td>{status.primario.totale} / 60</td>
            </tr>
            <tr>
              <td>Secondario</td>
              <td>
                {status.secondario.configurato ? (
                  status.secondario.errore ? (
                    <span className="pill guasto">Errore</span>
                  ) : (
                    <span className="pill disponibile">Attivo</span>
                  )
                ) : (
                  <span className="pill da_verificare">Non configurato</span>
                )}
              </td>
              <td>{status.secondario.configurato ? fmtDate(status.secondario.ultimo) : "—"}</td>
              <td>{status.secondario.configurato ? `${status.secondario.totale} / 60` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {!status.secondario.configurato ? (
        <div className="internal-note" style={{ marginBottom: 16 }}>
          <b>Il backup secondario non è ancora configurato.</b>
          <p style={{ margin: "6px 0 0" }}>
            Per attivarlo: crea un nuovo Google Sheet vuoto (in un account o cartella diversa da
            quello principale, se possibile), condividilo con lo stesso indirizzo email
            dell&apos;account di servizio già usato per il foglio principale (lo trovi nella
            console Google Cloud, sezione &quot;Account di servizio&quot;, oppure nelle tue note
            di configurazione iniziale), poi mandami l&apos;ID di quel foglio — la parte dell&apos;URL
            tra <code>/d/</code> e <code>/edit</code> — e lo attivo io.
          </p>
        </div>
      ) : null}

      <div className="card-actions">
        <button className="btn primary" type="button" onClick={handleRunNow} disabled={running}>
          {running ? "Backup in corso…" : "Esegui backup ora"}
        </button>
      </div>
    </div>
  );
}
