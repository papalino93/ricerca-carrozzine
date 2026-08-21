"use client";

import { useState } from "react";
import type { AdminUser } from "@/lib/users";

interface UsersManagerProps {
  initialUsers: AdminUser[];
}

export function UsersManager({ initialUsers }: UsersManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/utenti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Impossibile aggiungere l'utente");
      setUsers(body.users);
      setUsername("");
      setPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(u: string) {
    if (!confirm(`Revocare l'accesso a "${u}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/utenti?username=${encodeURIComponent(u)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Impossibile rimuovere l'utente");
      setUsers(body.users);
    } catch (err) {
      setError((err as Error).message);
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

      {users.length === 0 ? (
        <p className="hint">Nessun utente aggiuntivo autorizzato per ora.</p>
      ) : (
        <table className="admin-table" style={{ marginBottom: 16 }}>
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
                  <button className="btn danger" type="button" onClick={() => handleRemove(u.username)} disabled={saving}>
                    Revoca
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </div>
  );
}
