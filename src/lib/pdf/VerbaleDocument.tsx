import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";

const INK = "#17301b";
const INK_SOFT = "#5c6b5e";
const ACCENT = "#175c22";
const LINE = "#e1e7df";

export type DocumentoTipo = "consegna" | "restituzione";

/** Tariffa applicata al noleggio, calcolata lato client (DocumentPanel):
 * il PDF si limita a stamparla, se l'operatore ha scelto di includerla. */
export interface TariffaDocumento {
  importo: number;
  unita: "giorno" | "settimana";
  /** Assente quando manca una data di riferimento per calcolarlo (es.
   * consegna senza rientro previsto): resta solo la tariffa giornaliera,
   * nessuna riga "Totale" sul documento. */
  totale?: number;
  /** true sul verbale di consegna (si stima fino al rientro previsto),
   * false su quello di restituzione (giorni effettivi già trascorsi). */
  stimato: boolean;
}

export interface VerbaleDocumentProps {
  tipo: DocumentoTipo;
  numeroContratto: string;
  data: string;
  settings: CompanySettings;
  dispositivo: {
    codice: string;
    categoria: string;
    marca: string;
    modello: string;
    larghezza: number | null;
  };
  cliente: {
    nome: string;
    telefono: string;
  };
  note: string;
  /** Data di rientro prevista del noleggio, ISO yyyy-mm-dd, facoltativa: se
   * assente la riga non compare affatto (nessun campo vuoto sul verbale). */
  alPrevisto?: string | null;
  /** Assente per scelta esplicita dell'operatore (vedi DocumentPanel): niente
   * riquadro tariffa/totale sul documento se non è stato spuntato. */
  tariffa?: TariffaDocumento | null;
  /** Firme come PNG data URI (vedi SignaturePad): assenti finché il Drive di
   * archiviazione non è configurato, o se non si è firmato su schermo — in
   * quel caso restano le righe vuote da firmare a penna, come sempre. */
  firmaClienteUrl?: string | null;
  firmaOperatoreUrl?: string | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: {
    maxWidth: 150,
    maxHeight: 60,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    color: INK,
  },
  companyBlock: {
    alignItems: "flex-end",
    maxWidth: 260,
  },
  companyLine: {
    fontSize: 9,
    color: INK_SOFT,
    textAlign: "right",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 26,
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: INK,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    maxWidth: 320,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  metaLine: {
    fontSize: 9,
    color: INK_SOFT,
    textAlign: "right",
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 700,
    color: INK,
    textAlign: "right",
  },
  accentBar: {
    height: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: INK_SOFT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  rowLast: {
    flexDirection: "row",
  },
  cellLabel: {
    width: "34%",
    padding: 8,
    fontSize: 9,
    color: INK_SOFT,
    borderRightWidth: 1,
    borderRightColor: LINE,
    backgroundColor: "#f2f5f0",
  },
  cellValue: {
    width: "66%",
    padding: 8,
    fontSize: 10,
    color: INK,
    fontWeight: 700,
  },
  noteBox: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 4,
    padding: 10,
  },
  noteLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 10,
    color: INK,
    lineHeight: 1.4,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 60,
  },
  signatureBlock: {
    width: "45%",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: INK,
    marginBottom: 6,
    height: 34,
  },
  signatureImage: {
    height: 34,
    marginBottom: 6,
    objectFit: "contain",
  },
  signatureLabel: {
    fontSize: 9,
    color: INK_SOFT,
    textAlign: "center",
  },
  conditions: {
    marginTop: 28,
    fontSize: 7.5,
    color: INK_SOFT,
    lineHeight: 1.4,
  },
  privacy: {
    marginTop: 10,
    fontSize: 7.5,
    color: INK_SOFT,
    lineHeight: 1.4,
  },
});

const TITLE: Record<DocumentoTipo, string> = {
  consegna: "Verbale di consegna ausilio",
  restituzione: "Verbale di restituzione ausilio",
};

