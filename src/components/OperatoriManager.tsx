"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useState } from "react";
import { useConfirm } from "./ConfirmDialog";

interface OperatoriManagerProps {
  initialOperatori: string[];
}

export function OperatoriManager({ initialOperatori }: OperatoriManagerProps) {
  const confirmAction = useConfirm();
  const [operatori, setOperatori] = useState(initialOperatori);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/operatori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile aggiungere l'operatore");
      setOperatori(body.operatori);
      setNome("");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(operatore: string) {
    if (
      !(await confirmAction({
        title: `Rimuovere "${operatore}" dagli operatori?`,
        description: "Le commesse già assegnate a questo nome restano invariate.",
        confirmLabel: "Rimuovi operatore",
        tone: "danger",
      }))
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operatori?nome=${encodeURIComponent(operatore)}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile rimuovere l'operatore");
      setOperatori(body.operatori);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Operatori</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Chi lavora al banco: compaiono nel menu a tendina &ldquo;Operatore&rdquo; quando si apre
        una commessa, invece di doverlo scrivere ogni volta.
      </p>

      {error ? <div className="banner error">{error}</div> : null}

      {operatori.length === 0 ? (
        <p className="hint">Nessun operatore configurato.</p>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operatori.map((o) => (
                <tr key={o}>
                  <td>{o}</td>
                  <td>
                    <div className="card-actions" style={{ marginTop: 0 }}>
                      <button className="btn danger" type="button" onClick={() => handleRemove(o)} disabled={saving}>
                        Rimuovi
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
        <div className="field">
          <label>Nuovo operatore</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : "Aggiungi operatore"}
          </button>
        </div>
      </form>
    </div>
  );
}
