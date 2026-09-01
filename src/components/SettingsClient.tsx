"use client";

import { networkErrorMessage, readJson } from "@/lib/fetch-json";
import { useRef, useState } from "react";
import type { CompanySettings } from "@/lib/settings";
import type { AdminUser } from "@/lib/users";
import type { Tariffa } from "@/lib/tariffe-types";
import type { SnapshotStatus } from "@/lib/snapshot";
import { UsersManager } from "./UsersManager";
import { CategoriesManager } from "./CategoriesManager";
import { TariffeManager } from "./TariffeManager";
import { BackupManager } from "./BackupManager";
import { TwoFactorSettings } from "./TwoFactorSettings";
import { Toast } from "./Toast";
import { LogoutButton } from "./LogoutButton";

interface SettingsClientProps {
  initialSettings: CompanySettings;
  initialUsers: AdminUser[];
  initialCategories: string[];
  initialTariffe: Tariffa[];
  initialBackupStatus: SnapshotStatus;
  currentUsername: string;
  currentUserTwoFactorEnabled: boolean;
  twoFactorUsernames: string[];
}

type SettingsTab = "azienda" | "categorie" | "tariffe" | "fidelity" | "backup" | "utenti" | "sicurezza";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "azienda", label: "Azienda" },
  { key: "categorie", label: "Categorie" },
  { key: "tariffe", label: "Tariffe" },
  { key: "fidelity", label: "Fidelity" },
  { key: "backup", label: "Backup" },
  { key: "utenti", label: "Utenti" },
  { key: "sicurezza", label: "Sicurezza" },
];

