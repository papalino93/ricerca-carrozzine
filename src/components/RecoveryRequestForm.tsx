"use client";

import { useState } from "react";

export function RecoveryRequestForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestRecovery() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/recovery/request", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "Invio non riuscito");
      setMessage(body.message || "Email inviata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio non riuscito");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn primary login-submit" type="button" onClick={requestRecovery} disabled={loading || Boolean(message)}>
        {loading ? "Invio in corso…" : "Invia email di recupero"}
      </button>
      {message ? <div className="banner success recovery-result" role="status">{message}</div> : null}
      {error ? <div className="banner error recovery-result" role="alert">{error}</div> : null}
      <a className="login-recovery-link" href="/login">Torna all’accesso</a>
    </div>
  );
}
