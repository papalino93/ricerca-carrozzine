"use client";

import { useState } from "react";

export function RecoveryPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Le due password non coincidono");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Modifica non riuscita");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modifica non riuscita");
    } finally {
      setLoading(false);
    }
  }

  if (done) return <div><div className="banner success">Password aggiornata.</div><a className="login-recovery-link" href="/login">Accedi</a></div>;

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="field"><label htmlFor="new-password">Nuova password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <div className="field"><label htmlFor="confirm-password">Ripeti la password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
      {error ? <div className="banner error" role="alert">{error}</div> : null}
      <button className="btn primary login-submit" type="submit" disabled={loading}>{loading ? "Salvataggio…" : "Salva nuova password"}</button>
    </form>
  );
}
