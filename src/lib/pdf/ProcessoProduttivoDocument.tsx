import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { FascicoloRecord } from "@/lib/fascicoli-types";

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
  sub: { fontSize: 9, color: INK_SOFT, marginTop: 2 },
  accentBar: { height: 2.5, backgroundColor: ACCENT, borderRadius: 2, marginTop: 8, marginBottom: 14 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  headRow: { flexDirection: "row", backgroundColor: "#f2f5f0", borderBottomWidth: 1, borderBottomColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  rowLast: { flexDirection: "row" },
  cN: { width: "6%", padding: 5, fontSize: 8 },
  cFase: { width: "34%", padding: 5, fontSize: 8, borderLeftWidth: 1, borderLeftColor: LINE },
  cControlli: { width: "34%", padding: 5, fontSize: 8, borderLeftWidth: 1, borderLeftColor: LINE, color: INK_SOFT },
  cEsito: { width: "26%", padding: 5, fontSize: 8, borderLeftWidth: 1, borderLeftColor: LINE },
  headText: { fontSize: 8, fontWeight: 700, color: INK_SOFT, textTransform: "uppercase" },
  note: { fontSize: 8, color: INK_SOFT, marginTop: 10, lineHeight: 1.4 },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Documento interno (non per il cliente): il flussogramma di
 * progettazione/produzione è lo stesso identico processo qualità per ogni
 * commessa, quindi non entra nel fascicolo del cliente (vedi analisi del
 * documento originale) — resta però disponibile qui, stampabile su
 * richiesta, con i dati di avanzamento della singola commessa.
 */
export function ProcessoProduttivoDocument({ settings, fascicolo }: ProcessoProduttivoDocumentProps) {
  const hasLogo = Boolean(settings.logoUrl);
  const fasi = fascicolo.contenuto.produzione.fasi;

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
        <Text style={styles.title}>Processo produttivo — Scheda plantari</Text>
        <Text style={styles.sub}>
          Commessa {fascicolo.commessa || fascicolo.numero} · Documento interno di controllo qualità, non destinato al cliente
        </Text>
        <View style={styles.accentBar} />

        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.cN, styles.headText]}>N.</Text>
            <Text style={[styles.cFase, styles.headText]}>Fase</Text>
            <Text style={[styles.cControlli, styles.headText]}>Controlli</Text>
            <Text style={[styles.cEsito, styles.headText]}>Data / Operatore</Text>
          </View>
          {fasi.map((f, i) => (
            <View key={f.numero} style={i === fasi.length - 1 ? styles.rowLast : styles.row}>
              <Text style={styles.cN}>{f.numero}</Text>
              <Text style={styles.cFase}>
                {f.nome}
                {f.note ? ` — ${f.note}` : ""}
              </Text>
              <Text style={styles.cControlli}>{f.controlli}</Text>
              <Text style={styles.cEsito}>
                {f.completata ? "✓ " : "— "}
                {fmtDate(f.data)}
                {f.operatore ? ` · ${f.operatore}` : ""}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Controllo finale:{" "}
          {fascicolo.contenuto.produzione.controlloFinale === "conforme"
            ? "Conforme"
            : fascicolo.contenuto.produzione.controlloFinale === "non_conforme"
              ? `Non conforme (N. ${fascicolo.contenuto.produzione.nonConformitaNumero || "—"})`
              : "Non ancora effettuato"}
        </Text>
        {fascicolo.contenuto.produzione.noteRiesame ? (
          <Text style={styles.note}>Note per riesame: {fascicolo.contenuto.produzione.noteRiesame}</Text>
        ) : null}
        <Text style={styles.note}>
          Riferimento norma qualità: fasi 7.3.1-7.3.7 del piano di progetto (pianificazione, elementi in ingresso/uscita,
          riesame, verifica e validazione P&S) — processo aziendale unico, non variabile da commessa a commessa.
        </Text>
      </Page>
    </Document>
  );
}
