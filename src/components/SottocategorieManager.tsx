"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useEffect, useRef, useState } from "react";
import { fmtTariffa, type Tariffa, type TariffaUnita } from "@/lib/tariffe-types";
import { useConfirm } from "./ConfirmDialog";

interface SottocategoriaEntry {
  categoria: string;
  nome: string;
  ausiliCount: number;
  tariffa: Tariffa | null;
}

const EMPTY_FORM = {
  nome: "",
  importo: "",
  unita: "giorno" as TariffaUnita,
  nota: "",
};

/**
 * Elenco e gestione delle sottocategorie di UNA categoria, mostrato quando
 * la si apre da CategoriesManager. Ogni sottocategoria può avere una
 * tariffa dedicata: comparirà anche nel pannello Tariffe qui sotto, non è
 * un elenco separato — è la stessa tab "Tariffe" letta/scritta da qui.
 */
export function SottocategorieManager({ categoria }: { categoria: string }) {
  const confirmAction = useConfirm();
  const [items, setItems] = useState<SottocategoriaEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // Nome originale in modifica: null quando il form serve ad aggiungerne una nuova.
  const [editing, setEditing] = useState<string | null>(null);

  // load() è richiamata sia al mount sia dopo ogni handleSubmit/handleRemove:
  // senza il numero di richiesta qui sotto, due modifiche ravvicinate
  // potevano far "sparire" temporaneamente l'ultima se le risposte
  // arrivavano in ordine invertito rispetto alle chiamate.
  const requestRef = useRef(0);

  function load() {
    const requestId = ++requestRef.current;
    fetch(`/api/sottocategorie?categoria=${encodeURIComponent(categoria)}`)
      .then(async (res) => {
        const body = await readJson(res);
        if (!res.ok) throw new Error(body.error || "Impossibile leggere le sottocategorie");
        if (requestId === requestRef.current) setItems(body.sottocategorie);
      })
      .catch((err) => {
        if (requestId === requestRef.current) setError(networkErrorMessage(err));
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria]);

  function startEdit(item: SottocategoriaEntry) {
    setEditing(item.nome);
    setError(null);
    setForm({
      nome: item.nome,
      importo: item.tariffa ? String(item.tariffa.importo).replace(".", ",") : "",
      unita: item.tariffa?.unita ?? "giorno",
      nota: item.tariffa?.nota ?? "",
    });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const importo = form.importo.trim() ? Number(form.importo.replace(",", ".")) : null;
      const res = await fetch("/api/sottocategorie", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoria,
          nome: editing ?? form.nome,
          nuovoNome: editing ? form.nome : undefined,
          importo,
          unita: form.unita,
          nota: form.nota || null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile salvare");
      cancelEdit();
      load();
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item: SottocategoriaEntry) {
    if (!(await confirmAction({ title: `Eliminare la sottocategoria “${item.nome}”?`, description: "La sottocategoria verrà rimossa dalle impostazioni.", confirmLabel: "Elimina sottocategoria", tone: "danger" }))) return;
    setSaving(true);
    setError(null);
    try {
      const params = new URLSearchParams({ categoria, nome: item.nome });
      const res = await fetch(`/api/sottocategorie?${params.toString()}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Impossibile eliminare");
      if (editing === item.nome) cancelEdit();
      load();
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="subrow-panel">
      <p className="hint" style={{ margin: "0 0 12px" }}>
        Sottocategorie di &quot;{categoria}&quot;. Con una tariffa dedicata, il noleggio la
        propone al posto di quella generale della categoria — la ritrovi anche nella scheda
        &quot;Tariffe&quot; qui sopra. Non puoi eliminare una sottocategoria ancora usata da
        qualche ausilio.
      </p>

      {error ? <div className="banner error">{error}</div> : null}

      {items === null ? (
        <p className="hint">Caricamento…</p>
      ) : items.length === 0 ? (
        <p className="hint">Nessuna sottocategoria per ora.</p>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sottocategoria</th>
                <th>Ausili</th>
                <th>Tariffa dedicata</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.nome}>
                  <td>{item.nome}</td>
                  <td>{item.ausiliCount}</td>
                  <td>{item.tariffa ? fmtTariffa(item.tariffa) : "— (usa quella della categoria)"}</td>
                  <td>
                    <div className="card-actions" style={{ marginTop: 0 }}>
                      <button className="btn" type="button" onClick={() => startEdit(item)} disabled={saving}>
                        Modifica
                      </button>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={() => handleRemove(item)}
                        disabled={saving || item.ausiliCount > 0}
                        title={
                          item.ausiliCount > 0
                            ? `${item.ausiliCount} ausili la usano ancora: cambia prima la loro sottocategoria.`
                            : undefined
                        }
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

      <form onSubmit={handleSubmit}>
        <h4 style={{ margin: "0 0 10px" }}>{editing ? `Modifica "${editing}"` : "Nuova sottocategoria"}</h4>
        <div className="field-row">
          <div className="field">
            <label>Nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="field">
            <label>Tariffa dedicata (facoltativa)</label>
            <div className="field-euro">
              <span className="field-euro-sign" aria-hidden="true">
                €
              </span>
              <input
                inputMode="decimal"
                value={form.importo}
                onChange={(e) => setForm({ ...form, importo: e.target.value })}
                placeholder="vuoto = usa quella della categoria"
              />
            </div>
          </div>
        </div>
        {form.importo.trim() ? (
          <div className="field-row">
            <div className="field">
              <label>Unità</label>
              <select
                value={form.unita}
                onChange={(e) => setForm({ ...form, unita: e.target.value as TariffaUnita })}
              >
                <option value="giorno">Al giorno</option>
                <option value="settimana">Alla settimana</option>
              </select>
            </div>
            <div className="field">
              <label>Note (facoltative)</label>
              <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            </div>
          </div>
        ) : null}
        <div className="card-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Salvataggio…" : editing ? "Salva modifiche" : "Aggiungi sottocategoria"}
          </button>
          {editing ? (
            <button className="btn ghost" type="button" onClick={cancelEdit} disabled={saving}>
              Annulla
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
