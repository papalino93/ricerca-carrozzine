"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);

  async function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        requiresTwoFactor?: boolean;
      };
      if (!res.ok) throw new Error(body.error || "Accesso non riuscito");
      if (body.requiresTwoFactor) {
        setStep("2fa");
        setSubmitting(false);
        return;
      }
      // Niente router.refresh() dopo: la home è "force-dynamic" e con lo
      // staleTimes di default (0s) di questo Next.js replace() già rifà la
      // richiesta al server da solo — un refresh() qui raddoppiava il giro
      // su Google Sheets a ogni login, invece di evitare dati vecchi in
      // cache (che qui non può esserci).
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accesso non riuscito");
      setSubmitting(false);
    }
  }

  async function handleTwoFactor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, remember }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Codice non valido");
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Codice non valido");
      setSubmitting(false);
    }
  }

  if (step === "2fa") {
    return (
      <form className="login-form" onSubmit={handleTwoFactor}>
        <div className="field">
          <label htmlFor="login-2fa-code">Codice a 6 cifre</label>
          <p className="hint" style={{ marginTop: -2, marginBottom: 8 }}>
            Apri l&apos;app authenticator sul telefono e inserisci il codice mostrato
            (oppure un codice di recupero).
          </p>
          <input
            id="login-2fa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
          />
        </div>
        <label className="login-remember" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Non chiedere più su questo dispositivo per 30 giorni
        </label>
        {error ? (
          <div className="banner error" role="alert">
            {error}
          </div>
        ) : null}
        <button className="btn primary login-submit" type="submit" disabled={submitting}>
          {submitting ? "Verifica in corso…" : "Verifica codice"}
        </button>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={handleCredentials}>
      <div className="field">
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? (
        <div className="banner error" role="alert">
          {error}
        </div>
      ) : null}
      <button className="btn primary login-submit" type="submit" disabled={submitting}>
        {submitting ? "Accesso in corso…" : "Accedi"}
      </button>
      <a className="login-recovery-link" href="/recupero-accesso">
        Hai dimenticato username o password?
      </a>
    </form>
  );
}
