"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { matchesQuery } from "@/lib/search-match";
import { networkErrorMessage, readJson } from "@/lib/fetch-json";

interface FascicoloNuovoClientProps {
  clients: ClientRecord[];
  fascicoli: FascicoloRecord[];
  /** Precompila la ricerca e seleziona subito il cliente se il nome
   * corrisponde esattamente — usato da "Crea nuovo fascicolo per questo
   * cliente" (duplicazione intelligente: recupera solo il cliente, MAI
   * contenuti clinici, che nel nostro modello vivono comunque solo nel
   * fascicolo, mai in anagrafica). */
  initialClienteNome?: string;
}

function emptyNewClientForm() {
  return {
    nome: "",
    cognome: "",
    codiceFiscale: "",
    dataNascita: "",
    luogoNascita: "",
    indirizzo: "",
    cap: "",
    localita: "",
    provincia: "",
    telefono: "",
    email: "",
  };
}

export function FascicoloNuovoClient({ clients, fascicoli, initialClienteNome }: FascicoloNuovoClientProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialClienteNome ?? "");
  const [selected, setSelected] = useState<ClientRecord | null>(
    () => clients.find((c) => c.nome.toLowerCase() === (initialClienteNome ?? "").toLowerCase()) ?? null
  );
  const [creatingNew, setCreatingNew] = useState(false);
  const [newClient, setNewClient] = useState(emptyNewClientForm());
  const [tipoDispositivo, setTipoDispositivo] = useState("Plantari su misura");
  const [operatore, setOperatore] = useState("");
  const [commessa, setCommessa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fascicoliPerCliente = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of fascicoli) {
      const key = f.clienteNome.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [fascicoli]);

  const risultati = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clients
      .filter((c) => matchesQuery(`${c.nome} ${c.codiceFiscale ?? ""} ${c.telefono ?? c.cellulare ?? ""}`.toLowerCase(), q))
      .slice(0, 8);
  }, [clients, query]);

  async function creaFascicolo(clienteNome: string, clienteCF: string | null) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/fascicoli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNome,
          clienteCF,
          commessa: commessa.trim() || null,
          tipoDispositivo: tipoDispositivo.trim() || "Plantari su misura",
          operatore: operatore.trim() || null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Errore nella creazione del fascicolo");
      router.push(`/admin/fascicoli/${body.fascicolo.numero}`);
    } catch (err) {
      setError(networkErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function handleUsaEsistente() {
    if (!selected) return;
    await creaFascicolo(selected.nome, selected.codiceFiscale);
  }

  async function handleCreaNuovoCliente(e: React.FormEvent) {
    e.preventDefault();
    if (!newClient.nome.trim()) {
      setError("Il nome è obbligatorio");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clienti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: newClient.nome,
          cognome: newClient.cognome || null,
          codiceFiscale: newClient.codiceFiscale || null,
          dataNascita: newClient.dataNascita || null,
          luogoNascita: newClient.luogoNascita || null,
          indirizzo: newClient.indirizzo || null,
          cap: newClient.cap || null,
          localita: newClient.localita || null,
          provincia: newClient.provincia || null,
          telefono: newClient.telefono || null,
          email: newClient.email || null,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Errore nella creazione del cliente");
      await creaFascicolo(body.client.nome, body.client.codiceFiscale);
    } catch (err) {
      setError(networkErrorMessage(err));
      setSubmitting(false);
    }
  }

  const datiFascicoloForm = (
    <div className="panel">
      <h2>Dati fascicolo</h2>
      <div className="form-grid">
        <div className="field">
          <label>Tipo dispositivo</label>
          <input value={tipoDispositivo} onChange={(e) => setTipoDispositivo(e.target.value)} />
        </div>
        <div className="field">
          <label>Operatore</label>
          <input value={operatore} onChange={(e) => setOperatore(e.target.value)} placeholder="Facoltativo" />
        </div>
        <div className="field">
          <label>Commessa collegata</label>
          <input value={commessa} onChange={(e) => setCommessa(e.target.value)} placeholder="Facoltativo, se già aperta in Commesse" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="wrap">
      <header className="page-header">
        <div className="page-header-text">
          <h1>Nuovo fascicolo</h1>
          <p className="sub">Cerca prima il cliente: evita di creare doppioni in anagrafica.</p>
        </div>
      </header>

      {error ? <div className="banner error">{error}</div> : null}

      {!creatingNew ? (
        <div className="panel">
          <h2>🔎 Cerca cliente</h2>
          <input
            className="searchbox"
            placeholder="Nome, cognome, codice fiscale o telefono…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            autoFocus
          />

          {!query.trim() ? null : risultati.length === 0 ? (
            <p className="hint">Nessun cliente trovato.</p>
          ) : (
            <ul className="search-result-list">
              {risultati.map((c) => {
                const nFascicoli = fascicoliPerCliente.get(c.nome.trim().toLowerCase()) ?? 0;
                return (
                  <li key={c.nome}>
                    <button
                      type="button"
                      className="search-result-item"
                      style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                      onClick={() => setSelected(c)}
                    >
                      <strong>{c.nome}</strong>
                      {c.codiceFiscale ? ` — CF ${c.codiceFiscale}` : ""}
                      <div className="meta">
                        {nFascicoli > 0 ? `${nFascicoli} fascicolo/i precedente/i` : "Nessun fascicolo precedente"}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected ? (
            <div className="banner" style={{ marginTop: 14 }}>
              Cliente già presente: <strong>{selected.nome}</strong>
              {selected.codiceFiscale ? ` (CF ${selected.codiceFiscale})` : ""}
            </div>
          ) : null}

          <div className="card-actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn" onClick={() => setCreatingNew(true)}>
              + Crea nuovo cliente
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="page-title-row" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Nuovo cliente</h2>
            <button type="button" className="btn-link" onClick={() => setCreatingNew(false)}>
              ← Torna alla ricerca
            </button>
          </div>
          <form onSubmit={handleCreaNuovoCliente}>
            <div className="form-grid">
              <div className="field">
                <label>Nome e cognome *</label>
                <input
                  value={newClient.nome}
                  onChange={(e) => setNewClient({ ...newClient, nome: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Codice fiscale</label>
                <input
                  value={newClient.codiceFiscale}
                  onChange={(e) => setNewClient({ ...newClient, codiceFiscale: e.target.value.toUpperCase() })}
                  placeholder="Facoltativo"
                />
              </div>
              <div className="field">
                <label>Data di nascita</label>
                <input
                  type="date"
                  value={newClient.dataNascita}
                  onChange={(e) => setNewClient({ ...newClient, dataNascita: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Luogo di nascita</label>
                <input
                  value={newClient.luogoNascita}
                  onChange={(e) => setNewClient({ ...newClient, luogoNascita: e.target.value })}
                  placeholder="Facoltativo"
                />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Indirizzo</label>
                <input
                  value={newClient.indirizzo}
                  onChange={(e) => setNewClient({ ...newClient, indirizzo: e.target.value })}
                  placeholder="Facoltativo"
                />
              </div>
              <div className="field">
                <label>CAP</label>
                <input value={newClient.cap} onChange={(e) => setNewClient({ ...newClient, cap: e.target.value })} placeholder="Facoltativo" />
              </div>
              <div className="field">
                <label>Comune</label>
                <input
                  value={newClient.localita}
                  onChange={(e) => setNewClient({ ...newClient, localita: e.target.value })}
                  placeholder="Facoltativo"
                />
              </div>
              <div className="field">
                <label>Provincia</label>
                <input
                  value={newClient.provincia}
                  onChange={(e) => setNewClient({ ...newClient, provincia: e.target.value })}
                  placeholder="Facoltativo"
                />
              </div>
              <div className="field">
                <label>Telefono</label>
                <input
                  value={newClient.telefono}
                  onChange={(e) => setNewClient({ ...newClient, telefono: e.target.value })}
                  placeholder="Facoltativo"
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="Facoltativo"
                />
              </div>
            </div>
            {datiFascicoloForm}
            <div className="card-actions">
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "Creazione in corso…" : "Crea cliente e fascicolo"}
              </button>
            </div>
          </form>
        </div>
      )}

      {!creatingNew && selected ? (
        <>
          {datiFascicoloForm}
          <div className="card-actions">
            <button type="button" className="btn primary" disabled={submitting} onClick={handleUsaEsistente}>
              {submitting ? "Creazione in corso…" : "Usa cliente esistente e crea fascicolo"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
