import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { ALLEGATO_A_FASI } from "@/lib/fascicoli-testi";

const INK = "#17301b";
const INK_SOFT = "#5c6b5e";
const ACCENT = "#175c22";
const LINE = "#e1e7df";

export interface ProcessoProduttivoDocumentProps {
  settings: CompanySettings;
  fascicolo: FascicoloRecord;
}

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 9, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 140, maxHeight: 54, objectFit: "contain" },
  companyName: { fontSize: 13, fontWeight: 700, color: INK },
  title: { fontSize: 15, fontWeight: 700, color: INK, textTransform: "uppercase", marginTop: 18 },
  sub: { fontSize: 9, color: INK_SOFT, marginTop: 2, lineHeight: 1.4 },
  accentBar: { height: 2.5, backgroundColor: ACCENT, borderRadius: 2, marginTop: 8, marginBottom: 14 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  headRow: { flexDirection: "row", backgroundColor: "#f2f5f0", borderBottomWidth: 1, borderBottomColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  rowLast: { flexDirection: "row" },
  headText: { fontSize: 8, fontWeight: 700, color: INK_SOFT, textTransform: "uppercase", padding: 5 },
  cellFase: { width: "24%", padding: 5, fontSize: 8, fontWeight: 700 },
  cellDescrizione: { width: "22%", padding: 5, fontSize: 8, borderLeftWidth: 1, borderLeftColor: LINE },
  cellDocumenti: { width: "42%", padding: 5, fontSize: 8, color: INK_SOFT, borderLeftWidth: 1, borderLeftColor: LINE },
  cellResp: { width: "12%", padding: 5, fontSize: 8, borderLeftWidth: 1, borderLeftColor: LINE },
});

/**
 * Allegato A — Flussogramma di progettazione, come documento a sé: stessa
 * procedura fissa (ISO 13485, 7.3.1-7.3.7) che può anche essere allegata
 * come ultima pagina del fascicolo cliente (vedi FascicoloDocument, flag
 * "includiAllegatoA") — qui invece stampabile da sola, senza dover aprire
 * un fascicolo specifico, per affiggerla come procedura interna.
 */
export function ProcessoProduttivoDocument({ settings, fascicolo }: ProcessoProduttivoDocumentProps) {
  const hasLogo = Boolean(settings.logoUrl);

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
        <Text style={styles.title}>Allegato A · Flussogramma di progettazione</Text>
        <Text style={styles.sub}>
          Piano di progetto — procedura standard per la progettazione dei dispositivi su misura (ISO 13485, punti
          7.3.1-7.3.7). Documento fisso: uguale per ogni commessa (rif. Scheda di produzione, commessa {fascicolo.commessa || fascicolo.numero}).
        </Text>
        <View style={styles.accentBar} />

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.headText, { width: "24%" }]}>Fase</Text>
            <Text style={[styles.headText, { width: "22%" }]}>Descrizione</Text>
            <Text style={[styles.headText, { width: "42%" }]}>Documenti</Text>
            <Text style={[styles.headText, { width: "12%" }]}>Resp.</Text>
          </View>
          {ALLEGATO_A_FASI.map((r, i) => (
            <View key={r.fase} style={i === ALLEGATO_A_FASI.length - 1 ? styles.rowLast : styles.row}>
              <Text style={styles.cellFase}>{r.fase}</Text>
              <Text style={styles.cellDescrizione}>{r.descrizione}</Text>
              <Text style={styles.cellDocumenti}>{r.documenti}</Text>
              <Text style={styles.cellResp}>{r.responsabile}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
