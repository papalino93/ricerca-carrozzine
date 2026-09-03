import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";

const INK = "#17301b";
const INK_SOFT = "#5c6b5e";
const ACCENT = "#175c22";
const LINE = "#e1e7df";

export interface VisiteControlloDocumentProps {
  settings: CompanySettings;
  cliente: ClientRecord;
  fascicolo: FascicoloRecord;
}

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 140, maxHeight: 54, objectFit: "contain" },
  companyName: { fontSize: 13, fontWeight: 700, color: INK },
  title: { fontSize: 15, fontWeight: 700, color: INK, textTransform: "uppercase", marginTop: 18 },
  sub: { fontSize: 9, color: INK_SOFT, marginTop: 2, lineHeight: 1.4 },
  accentBar: { height: 2.5, backgroundColor: ACCENT, borderRadius: 2, marginTop: 8, marginBottom: 14 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4, marginBottom: 16 },
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
  cellValue: { width: "68%", padding: 6, fontSize: 9, color: INK, fontWeight: 700 },
  headRow: { flexDirection: "row", backgroundColor: "#f2f5f0", borderBottomWidth: 1, borderBottomColor: LINE },
  headText: { fontSize: 8, fontWeight: 700, color: INK_SOFT, textTransform: "uppercase", padding: 6 },
  visitaRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  visitaRowLast: { flexDirection: "row" },
  cellNumero: { width: "12%", padding: 6, fontSize: 9, fontWeight: 700 },
  cellData: { width: "18%", padding: 6, fontSize: 9, borderLeftWidth: 1, borderLeftColor: LINE },
  cellNota: { width: "70%", padding: 6, fontSize: 9, color: INK_SOFT, lineHeight: 1.35, borderLeftWidth: 1, borderLeftColor: LINE },
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

const ORDINALI = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª"];
function ordinale(n: number): string {
  return ORDINALI[n - 1] ?? `${n}ª`;
}

/**
 * Riepilogo delle visite di controllo successive alla consegna: stampabile
 * a sé (una copia per il cliente, una per il fascicolo interno) senza
 * dover ristampare l'intero fascicolo ogni volta che si aggiunge una
 * visita.
 */
export function VisiteControlloDocument({ settings, cliente, fascicolo }: VisiteControlloDocumentProps) {
  const hasLogo = Boolean(settings.logoUrl);
  const visite = [...fascicolo.contenuto.consegna.visiteControllo].sort((a, b) => a.numero - b.numero);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {hasLogo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={settings.logoUrl} />
          ) : (
            <Text style={styles.companyName}>{settings.ragioneSociale || "Ragione sociale non impostata"}</Text>
          )}
        </View>
        <Text style={styles.title}>Visite di controllo</Text>
        <Text style={styles.sub}>Riepilogo delle visite successive alla consegna del dispositivo su misura.</Text>
        <View style={styles.accentBar} />

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Cliente</Text>
            <Text style={styles.cellValue}>{cliente.nome}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Codice fiscale</Text>
            <Text style={styles.cellValue}>{cliente.codiceFiscale || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Fascicolo</Text>
            <Text style={styles.cellValue}>{fascicolo.numero}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.cellLabel}>Data consegna</Text>
            <Text style={styles.cellValue}>{fmtDate(fascicolo.contenuto.consegna.dataConsegnaEffettiva)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.headText, { width: "12%" }]}>Visita</Text>
            <Text style={[styles.headText, { width: "18%" }]}>Data</Text>
            <Text style={[styles.headText, { width: "70%" }]}>Nota del tecnico</Text>
          </View>
          {visite.length === 0 ? (
            <View style={styles.visitaRowLast}>
              <Text style={{ padding: 6, fontSize: 9, color: INK_SOFT, width: "100%" }}>
                Nessuna visita di controllo registrata.
              </Text>
            </View>
          ) : (
            visite.map((v, i) => (
              <View key={v.numero} style={i === visite.length - 1 ? styles.visitaRowLast : styles.visitaRow}>
                <Text style={styles.cellNumero}>{ordinale(v.numero)}</Text>
                <Text style={styles.cellData}>{fmtDate(v.data)}</Text>
                <Text style={styles.cellNota}>{v.nota || "—"}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>{settings.ragioneSociale || ""}</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
