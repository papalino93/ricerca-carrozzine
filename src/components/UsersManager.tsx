"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useState } from "react";
import type { AdminUser } from "@/lib/users";
import { useConfirm } from "./ConfirmDialog";
import { useModalA11y } from "./useModalA11y";

interface UsersManagerProps {
  initialUsers: AdminUser[];
}

export function UsersManager({ initialUsers }: UsersManagerProps) {
  const confirmAction = useConfirm();
  const [users, setUsers] = useState(initialUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmationPassword, setConfirmationPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const passwordDialogRef = useModalA11y(closeReset, Boolean(passwordTarget));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/utenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile aggiungere l'utente");
      setUsers(body.users);
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function openReset(u: string) {
    setPasswordTarget(u);
    setNewPassword("");
    setConfirmationPassword("");
    setShowNewPassword(false);
    setError(null);
    setResetError(null);
    setNotice(null);
  }

  function closeReset() {
    if (saving) return;
    setPasswordTarget(null);
    setNewPassword("");
    setConfirmationPassword("");
    setShowNewPassword(false);
    setResetError(null);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordTarget) return;
    if (newPassword.length < 6) {
      setResetError("La password deve contenere almeno 6 caratteri.");
      return;
    }
    if (newPassword !== confirmationPassword) {
      setResetError("Le due password non coincidono.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    setResetError(null);
    try {
      const res = await fetch("/api/utenti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: passwordTarget, password: newPassword }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile reimpostare la password");
      setUsers(body.users);
      setNotice(`Password aggiornata per “${passwordTarget}”.`);
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmationPassword("");
      setShowNewPassword(false);
    } catch (err) {
      setResetError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(u: string) {
    if (!(await confirmAction({ title: `Revocare l'accesso a “${u}”?`, description: "L'utente non potrà più accedere al gestionale.", confirmLabel: "Revoca accesso", tone: "danger" }))) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/utenti?username=${encodeURIComponent(u)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile rimuovere l'utente");
      setUsers(body.users);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Utenti autorizzati</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Oltre alle credenziali principali (quelle impostate su Vercel), puoi autorizzare altri
        account per l&apos;accesso a <code>/admin</code>. Ogni utente qui sotto entra con il proprio
        username e password.
      </p>

      {error ? <div className="banner error">{error}</div> : null}
      {notice ? (
        <div className="banner success" role="status">
          {notice}
        </div>
      ) : null}

      {users.length === 0 ? (
        <p className="hint">Nessun utente aggiuntivo autorizzato per ora.</p>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.username}>
                <td>{u.username}</td>
                <td>
                  <div className="card-actions" style={{ marginTop: 0 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => openReset(u.username)}
                      disabled={saving}
                    >
                      Reimposta password
                    </button>
                    <button className="btn danger" type="button" onClick={() => handleRemove(u.username)} disabled={saving}>
                      Revoca
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <form onSubmit={handleAdd}>
        <div className="field-row">
          <div className="field">
            <label>Nuovo username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password (almeno 6 caratteri)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
        </div>
        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : "Autorizza utente"}
          </button>
        </div>
      </form>

      {passwordTarget ? (
        <div className="confirm-backdrop" role="presentation" onMouseDown={closeReset}>
          <div
            ref={passwordDialogRef}
            className="confirm-dialog password-change-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-change-title"
            aria-describedby="password-change-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog-icon" aria-hidden="true">
              ✓
            </div>
            <h2 id="password-change-title">Nuova password per “{passwordTarget}”</h2>
            <p id="password-change-description">
              Scegli una password di almeno 6 caratteri e confermala prima di salvarla.
            </p>
            <form onSubmit={handleReset}>
              <div className="field password-change-field">
                <label htmlFor="new-password">Nuova password</label>
                <div className="password-change-input">
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    autoFocus
                    required
                  />
                  <button
                    className="btn ghost password-toggle"
                    type="button"
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    aria-label={showNewPassword ? "Nascondi password" : "Mostra password"}
                  >
                    {showNewPassword ? "Nascondi" : "Mostra"}
                  </button>
                </div>
              </div>
              <div className="field password-change-field">
                <label htmlFor="confirmation-password">Conferma password</label>
                <input
                  id="confirmation-password"
                  type={showNewPassword ? "text" : "password"}
                  value={confirmationPassword}
                  onChange={(event) => setConfirmationPassword(event.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </div>
              {resetError ? (
                <div className="banner error password-change-error" role="alert">
                  {resetError}
                </div>
              ) : null}
              <div className="confirm-dialog-actions">
                <button type="button" className="btn" onClick={closeReset} disabled={saving}>
                  Annulla
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? "Salvataggio…" : "Salva password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
