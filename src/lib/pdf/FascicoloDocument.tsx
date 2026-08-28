import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { FASCICOLO_STATO_LABEL } from "@/lib/fascicoli-types";
import {
  ALLEGATO_A_FASI,
  ATTESTAZIONE_FABBRICANTE,
  CONDIZIONI_GENERALI_FORNITURA,
  CONTROINDICAZIONI_FORNITORE,
  DICHIARAZIONE_CONFORMITA_TESTO,
  INFORMATIVA_PRIVACY_FASCICOLO,
  NOTE_INFORMATIVE_USO,
} from "@/lib/fascicoli-testi";

const INK = "#17301b";
const INK_SOFT = "#5c6b5e";
const ACCENT = "#175c22";
const LINE = "#e1e7df";

export interface FascicoloDocumentProps {
  settings: CompanySettings;
  cliente: ClientRecord;
  fascicolo: FascicoloRecord;
}

// NOTA: "lineHeight" va sempre sui singoli stili di testo, MAI su "page" —
// impostato sul contenitore pagina, in questa versione di
// @react-pdf/renderer rompe silenziosamente il posizionamento assoluto
// (il footer con position:"absolute" spariva del tutto, su ogni pagina,
// senza errori). Comportamento verificato isolatamente prima di questo
// fix: vedi git history di questo file per il caso minimo riprodotto.
const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 140, maxHeight: 54, objectFit: "contain" },
  companyName: { fontSize: 13, fontWeight: 700, color: INK },
  companyBlock: { alignItems: "flex-end", maxWidth: 260 },
  companyLine: { fontSize: 8, color: INK_SOFT, textAlign: "right" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 },
  title: { fontSize: 15, fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: 0.4 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { fontSize: 8, color: INK_SOFT, textAlign: "right" },
  metaValue: { fontSize: 9.5, fontWeight: 700, color: INK, textAlign: "right" },
  accentBar: { height: 2.5, backgroundColor: ACCENT, borderRadius: 2, marginTop: 8, marginBottom: 14 },
  sectionLabel: {
    fontSize: 8.5,
    fontWeight: 700,
    color: INK_SOFT,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
    marginTop: 12,
  },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  rowLast: { flexDirection: "row" },
  cellLabel: {
    width: "32%",
    padding: 6,
    fontSize: 8.5,
    color: INK_SOFT,
    borderRightWidth: 1,
    borderRightColor: LINE,
    backgroundColor: "#f2f5f0",
  },
  cellValue: { width: "68%", padding: 6, fontSize: 9, color: INK, fontWeight: 700, lineHeight: 1.3 },
  twoCol: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  para: { fontSize: 8, color: INK_SOFT, lineHeight: 1.45, marginBottom: 4, textAlign: "justify" },
  legalTitle: { fontSize: 9, fontWeight: 700, color: INK, marginBottom: 4, marginTop: 8 },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  checkBox: { width: 9, height: 9, borderWidth: 1, borderColor: INK, marginRight: 5 },
  checkBoxFilled: { width: 9, height: 9, backgroundColor: ACCENT, marginRight: 5 },
  checkLabel: { fontSize: 8.5, color: INK, lineHeight: 1.3 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 34, marginBottom: 6 },
  signatureBlock: { width: "45%" },
  signatureLine: { borderTopWidth: 1, borderTopColor: INK, marginBottom: 5, height: 30 },
  signatureImage: { height: 30, marginBottom: 5, objectFit: "contain" },
  signatureLabel: { fontSize: 8, color: INK_SOFT, textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: INK_SOFT,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 4,
  },
  allegatoHeadRow: { flexDirection: "row", backgroundColor: "#f2f5f0", borderBottomWidth: 1, borderBottomColor: LINE },
  allegatoHeadText: { fontSize: 7.5, fontWeight: 700, color: INK_SOFT, textTransform: "uppercase", padding: 5 },
  allegatoCellFase: { width: "24%", padding: 5, fontSize: 7.5, fontWeight: 700 },
  allegatoCellDescrizione: { width: "22%", padding: 5, fontSize: 7.5, borderLeftWidth: 1, borderLeftColor: LINE },
  allegatoCellDocumenti: { width: "42%", padding: 5, fontSize: 7.5, color: INK_SOFT, borderLeftWidth: 1, borderLeftColor: LINE },
  allegatoCellResp: { width: "12%", padding: 5, fontSize: 7.5, borderLeftWidth: 1, borderLeftColor: LINE },
});

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const datePart = iso.includes("T") ? iso.slice(0, 10) : iso;
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtEuro(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={checked ? styles.checkBoxFilled : styles.checkBox} />
      <Text style={styles.checkLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

function FieldLast({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowLast}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

// Due View "fixed" separate, entrambe dirette figlie di <Page>: annidare il
// footer (position: absolute, bottom) dentro un wrapper insieme all'header
// lo ancorava al fondo di QUEL wrapper invece che al fondo della pagina —
// finiva quindi incollato sotto l'header invece che in fondo al foglio.
function Header({ settings }: { settings: CompanySettings }) {
  const hasLogo = Boolean(settings.logoUrl);
  return (
    <View style={styles.headerRow} fixed>
      <View>
        {hasLogo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image style={styles.logo} src={settings.logoUrl} />
        ) : (
          <Text style={styles.companyName}>{settings.ragioneSociale || "Ragione sociale non impostata"}</Text>
        )}
      </View>
      <View style={styles.companyBlock}>
        {hasLogo && settings.ragioneSociale ? (
          <Text style={[styles.companyLine, { fontWeight: 700, color: INK }]}>{settings.ragioneSociale}</Text>
        ) : null}
        {settings.indirizzo ? <Text style={styles.companyLine}>{settings.indirizzo}</Text> : null}
        {settings.partitaIva ? <Text style={styles.companyLine}>P.IVA {settings.partitaIva}</Text> : null}
        {settings.telefono ? <Text style={styles.companyLine}>Tel. {settings.telefono}</Text> : null}
      </View>
    </View>
  );
}

function Footer({ fascicolo, cliente }: { fascicolo: FascicoloRecord; cliente: ClientRecord }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Commessa {fascicolo.commessa || fascicolo.numero} · {cliente.nome} · Rev. {fascicolo.versione}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Pag. ${pageNumber} di ${totalPages}`} />
    </View>
  );
}

export function FascicoloDocument({ settings, cliente, fascicolo }: FascicoloDocumentProps) {
  const c = fascicolo.contenuto;
  const nomeCompleto = [cliente.nomeProprio || cliente.nome, cliente.cognome].filter(Boolean).join(" ") || cliente.nome;
  const indirizzoCompleto = [cliente.indirizzo, [cliente.cap, cliente.localita, cliente.provincia].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const telefono = [cliente.telefono, cliente.cellulare].filter(Boolean).join(" · ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header settings={settings} />
        <Footer fascicolo={fascicolo} cliente={cliente} />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Fascicolo plantare</Text>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>N. Fascicolo</Text>
            <Text style={styles.metaValue}>{fascicolo.numero}</Text>
            <Text style={[styles.metaLine, { marginTop: 5 }]}>Stato</Text>
            <Text style={styles.metaValue}>{FASCICOLO_STATO_LABEL[fascicolo.stato]}</Text>
          </View>
        </View>
        <View style={styles.accentBar} />

        {/* 1 · ANAGRAFICA E COMMESSA — dati recuperati dalla scheda cliente, mai ridigitati */}
        <Text style={styles.sectionLabel}>1 · Dati cliente e commessa</Text>
        <View style={styles.table}>
          <Field label="Nome e cognome" value={nomeCompleto} />
          <Field label="Codice fiscale" value={cliente.codiceFiscale || "—"} />
          <Field label="Residente in" value={indirizzoCompleto || "—"} />
          <Field label="Nato/a il" value={fmtDate(cliente.dataNascita)} />
          <Field label="Recapiti" value={telefono || "—"} />
          <Field label="N. commessa" value={fascicolo.commessa || fascicolo.numero} />
          <FieldLast label="Data ordine" value={fmtDate(c.prescrizione.dataOrdine)} />
        </View>
        <View style={[styles.table, { marginTop: 8 }]}>
          <Field label="Materiale richiesto" value={`${c.prescrizione.quantita} — ${c.prescrizione.descrizioneMateriale}`} />
          <FieldLast label="Importo (IVA inclusa)" value={fmtEuro(c.prescrizione.importo)} />
        </View>
        <Check checked={c.prescrizione.dispositivoDetraibile} label="Dispositivo medico detraibile" />

        {/* 2 · ANAMNESI */}
        <Text style={styles.sectionLabel}>2 · Anamnesi e caratteristiche somatiche</Text>
        <View style={styles.table}>
          <Field label="Altezza / Peso" value={`${c.anamnesi.altezzaCm ?? "—"} cm · ${c.anamnesi.pesoKg ?? "—"} kg`} />
          <Field label="Patologia correlata al dispositivo" value={c.anamnesi.patologiaCorrelata || "—"} />
          <Field label="Altre patologie" value={c.anamnesi.altrePatologie || "—"} />
          <Field
            label="Allergie"
            value={c.anamnesi.nessunaAllergia ? "Dichiara di non averne" : c.anamnesi.allergie || "—"}
          />
          <FieldLast
            label="Capacità psicofisica"
            value={
              c.anamnesi.capacitaPsicofisica === "totale"
                ? "Totale"
                : c.anamnesi.capacitaPsicofisica === "parziale"
                  ? "Parziale"
                  : c.anamnesi.capacitaPsicofisica === "assistenza"
                    ? "Necessità di assistente"
                    : "—"
            }
          />
        </View>

        {/* 3 · DOCUMENTAZIONE MEDICA */}
        <Text style={styles.sectionLabel}>3 · Documentazione medica presentata</Text>
        <Check checked={c.prescrizione.richiestaMedica} label={`Richiesta medica${c.prescrizione.medicoPrescrittore ? ` — ${c.prescrizione.medicoPrescrittore}` : ""}`} />
        <Check checked={c.prescrizione.documentazioneDiagnostica} label="Documentazione diagnostica presentata" />
        {c.prescrizione.praticaAsl ? (
          <Check checked label={`Pratica ASL/SSN — autorizzazione n. ${c.prescrizione.autorizzazioneAslNumero || "—"}`} />
        ) : null}
        {c.prescrizione.note ? <Text style={styles.para}>Note: {c.prescrizione.note}</Text> : null}
        <Text style={[styles.legalTitle, { fontSize: 8, marginTop: 8, marginBottom: 2 }]}>
          Controindicazioni indicate dal fornitore
        </Text>
        {CONTROINDICAZIONI_FORNITORE.map((riga, i) => (
          <Text key={i} style={styles.para}>
            • {riga}
          </Text>
        ))}

        {/* 4 · ESAME DEL PIEDE */}
        <View break>
          <Text style={styles.sectionLabel}>4 · Scheda rilevazione obiettiva</Text>
          {c.esamePiede.motivoVisita ? <Text style={styles.para}>Motivo della visita: {c.esamePiede.motivoVisita}</Text> : null}
        <View style={styles.twoCol}>
          {(["sinistro", "destro"] as const).map((lato) => {
            const l = c.esamePiede[lato];
            const righe = [
              l.piedePiatto && `Piede piatto ${l.piedePiatto}`,
              l.piedeCavo && `Piede cavo ${l.piedeCavo}`,
              l.pronazione && `Pronazione ${l.pronazione}`,
              l.alluce && `Alluce ${l.alluce}`,
              l.ditaAGriffe.length > 0 && `Dita a griffe: ${l.ditaAGriffe.map((n) => `${n}°`).join(", ")}`,
              (l.tallone.talalgie || l.tallone.spinaCalcaneare) &&
                `Tallone: ${[l.tallone.talalgie && "talalgie", l.tallone.spinaCalcaneare && "spina calcaneare"].filter(Boolean).join(", ")}`,
              l.ginocchio && `Ginocchio ${l.ginocchio}`,
              l.tibiaVara && "Tibia vara",
              l.sovraccaricoMetatarsali.length > 0 &&
                `Sovraccarico metatarsale: ${l.sovraccaricoMetatarsali.map((n) => `${n}°`).join(", ")}`,
              (l.ulcerazioni.dorsali || l.ulcerazioni.plantari || l.ulcerazioni.calcaneari) &&
                `Ulcerazioni: ${[l.ulcerazioni.dorsali && "dorsali", l.ulcerazioni.plantari && "plantari", l.ulcerazioni.calcaneari && "calcaneari"].filter(Boolean).join(", ")}`,
              l.traumi && `Traumi: ${l.traumi}`,
            ].filter(Boolean) as string[];
            return (
              <View key={lato} style={styles.col}>
                <Text style={[styles.legalTitle, { textTransform: "uppercase" }]}>Piede {lato}</Text>
                {righe.length > 0 ? (
                  righe.map((r, i) => (
                    <Text key={i} style={styles.checkLabel}>
                      • {r}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.para}>Nessun rilievo segnalato.</Text>
                )}
              </View>
            );
          })}
          </View>
          <Text style={[styles.legalTitle, { marginTop: 6 }]}>Destinazione d&apos;uso e calzatura</Text>
          <Text style={styles.para}>
            {[
              c.esamePiede.destinazioneUso.attivitaLavorativa && `Lavorativa: ${c.esamePiede.destinazioneUso.attivitaLavorativa}`,
              c.esamePiede.destinazioneUso.attivitaSportiva && `Sportiva: ${c.esamePiede.destinazioneUso.attivitaSportiva}`,
              c.esamePiede.destinazioneUso.attivitaTempoLibero && `Tempo libero: ${c.esamePiede.destinazioneUso.attivitaTempoLibero}`,
              c.esamePiede.calzaturaCollegamento.ciabattaPredisposta && "ciabatta predisposta",
              c.esamePiede.calzaturaCollegamento.scarpaPredisposta && "scarpa predisposta",
              c.esamePiede.calzaturaCollegamento.antinfortunistica && "antinfortunistica",
              c.esamePiede.calzaturaCollegamento.scarpaGinnastica && "scarpa da ginnastica",
            ]
              .filter(Boolean)
              .join(" · ") || "Non specificata"}
          </Text>
        </View>

        {/* 5 · PIANO APPUNTAMENTI */}
        <Text style={styles.sectionLabel}>5 · Piano appuntamenti</Text>
        <View style={styles.table}>
          <Field label="1° appuntamento (baropodometria+calco)" value={fmtDate(c.consegna.dataPrimoAppuntamento)} />
          <Field
            label="Prova/consegna prevista"
            value={`${fmtDate(c.consegna.dataConsegnaPrevista)}${c.consegna.oraConsegna ? ` alle ${c.consegna.oraConsegna}` : ""}`}
          />
          <Field label="Consegna effettiva" value={fmtDate(c.consegna.dataConsegnaEffettiva)} />
          <Field label="Follow-up a 2 mesi" value={fmtDate(c.consegna.dataFollowUp)} />
          <FieldLast label="Luogo" value={c.consegna.luogoConsegna || "—"} />
        </View>

        {/* 6 · DICHIARAZIONE DI CONFORMITÀ — una sola copia, come da modello definitivo */}
        <View break>
          <Text style={styles.sectionLabel}>6 · Dichiarazione di conformità — Regolamento (UE) 2017/745</Text>
          <Text style={styles.para}>{DICHIARAZIONE_CONFORMITA_TESTO}</Text>
          <Text style={[styles.para, { marginTop: 6 }]}>
            {ATTESTAZIONE_FABBRICANTE.tecnico}
            {"\n"}
            {ATTESTAZIONE_FABBRICANTE.fabbricante}
          </Text>
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Firma della direzione</Text>
            </View>
            <View style={styles.signatureBlock}>
              <Text style={[styles.metaValue, { textAlign: "center" }]}>Scandicci, {fmtDate(c.prescrizione.dataOrdine)}</Text>
            </View>
          </View>

          {/* 7 · SCHEDA DI PRODUZIONE */}
          <Text style={styles.sectionLabel}>7 · Scheda di produzione — Commessa</Text>
          <View style={styles.table}>
            <Field label="Nome dispositivo" value={fascicolo.tipoDispositivo} />
            <Field label="Codice" value={c.produzione.codice || "—"} />
            <Field label="Matricola" value={c.produzione.matricola || "—"} />
            <Field label="Prescritto dal dottore" value={c.prescrizione.medicoPrescrittore || "—"} />
            <Field label="Data prescrizione" value={fmtDate(c.prescrizione.dataPrescrizione)} />
            <Field label="Responsabile di progetto" value={c.produzione.responsabileProgetto || "—"} />
            <Field label="Operatore" value={fascicolo.operatore || "—"} />
            <Field label="Data inizio lavori" value={fmtDate(c.produzione.dataInizioLavori)} />
            <FieldLast label="Data pronta consegna" value={fmtDate(c.produzione.dataProntaConsegna)} />
          </View>
          <View style={[styles.table, { marginTop: 8 }]}>
            <View style={styles.allegatoHeadRow}>
              <Text style={[styles.allegatoHeadText, { width: "6%" }]}>N.</Text>
              <Text style={[styles.allegatoHeadText, { width: "34%" }]}>Fase</Text>
              <Text style={[styles.allegatoHeadText, { width: "34%" }]}>Controlli</Text>
              <Text style={[styles.allegatoHeadText, { width: "26%" }]}>Data / Operatore</Text>
            </View>
            {c.produzione.fasi.map((f, i) => (
              <View key={f.numero} style={i === c.produzione.fasi.length - 1 ? styles.rowLast : styles.row}>
                <Text style={{ width: "6%", padding: 5, fontSize: 7.5 }}>{f.numero}</Text>
                <Text style={{ width: "34%", padding: 5, fontSize: 7.5 }}>
                  {f.nome}
                  {f.note ? ` — ${f.note}` : ""}
                </Text>
                <Text style={{ width: "34%", padding: 5, fontSize: 7.5, color: INK_SOFT }}>{f.controlli}</Text>
                <Text style={{ width: "26%", padding: 5, fontSize: 7.5 }}>
                  {f.completata ? "✓ " : "— "}
                  {fmtDate(f.data)}
                  {f.operatore ? ` · ${f.operatore}` : ""}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.para, { marginTop: 6 }]}>
            Controllo finale:{" "}
            {c.produzione.controlloFinale === "conforme"
              ? "Conforme"
              : c.produzione.controlloFinale === "non_conforme"
                ? `Non conforme (N.C. n. ${c.produzione.nonConformitaNumero || "—"})`
                : "Non ancora effettuato"}
            {c.produzione.noteRiesame ? ` — Note per riesame: ${c.produzione.noteRiesame}` : ""}
          </Text>
        </View>

        {/* 8 · COMUNICAZIONE AVVENUTA CONSEGNA — solo per pratiche ASL/SSN */}
        {c.prescrizione.praticaAsl ? (
          <View break>
            <Text style={styles.sectionLabel}>8 · Comunicazione di avvenuta consegna</Text>
            <Text style={styles.para}>
              Con la presente si comunica che in data odierna è stato consegnato alla/al Sig.ra/Sig.{" "}
              {nomeCompleto}
              {c.consegna.comunicazioneAslDestinatario ? `, per conto di ${c.consegna.comunicazioneAslDestinatario},` : ""} il
              materiale autorizzato con pratica n.{" "}
              {c.consegna.comunicazioneAslPraticaNumero || c.prescrizione.autorizzazioneAslNumero || "—"}.
            </Text>
            <View style={styles.signatureRow}>
              <View style={styles.signatureBlock}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Firma per ricevuta</Text>
              </View>
              <View style={styles.signatureBlock}>
                <Text style={[styles.metaValue, { textAlign: "center" }]}>Data {fmtDate(c.consegna.dataConsegnaEffettiva)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 9 · CONDIZIONI GENERALI DI FORNITURA */}
        <View break>
          <Text style={styles.sectionLabel}>9 · Condizioni generali di fornitura</Text>
          <Text style={styles.para}>{CONDIZIONI_GENERALI_FORNITURA}</Text>
        </View>

        {/* 10 · PRIVACY E CONSENSI */}
        <View break>
          <Text style={styles.sectionLabel}>10 · Informativa privacy e consenso al trattamento dati</Text>
          <Text style={styles.para}>{INFORMATIVA_PRIVACY_FASCICOLO}</Text>
          <Check checked={c.consensi.consensoTrattamentoDati} label="Acconsento al trattamento dei miei dati personali e particolari alle condizioni previste nell'informativa" />
          <Check checked={c.consensi.presaVisioneInformativa} label="Presa visione dell'informativa privacy" />
          <Check checked={c.consensi.consensoDocumentazione} label="Consenso alla documentazione tecnica del dispositivo" />
          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              {c.consensi.firmaClienteUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={styles.signatureImage} src={c.consensi.firmaClienteUrl} />
              ) : (
                <View style={styles.signatureLine} />
              )}
              <Text style={styles.signatureLabel}>Firma del cliente</Text>
            </View>
            <View style={styles.signatureBlock}>
              <Text style={[styles.metaValue, { textAlign: "center" }]}>Data {fmtDate(c.consensi.dataConsenso)}</Text>
            </View>
          </View>
        </View>

        {/* 11 · NOTE INFORMATIVE / GARANZIA */}
        <Text style={styles.sectionLabel}>11 · Note informative, istruzioni per l&apos;uso e garanzia</Text>
        <Text style={styles.legalTitle}>1 — Descrizione</Text>
        <Text style={styles.para}>{NOTE_INFORMATIVE_USO.descrizione}</Text>
        <Text style={styles.legalTitle}>2 — Indicazioni d&apos;uso</Text>
        <Text style={styles.para}>{NOTE_INFORMATIVE_USO.indicazioniUso}</Text>
        <Text style={styles.legalTitle}>3 — Come si usano</Text>
        <Text style={styles.para}>{NOTE_INFORMATIVE_USO.comeSiUsano}</Text>
        <Text style={styles.legalTitle}>4 — Controindicazioni</Text>
        <Text style={styles.para}>{NOTE_INFORMATIVE_USO.controindicazioni}</Text>
        <Text style={styles.legalTitle}>5 — Manutenzione e conservazione</Text>
        <Text style={styles.para}>{NOTE_INFORMATIVE_USO.manutenzione}</Text>
        <Text style={styles.legalTitle}>6 — Garanzia</Text>
        <Text style={styles.para}>{NOTE_INFORMATIVE_USO.garanzia}</Text>

        {/* ALLEGATO A — procedura aziendale fissa: solo se richiesto esplicitamente */}
        {c.produzione.includiAllegatoA ? (
          <View break>
            <Text style={styles.sectionLabel}>Allegato A · Flussogramma di progettazione</Text>
            <Text style={styles.para}>
              Piano di progetto — procedura standard per la progettazione dei dispositivi su misura (ISO 13485, punti
              7.3.1-7.3.7). Documento fisso: uguale per ogni commessa.
            </Text>
            <View style={[styles.table, { marginTop: 6 }]}>
              <View style={styles.allegatoHeadRow}>
                <Text style={[styles.allegatoHeadText, styles.allegatoCellFase]}>Fase</Text>
                <Text style={[styles.allegatoHeadText, styles.allegatoCellDescrizione]}>Descrizione</Text>
                <Text style={[styles.allegatoHeadText, styles.allegatoCellDocumenti]}>Documenti</Text>
                <Text style={[styles.allegatoHeadText, styles.allegatoCellResp]}>Resp.</Text>
              </View>
              {ALLEGATO_A_FASI.map((r, i) => (
                <View key={r.fase} style={i === ALLEGATO_A_FASI.length - 1 ? styles.rowLast : styles.row}>
                  <Text style={styles.allegatoCellFase}>{r.fase}</Text>
                  <Text style={styles.allegatoCellDescrizione}>{r.descrizione}</Text>
                  <Text style={styles.allegatoCellDocumenti}>{r.documenti}</Text>
                  <Text style={styles.allegatoCellResp}>{r.responsabile}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
