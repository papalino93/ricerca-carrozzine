"use client";

import { useState } from "react";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useConfirm } from "./ConfirmDialog";

interface TwoFactorSettingsProps {
  initialEnabled: boolean;
}

type Stage = "status" | "setup" | "backup-codes" | "disable";

export function TwoFactorSettings({ initialEnabled }: TwoFactorSettingsProps) {
  const confirmAction = useConfirm();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [stage, setStage] = useState<Stage>("status");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  async function copyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedBackupCodes(true);
    } catch {
      setError("Non è stato possibile copiare i codici. Selezionali e copiali manualmente.");
    }
  }

  async function startReconfigure() {
    if (
      !(await confirmAction({
        title: "Riconfigurare il 2FA?",
        description:
          "Il QR code attuale smetterà subito di funzionare su tutti i dispositivi dove l'hai scansionato. Per usare più telefoni, scansiona il nuovo QR su tutti prima di chiudere questa pagina.",
        confirmLabel: "Continua",
      }))
    )
      return;
    await startSetup();
  }

  async function startSetup() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile avviare l'attivazione");
      setSecret(body.secret);
      setQrDataUrl(body.qrDataUrl);
      setConfirmCode("");
      setStage("setup");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Codice non valido");
      setBackupCodes(body.backupCodes);
      setCopiedBackupCodes(false);
      setEnabled(true);
      setStage("backup-codes");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile disattivare il 2FA");
      setEnabled(false);
      setDisablePassword("");
      setStage("status");
      setNotice("Autenticazione a due fattori disattivata.");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>Autenticazione a due fattori</h2>
      <p className="hint" style={{ marginBottom: 14 }}>
        Aggiunge un codice generato da un&apos;app authenticator (Google Authenticator, Authy…) al
        login, oltre a username e password.
      </p>

      {error ? <div className="banner error">{error}</div> : null}
      {notice ? (
        <div className="banner success" role="status">
          {notice}
        </div>
      ) : null}

      {stage === "status" ? (
        enabled ? (
          <>
            <p className="hint" style={{ marginBottom: 12 }}>
              <strong>Attiva</strong> sul tuo account.
            </p>
            <div className="card-actions">
              <button className="btn" type="button" onClick={startReconfigure} disabled={busy}>
                {busy ? "Avvio…" : "Riconfigura / aggiungi un dispositivo"}
              </button>
              <button className="btn danger" type="button" onClick={() => setStage("disable")}>
                Disattiva 2FA
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 12 }}>
              Non attiva sul tuo account.
            </p>
            <div className="card-actions">
              <button className="btn primary" type="button" onClick={startSetup} disabled={busy}>
                {busy ? "Avvio…" : "Attiva 2FA"}
              </button>
            </div>
          </>
        )
      ) : null}

      {stage === "setup" ? (
        <div>
          <p className="hint" style={{ marginBottom: 10 }}>
            1. Inquadra questo QR code con l&apos;app authenticator (o inserisci il codice a mano).
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR code per l'attivazione del 2FA" width={200} height={200} />
          <p className="hint" style={{ margin: "8px 0" }}>
            Codice manuale: <code>{secret}</code>
          </p>
          <form onSubmit={handleConfirm}>
            <div className="field">
              <label htmlFor="2fa-confirm-code">
                2. Inserisci il codice a 6 cifre mostrato ora dall&apos;app
              </label>
              <input
                id="2fa-confirm-code"
                inputMode="numeric"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="card-actions">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setStage("status");
                  setError(null);
                }}
                disabled={busy}
              >
                Annulla
              </button>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? "Verifica…" : "Conferma e attiva"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {stage === "backup-codes" ? (
        <div>
          <p className="hint two-factor-backup-intro">
            2FA attivato. Salva questi codici di recupero in un posto sicuro: ognuno funziona una
            sola volta e serve se perdi il telefono. Non saranno mostrati di nuovo.
          </p>
          <ul className="two-factor-backup-codes" aria-label="Codici di recupero">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="card-actions">
            <button className="btn" type="button" onClick={copyBackupCodes}>
              {copiedBackupCodes ? "Codici copiati" : "Copia codici"}
            </button>
            <button className="btn primary" type="button" onClick={() => setStage("status")}>
              Ho salvato i codici
            </button>
          </div>
        </div>
      ) : null}

      {stage === "disable" ? (
        <form onSubmit={handleDisable}>
          <div className="field">
            <label htmlFor="2fa-disable-password">
              Conferma la tua password per disattivare il 2FA
            </label>
            <input
              id="2fa-disable-password"
              type="password"
              autoComplete="current-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="card-actions">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setStage("status");
                setDisablePassword("");
                setError(null);
              }}
              disabled={busy}
            >
              Annulla
            </button>
            <button className="btn danger" type="submit" disabled={busy}>
              {busy ? "Disattivazione…" : "Disattiva 2FA"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
