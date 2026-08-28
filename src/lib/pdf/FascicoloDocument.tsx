import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { FASCICOLO_STATO_LABEL } from "@/lib/fascicoli-types";
import {
  CONDIZIONI_GENERALI_FORNITURA,
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
  copiaBadge: {
    alignSelf: "flex-start",
    fontSize: 7.5,
    fontWeight: 700,
    color: ACCENT,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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
        Fascicolo {fascicolo.numero} — {cliente.nome}
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

  const conformitaBlock = (etichetta: string) => (
    <View break>
      <Text style={styles.copiaBadge}>{etichetta}</Text>
      <Text style={styles.sectionLabel}>Dichiarazione di conformità</Text>
      <Text style={styles.para}>{DICHIARAZIONE_CONFORMITA_TESTO}</Text>
      <View style={[styles.table, { marginTop: 8 }]}>
        <Field label="Nome dispositivo" value={fascicolo.tipoDispositivo} />
        <Field label="Codice" value={c.produzione.codice || "—"} />
        <Field label="Matricola" value={c.produzione.matricola || "—"} />
        <FieldLast label="Commessa" value={fascicolo.commessa || fascicolo.numero} />
      </View>
      <View style={styles.signatureRow}>
        <View style={styles.signatureBlock}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Firma della direzione</Text>
        </View>
        <View style={styles.signatureBlock}>
          <Text style={[styles.metaValue, { textAlign: "center" }]}>Scandicci, {fmtDate(fascicolo.ultimaModifica)}</Text>
        </View>
      </View>
    </View>
  );

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

        {/* ANAGRAFICA — dati recuperati dalla scheda cliente, mai ridigitati */}
        <Text style={styles.sectionLabel}>Dati anagrafici</Text>
        <View style={styles.table}>
          <Field label="Nome e cognome" value={nomeCompleto} />
          <Field label="Codice fiscale" value={cliente.codiceFiscale || "—"} />
          <Field label="Residente in" value={indirizzoCompleto || "—"} />
          <Field label="Nato/a il" value={fmtDate(cliente.dataNascita)} />
          <FieldLast label="Recapiti" value={telefono || "—"} />
        </View>

        {/* PRIVACY E CONSENSI */}
        <Text style={styles.sectionLabel}>Privacy e consensi</Text>
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

        {/* ANAMNESI */}
        <View break>
          <Text style={styles.sectionLabel}>Anamnesi</Text>
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
        </View>

        {/* ESAME DEL PIEDE */}
        <Text style={styles.sectionLabel}>Esame del piede</Text>
        {c.esamePiede.motivoVisita ? <Text style={styles.para}>Motivo della visita: {c.esamePiede.motivoVisita}</Text> : null}
        <View style={styles.twoCol}>
          {(["sinistro", "destro"] as const).map((lato) => {
            const l = c.esamePiede[lato];
            const righe = [
              l.piedePiatto && `Piede piatto ${l.piedePiatto}`,
              l.piedeCavo && `Piede cavo ${l.piedeCavo}`,
              l.pronazione && `Pronazione ${l.pronazione}`,
              l.alluce && `Alluce ${l.alluce}`,
              l.ditaAGriffe.length > 0 && `Dita a griffe: ${l.ditaAGriffe.join(", ")}°`,
              (l.tallone.talalgie || l.tallone.spinaCalcaneare) &&
                `Tallone: ${[l.tallone.talalgie && "talalgie", l.tallone.spinaCalcaneare && "spina calcaneare"].filter(Boolean).join(", ")}`,
              l.ginocchio && `Ginocchio ${l.ginocchio}`,
              l.tibiaVara && "Tibia vara",
              l.sovraccaricoMetatarsali.length > 0 && `Sovraccarico metatarsale: ${l.sovraccaricoMetatarsali.join(", ")}°`,
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

        {/* PRESCRIZIONE */}
        <Text style={styles.sectionLabel}>Prescrizione</Text>
        <View style={styles.table}>
          <Field label="Materiale richiesto" value={`${c.prescrizione.quantita} — ${c.prescrizione.descrizioneMateriale}`} />
          <FieldLast label="Importo (IVA inclusa)" value={fmtEuro(c.prescrizione.importo)} />
        </View>
        <Check checked={c.prescrizione.richiestaMedica} label="Richiesta medica presentata" />
        <Check checked={c.prescrizione.documentazioneDiagnostica} label="Documentazione diagnostica presentata" />
        {c.prescrizione.praticaAsl ? (
          <Check checked label={`Pratica ASL/SSN — autorizzazione n. ${c.prescrizione.autorizzazioneAslNumero || "—"}`} />
        ) : null}
        {c.prescrizione.note ? <Text style={styles.para}>Note: {c.prescrizione.note}</Text> : null}

        {/* CONFORMITÀ — due copie identiche, come da fascicolo originale */}
        {conformitaBlock("Copia archivio interno")}
        {conformitaBlock("Copia cliente")}

        {/* CONSEGNA / ISTRUZIONI */}
        <View break>
          <Text style={styles.sectionLabel}>Consegna</Text>
          <View style={styles.table}>
            <Field label="Data 1° appuntamento" value={fmtDate(c.consegna.dataPrimoAppuntamento)} />
            <Field
              label="Prova adattamento e consegna"
              value={`${fmtDate(c.consegna.dataConsegnaPrevista)}${c.consegna.oraConsegna ? ` alle ${c.consegna.oraConsegna}` : ""}${c.consegna.luogoConsegna ? ` — ${c.consegna.luogoConsegna}` : ""}`}
            />
            <Field label="Data consegna effettiva" value={fmtDate(c.consegna.dataConsegnaEffettiva)} />
            <FieldLast label="Controllo follow-up" value={fmtDate(c.consegna.dataFollowUp)} />
          </View>

          {fascicolo.contenuto.prescrizione.praticaAsl ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.legalTitle}>Comunicazione avvenuta consegna</Text>
              <Text style={styles.para}>
                Spett.le {c.consegna.comunicazioneAslDestinatario || "___________________"}, con la presente
                comunichiamo che in data odierna abbiamo consegnato a {nomeCompleto} il materiale da Voi
                autorizzato con pratica n. {c.consegna.comunicazioneAslPraticaNumero || c.prescrizione.autorizzazioneAslNumero || "—"}.
              </Text>
              <View style={styles.signatureRow}>
                <View style={styles.signatureBlock}>
                  <View style={styles.signatureLine} />
                  <Text style={styles.signatureLabel}>Firma per ricevuta</Text>
                </View>
              </View>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Note informative e istruzioni per l&apos;uso</Text>
          <Text style={styles.legalTitle}>1. Descrizione</Text>
          <Text style={styles.para}>{NOTE_INFORMATIVE_USO.descrizione}</Text>
          <Text style={styles.legalTitle}>2. Indicazioni d&apos;uso</Text>
          <Text style={styles.para}>{NOTE_INFORMATIVE_USO.indicazioniUso}</Text>
          <Text style={styles.legalTitle}>3. Come si usano</Text>
          <Text style={styles.para}>{NOTE_INFORMATIVE_USO.comeSiUsano}</Text>
          <Text style={styles.legalTitle}>4. Controindicazioni ed effetti collaterali</Text>
          <Text style={styles.para}>{NOTE_INFORMATIVE_USO.controindicazioni}</Text>
          <Text style={styles.legalTitle}>5. Manutenzione e conservazione</Text>
          <Text style={styles.para}>{NOTE_INFORMATIVE_USO.manutenzione}</Text>
          <Text style={styles.legalTitle}>6. Garanzia</Text>
          <Text style={styles.para}>{NOTE_INFORMATIVE_USO.garanzia}</Text>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Condizioni generali di fornitura</Text>
        <Text style={[styles.para, { fontSize: 7 }]}>{CONDIZIONI_GENERALI_FORNITURA}</Text>
      </Page>
    </Document>
  );
}