const DATE_LABEL: Record<DocumentoTipo, string> = {
  consegna: "Data di consegna",
  restituzione: "Data di restituzione",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function fmtEuro(importo: number): string {
  return `${importo.toFixed(2).replace(".", ",")} €`;
}

export function VerbaleDocument({
  tipo,
  numeroContratto,
  data,
  settings,
  dispositivo,
  cliente,
  note,
  alPrevisto,
  tariffa,
  firmaClienteUrl,
  firmaOperatoreUrl,
}: VerbaleDocumentProps) {
  const hasLogo = Boolean(settings.logoUrl);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {hasLogo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.logo} src={settings.logoUrl} />
            ) : (
              <Text style={styles.companyName}>
                {settings.ragioneSociale || "Ragione sociale non impostata"}
              </Text>
            )}
          </View>
          <View style={styles.companyBlock}>
            {hasLogo && settings.ragioneSociale ? (
              <Text style={[styles.companyLine, { fontWeight: 700, color: INK }]}>
                {settings.ragioneSociale}
              </Text>
            ) : null}
            {settings.indirizzo ? (
              <Text style={styles.companyLine}>{settings.indirizzo}</Text>
            ) : null}
            {settings.partitaIva ? (
              <Text style={styles.companyLine}>P.IVA {settings.partitaIva}</Text>
            ) : null}
            {settings.telefono ? (
              <Text style={styles.companyLine}>Tel. {settings.telefono}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{TITLE[tipo]}</Text>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>N. Noleggio</Text>
            <Text style={styles.metaValue}>{numeroContratto || "—"}</Text>
            <Text style={[styles.metaLine, { marginTop: 6 }]}>Data</Text>
            <Text style={styles.metaValue}>{fmtDate(data)}</Text>
          </View>
        </View>
        <View style={styles.accentBar} />

        <Text style={styles.sectionLabel}>Cliente</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Nome e cognome</Text>
            <Text style={styles.cellValue}>{cliente.nome || "—"}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.cellLabel}>Telefono</Text>
            <Text style={styles.cellValue}>{cliente.telefono || "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Dispositivo</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Codice</Text>
            <Text style={styles.cellValue}>{dispositivo.codice || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Categoria</Text>
            <Text style={styles.cellValue}>{dispositivo.categoria || "—"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Marca e modello</Text>
            <Text style={styles.cellValue}>
              {[dispositivo.marca, dispositivo.modello].filter(Boolean).join(" ") || "—"}
            </Text>
          </View>
          {dispositivo.larghezza != null ? (
            <View style={styles.row}>
              <Text style={styles.cellLabel}>Larghezza seduta</Text>
              <Text style={styles.cellValue}>{dispositivo.larghezza} cm</Text>
            </View>
          ) : null}
          <View style={tipo === "consegna" && alPrevisto ? styles.row : styles.rowLast}>
            <Text style={styles.cellLabel}>{DATE_LABEL[tipo]}</Text>
            <Text style={styles.cellValue}>{fmtDate(data)}</Text>
          </View>
          {/* Solo sulla consegna, e solo se impostata: sulla restituzione il
              rientro è già avvenuto, e un campo vuoto sul verbale firmato
              dal cliente è peggio che ometterlo del tutto. */}
          {tipo === "consegna" && alPrevisto ? (
            <View style={styles.rowLast}>
              <Text style={styles.cellLabel}>Rientro previsto</Text>
              <Text style={styles.cellValue}>{fmtDate(alPrevisto)}</Text>
            </View>
          ) : null}
        </View>

        {tariffa ? (
          <>
            <Text style={styles.sectionLabel}>Tariffa</Text>
            <View style={styles.table}>
              <View style={tariffa.totale != null ? styles.row : styles.rowLast}>
                <Text style={styles.cellLabel}>Tariffa applicata</Text>
                <Text style={styles.cellValue}>
                  {fmtEuro(tariffa.importo)} al {tariffa.unita === "settimana" ? "settimana" : "giorno"}
                </Text>
              </View>
              {/* Assente senza una data di riferimento per calcolarlo (es.
                  consegna senza rientro previsto): niente riga vuota. */}
              {tariffa.totale != null ? (
                <View style={styles.rowLast}>
                  <Text style={styles.cellLabel}>{tariffa.stimato ? "Totale stimato" : "Totale"}</Text>
                  <Text style={styles.cellValue}>{fmtEuro(tariffa.totale)}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Note</Text>
          <Text style={styles.noteText}>{note || "—"}</Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            {firmaClienteUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.signatureImage} src={firmaClienteUrl} />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={styles.signatureLabel}>Firma cliente</Text>
          </View>
          <View style={styles.signatureBlock}>
            {firmaOperatoreUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={styles.signatureImage} src={firmaOperatoreUrl} />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={styles.signatureLabel}>Firma operatore</Text>
          </View>
        </View>

        <Text style={styles.conditions}>{settings.condizioniGenerali}</Text>
        <Text style={styles.privacy}>{settings.informativaPrivacy}</Text>
      </Page>
    </Document>
  );
}
