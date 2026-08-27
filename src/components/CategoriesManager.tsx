"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useState } from "react";

interface CategoriesManagerProps {
  initialCategories: string[];
}

export function CategoriesManager({ initialCategories }: CategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/categorie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile aggiungere la categoria");
      setCategories(body.categories);
      setNome("");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(categoria: string) {
    if (!confirm(`Eliminare la categoria "${categoria}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/categorie?nome=${encodeURIComponent(categoria)}`, {
        method: "DELETE",
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile eliminare la categoria");
      setCategories(body.categories);
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Categorie ausili</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Ogni dispositivo appartiene a una di queste categorie (carrozzine, rollatori,
        stampelle, magnetoterapia, ecc.): compaiono come filtro nella ricerca e
        nella scelta della categoria quando aggiungi o modifichi un dispositivo. Non puoi
        eliminare una categoria ancora usata da qualche dispositivo.
      </p>

      {error ? <div className="banner error">{error}</div> : null}

      {categories.length === 0 ? (
        <p className="hint">Nessuna categoria configurata.</p>
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
            {categories.map((c) => (
              <tr key={c}>
                <td>{c}</td>
                <td>
                  <div className="card-actions" style={{ marginTop: 0 }}>
                    <button
                      className="btn danger"
                      type="button"
                      onClick={() => handleRemove(c)}
                      disabled={saving}
                    >
                      Elimina
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
          <label>Nuova categoria</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : "Aggiungi categoria"}
          </button>
        </div>
      </form>
    </div>
  );
}
