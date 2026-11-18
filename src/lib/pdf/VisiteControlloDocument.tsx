import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { DocFooter, DocHeader, Field, FieldLast, fmtDate, INK_SOFT, LINE, sharedStyles } from "./shared";

export interface VisiteControlloDocumentProps {
  settings: CompanySettings;
  cliente: ClientRecord;
  fascicolo: FascicoloRecord;
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", backgroundColor: "#f2f5f0", borderBottomWidth: 1, borderBottomColor: LINE },
  headText: { fontSize: 8, fontWeight: 700, color: INK_SOFT, textTransform: "uppercase", padding: 6 },
  visitaRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  visitaRowLast: { flexDirection: "row" },
  cellNumero: { width: "12%", padding: 6, fontSize: 9, fontWeight: 700 },
  cellData: { width: "18%", padding: 6, fontSize: 9, borderLeftWidth: 1, borderLeftColor: LINE },
  cellNota: { width: "70%", padding: 6, fontSize: 9, color: INK_SOFT, lineHeight: 1.35, borderLeftWidth: 1, borderLeftColor: LINE },
});

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
  const visite = [...fascicolo.contenuto.consegna.visiteControllo].sort((a, b) => a.numero - b.numero);

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <DocHeader settings={settings} />
        <DocFooter left={`Fascicolo ${fascicolo.numero} · ${cliente.nome}`} />

        <Text style={sharedStyles.title}>Visite di controllo</Text>
        <Text style={sharedStyles.sub}>Riepilogo delle visite successive alla consegna del dispositivo su misura.</Text>
        <View style={sharedStyles.accentBar} />

        <View style={sharedStyles.table}>
          <Field label="Cliente" value={cliente.nome} />
          <Field label="Codice fiscale" value={cliente.codiceFiscale || "—"} />
          <Field label="Fascicolo" value={fascicolo.numero} />
          <FieldLast label="Data consegna" value={fmtDate(fascicolo.contenuto.consegna.dataConsegnaEffettiva)} />
        </View>

        <View style={[sharedStyles.table, { marginTop: 10 }]}>
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
      </Page>
    </Document>
  );
}
