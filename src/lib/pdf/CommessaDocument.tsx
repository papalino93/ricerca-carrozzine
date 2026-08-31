import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { CommessaRecord } from "@/lib/commesse-types";
import { COMMESSA_STATUS_LABEL } from "@/lib/commesse-types";

const INK = "#17301b";
const INK_SOFT = "#5c6b5e";
const ACCENT = "#175c22";
const LINE = "#e1e7df";

export interface CommessaDocumentProps {
  settings: CompanySettings;
  commessa: CommessaRecord;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 150, maxHeight: 60, objectFit: "contain" },
  companyName: { fontSize: 14, fontWeight: 700, color: INK },
  companyBlock: { alignItems: "flex-end", maxWidth: 260 },
  companyLine: { fontSize: 9, color: INK_SOFT, textAlign: "right" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 26 },
  title: { fontSize: 17, fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: 0.5, maxWidth: 320 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { fontSize: 9, color: INK_SOFT, textAlign: "right" },
  metaValue: { fontSize: 10, fontWeight: 700, color: INK, textAlign: "right" },
  accentBar: { height: 3, backgroundColor: ACCENT, borderRadius: 2, marginTop: 10, marginBottom: 20 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: INK_SOFT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  rowLast: { flexDirection: "row" },
  cellLabel: { width: "34%", padding: 8, fontSize: 9, color: INK_SOFT, borderRightWidth: 1, borderRightColor: LINE, backgroundColor: "#f2f5f0" },
  cellValue: { width: "66%", padding: 8, fontSize: 10, color: INK, fontWeight: 700 },
  noteBox: { marginTop: 20, borderWidth: 1, borderColor: ACCENT, borderRadius: 4, padding: 10 },
  noteLabel: { fontSize: 9, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  noteText: { fontSize: 10, color: INK, lineHeight: 1.4 },
  conditions: { marginTop: 28, fontSize: 7.5, color: INK_SOFT, lineHeight: 1.4 },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = (iso.includes("T") ? iso.slice(0, 10) : iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtEuro(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function CommessaDocument({ settings, commessa: c }: CommessaDocumentProps) {
  const hasLogo = Boolean(settings.logoUrl);
  const extra = [
    c.richiestaMedica && "Prescrizione medica",
    c.documentazione && "Documentazione",
    c.documentazioneDiagnostica && "Referto diagnostico",
    c.altro && "Altro",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
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

        <View style={styles.titleRow}>
          <Text style={styles.title}>Scheda commessa</Text>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>N. Scheda</Text>
            <Text style={styles.metaValue}>{c.numero}</Text>
            <Text style={[styles.metaLine, { marginTop: 6 }]}>Stato</Text>
            <Text style={styles.metaValue}>{COMMESSA_STATUS_LABEL[c.stato]}</Text>
          </View>
        </View>
        <View style={styles.accentBar} />

        <Text style={styles.sectionLabel}>Cliente</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Nome e cognome</Text>
            <Text style={styles.cellValue}>{c.cliente || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Indirizzo</Text>
            <Text style={styles.cellValue}>{c.indirizzo || "—"}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.cellLabel}>Telefono / cellulare</Text>
            <Text style={styles.cellValue}>{[c.telefono, c.cellulare].filter(Boolean).join(" · ") || "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Lavoro</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Tipo</Text>
            <Text style={styles.cellValue}>
              {[c.vendita && "Vendita", c.riparazione && "Riparazione"].filter(Boolean).join(" + ") || "—"}
            </Text>
          </View>
          {c.operatore ? (
            <View style={styles.row}>
              <Text style={styles.cellLabel}>Operatore</Text>
              <Text style={styles.cellValue}>{c.operatore}</Text>
            </View>
          ) : null}
          {extra ? (
            <View style={styles.row}>
              <Text style={styles.cellLabel}>Serve anche</Text>
              <Text style={styles.cellValue}>{extra}</Text>
            </View>
          ) : null}
          <View style={c.consegnaPrevista ? styles.row : styles.rowLast}>
            <Text style={styles.cellLabel}>Data ordine</Text>
            <Text style={styles.cellValue}>{fmtDate(c.dataOrdine)}</Text>
          </View>
          {/* Facoltativa: solo una data sul documento stampato, "Pronto il" e
              "Ritirato il" sono avanzamento interno del lavoro, non qualcosa
              che il cliente deve vedere sulla sua copia. */}
          {c.consegnaPrevista ? (
            <View style={styles.rowLast}>
              <Text style={styles.cellLabel}>Consegna prevista</Text>
              <Text style={styles.cellValue}>{fmtDate(c.consegnaPrevista)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Pagamento</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Acconto</Text>
            <Text style={styles.cellValue}>{fmtEuro(c.acconto)}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.cellLabel}>Saldo da pagare</Text>
            <Text style={styles.cellValue}>{fmtEuro(c.saldo)}</Text>
          </View>
        </View>

        {c.richiesteParticolari ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Richieste del cliente</Text>
            <Text style={styles.noteText}>{c.richiesteParticolari}</Text>
          </View>
        ) : null}

        {c.noteChiusura ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Note di chiusura</Text>
            <Text style={styles.noteText}>{c.noteChiusura}</Text>
          </View>
        ) : null}

        <Text style={styles.conditions}>{settings.informativaPrivacy}</Text>
      </Page>
    </Document>
  );
}