export function SettingsClient({
  initialSettings,
  initialUsers,
  initialCategories,
  initialTariffe,
  initialBackupStatus,
  currentUsername,
  currentUserTwoFactorEnabled,
  twoFactorUsernames,
}: SettingsClientProps) {
  const [tab, setTab] = useState<SettingsTab>("azienda");
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload-logo", { method: "POST", body: form });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Caricamento del logo non riuscito");
      setSettings((s) => ({ ...s, logoUrl: body.url }));
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/impostazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      showToast("Impostazioni salvate");
    } catch (err) {
      setError(networkErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap">
      <header className="page-header with-action">
        <div>
          <h1>Impostazioni</h1>
          <p className="sub">Dati aziendali, categorie ausili, tariffe e utenti autorizzati.</p>
        </div>
        <LogoutButton className="btn" />
      </header>

      <div className="chips" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`chip ${tab === t.key ? "active" : ""}`}
            type="button"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="banner error">{error}</div> : null}

      {/* I tre pannelli restano tutti montati (nascosti con CSS, non
          smontati): CategoriesManager e UsersManager gestiscono la propria
          lista internamente, e smontarli ad ogni cambio tab la faceva
          ripartire dai dati iniziali della pagina, perdendo aggiunte o
          rimozioni fatte poco prima. */}
      <div style={{ display: tab === "azienda" ? "block" : "none" }}>
        <form className="panel" onSubmit={handleSubmit}>
          <h2>Dati aziendali</h2>
          <p className="hint" style={{ marginBottom: 14 }}>
            Questi dati compaiono nell&apos;intestazione dei documenti di noleggio generati in PDF.
          </p>
          <div className="field">
            <label>Ragione sociale</label>
            <input
              value={settings.ragioneSociale}
              onChange={(e) => setSettings({ ...settings, ragioneSociale: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Indirizzo sede</label>
            <input
              value={settings.indirizzo}
              onChange={(e) => setSettings({ ...settings, indirizzo: e.target.value })}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Partita IVA</label>
              <input
                value={settings.partitaIva}
                onChange={(e) => setSettings({ ...settings, partitaIva: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Telefono</label>
              <input
                value={settings.telefono}
                onChange={(e) => setSettings({ ...settings, telefono: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>Logo aziendale</label>
            <div className="logo-row">
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoUrl} alt="Logo aziendale" className="logo-preview" />
              ) : null}
              {/* Il selettore file vero resta nascosto: il pulsante lo apre.
                  Così il comando ha lo stesso aspetto di tutti gli altri
                  invece del controllo grezzo del browser. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                disabled={uploading}
                style={{ display: "none" }}
              />
              <button
                className="btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Caricamento…" : settings.logoUrl ? "Cambia logo" : "Carica logo"}
              </button>
            </div>
            {!settings.logoUrl ? (
              <p className="hint">
                Nessun logo caricato: sui documenti verrà mostrata solo la ragione sociale in testo.
              </p>
            ) : null}
          </div>

          <div className="field">
            <label>Condizioni generali (testo in corpo piccolo sui documenti)</label>
            <textarea
              rows={4}
              value={settings.condizioniGenerali}
              onChange={(e) => setSettings({ ...settings, condizioniGenerali: e.target.value })}
            />
            <p className="hint">
              Fai rivedere questo testo da un commercialista o consulente prima di
              usarlo con i clienti — non è ancora una clausola legale verificata.
            </p>
          </div>

          <div className="field">
            <label>Informativa privacy (testo in corpo piccolo sui documenti)</label>
            <textarea
              rows={6}
              value={settings.informativaPrivacy}
              onChange={(e) => setSettings({ ...settings, informativaPrivacy: e.target.value })}
            />
            <p className="hint">
              Fai rivedere questo testo da un legale o consulente privacy prima di
              usarlo con i clienti — in particolare i tempi di conservazione dei dati e
              l&apos;eventuale trattamento di categorie particolari di dati (es. informazioni
              sanitarie che l&apos;ausilio noleggiato può far emergere indirettamente).
            </p>
          </div>

          <div className="card-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva impostazioni"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ display: tab === "categorie" ? "block" : "none" }}>
        <CategoriesManager initialCategories={initialCategories} />
      </div>

      <div style={{ display: tab === "tariffe" ? "block" : "none" }}>
        <TariffeManager initialTariffe={initialTariffe} categories={initialCategories} />
      </div>

      <div style={{ display: tab === "fidelity" ? "block" : "none" }}>
        <form className="panel" onSubmit={handleSubmit}>
          <h2>Programma fedeltà</h2>
          <p className="hint" style={{ marginBottom: 14 }}>
            Regole di accredito punti (usate quando una scheda commessa passa a &quot;ritirata&quot;,
            vedi Commesse) e testo del modulo di adesione da far firmare ai nuovi iscritti.
          </p>
          <div className="field-row">
            <div className="field">
              <label>Punti per ogni euro speso</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={settings.puntiPerEuro}
                onChange={(e) => setSettings({ ...settings, puntiPerEuro: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Soglia punti premio</label>
              <input
                type="number"
                min={0}
                value={settings.sogliaPremioPunti}
                onChange={(e) => setSettings({ ...settings, sogliaPremioPunti: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Valore premio (€)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.sogliaPremioEuro}
                onChange={(e) => setSettings({ ...settings, sogliaPremioEuro: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="hint" style={{ marginTop: -8 }}>
            Es. 500 punti → 25 €: solo un promemoria per l&apos;operatore, lo sconto va applicato a
            mano — non è (ancora) automatico sul documento.
          </p>

          <div className="field">
            <label>Regolamento fedeltà (stampato sul modulo di adesione)</label>
            <textarea
              rows={6}
              value={settings.regolamentoFedelta}
              onChange={(e) => setSettings({ ...settings, regolamentoFedelta: e.target.value })}
            />
            <p className="hint">
              Fai rivedere questo testo da un consulente prima di usarlo con i clienti.
            </p>
          </div>

          <div className="field">
            <label>Informativa privacy fedeltà (stampata sul modulo di adesione)</label>
            <textarea
              rows={6}
              value={settings.informativaPrivacyFedelta}
              onChange={(e) => setSettings({ ...settings, informativaPrivacyFedelta: e.target.value })}
            />
            <p className="hint">
              Ispirato al modulo di adesione già in uso: fai rivedere questo testo da un
              legale prima di usarlo con i clienti — è diverso dall&apos;informativa privacy del
              noleggio (Azienda) perché parla di dati e finalità della carta fedeltà, non
              dell&apos;ausilio noleggiato.
            </p>
          </div>

          <div className="card-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva impostazioni"}
            </button>
            <a className="btn" href="/api/documento-fidelity" target="_blank" rel="noreferrer">
              Scarica modulo di adesione (PDF)
            </a>
          </div>
        </form>
      </div>

      <div style={{ display: tab === "backup" ? "block" : "none" }}>
        <BackupManager initialStatus={initialBackupStatus} />
      </div>

      <div style={{ display: tab === "utenti" ? "block" : "none" }}>
        <UsersManager
          initialUsers={initialUsers}
          currentUsername={currentUsername}
          initialTwoFactorUsernames={twoFactorUsernames}
        />
      </div>

      <div style={{ display: tab === "sicurezza" ? "block" : "none" }}>
        <TwoFactorSettings initialEnabled={currentUserTwoFactorEnabled} />
      </div>

      <Toast message={toast} />
    </div>
  );
}
