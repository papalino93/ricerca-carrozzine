"use client";

import { useState } from "react";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import type { SnapshotStatus, TabBackupInfo } from "@/lib/snapshot";

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
  const [lastTabs, setLastTabs] = useState<TabBackupInfo[] | null>(null);

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/backup");
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Backup non riuscito");

      const tabs = (body.tabs ?? []) as TabBackupInfo[];
      const conErrore = tabs.filter((t) => t.errore);
      setLastTabs(tabs);

      setStatus((s) => ({
        primario: { ultimo: body.data, giorni: s.primario.ultimo === body.data ? s.primario.giorni : s.primario.giorni + 1 },
        secondario: s.secondario.configurato
          ? {
              configurato: true,
              ultimo: body.backupSecondario?.riuscito ? body.data : s.secondario.ultimo,
              giorni:
                body.backupSecondario?.riuscito && s.secondario.ultimo !== body.data
                  ? s.secondario.giorni + 1
                  : s.secondario.giorni,
              errore: body.backupSecondario?.errore,
            }
          : s.secondario,
      }));

      const esitoTab =
        conErrore.length > 0
          ? ` Attenzione: ${conErrore.length === 1 ? "una tab non si è salvata" : `${conErrore.length} tab non si sono salvate`} (${conErrore.map((t) => t.tab).join(", ")}) — vedi sotto.`
          : ` Tutte le ${tabs.length} tab salvate.`;

      setLastRun(
        (body.backupSecondario?.configurato
          ? body.backupSecondario.riuscito
            ? "Backup eseguito su entrambi i fogli."
            : `Backup primario riuscito, ma quello secondario no: ${body.backupSecondario.errore ?? "errore sconosciuto"}.`
          : "Backup primario eseguito. Il secondario non è ancora configurato.") + esitoTab
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
        Ogni notte TUTTO il gestionale viene salvato automaticamente — dispositivi, clienti,
        commesse, punti fedeltà, storico, tariffe, impostazioni — fino a 60 giorni di storico.
        Uniche escluse le foto degli ausili: si possono rifotografare, e includerle farebbe
        esplodere le dimensioni del backup. Il backup primario vive nello stesso foglio Google di
        tutto il resto: se quel file si danneggiasse o venisse eliminato per errore, sparirebbe
        insieme a lui. Il backup secondario, su un foglio Google completamente separato, esiste
        apposta per quel caso.
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
              <th>Giorni conservati</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Primario</td>
              <td>
                <span className="pill disponibile">Attivo</span>
              </td>
              <td>{fmtDate(status.primario.ultimo)}</td>
              <td>{status.primario.giorni} / 60</td>
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
              <td>{status.secondario.configurato ? `${status.secondario.giorni} / 60` : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {lastTabs ? (
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tab salvata nell&apos;ultimo backup</th>
                <th>Righe</th>
                <th>Esito</th>
              </tr>
            </thead>
            <tbody>
              {lastTabs.map((t) => (
                <tr key={t.tab}>
                  <td>{t.tab}</td>
                  <td>{t.righe}</td>
                  <td>
                    {t.errore ? (
                      <span className="pill guasto" title={t.errore}>
                        Non salvata
                      </span>
                    ) : (
                      <span className="pill disponibile">Salvata</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

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
