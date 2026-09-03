import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";

/**
 * Palette e stili di base condivisi da tutti i documenti PDF del fascicolo
 * plantare (stampa interna completa, stampa cliente, dichiarazione di
 * conformità, visita di controllo, allegato A): un solo posto per la
 * gerarchia tipografica, non quattro copie leggermente diverse che nel
 * tempo finiscono per divergere.
 */
export const INK = "#17301b";
export const INK_SOFT = "#5c6b5e";
export const ACCENT = "#175c22";
export const LINE = "#e1e7df";

// NOTA: "lineHeight" va sempre sui singoli stili di testo, MAI su "page" —
// impostato sul contenitore pagina, in questa versione di
// @react-pdf/renderer rompe silenziosamente il posizionamento assoluto
// (il footer con position:"absolute" spariva del tutto, su ogni pagina,
// senza errori). Comportamento verificato isolatamente, vedi git history.
export const sharedStyles = StyleSheet.create({
  page: { padding: 44, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 140, maxHeight: 54, objectFit: "contain" },
  companyName: { fontSize: 13, fontWeight: 700, color: INK },
  companyBlock: { alignItems: "flex-end", maxWidth: 260 },
  companyLine: { fontSize: 8, color: INK_SOFT, textAlign: "right" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 },
  title: { fontSize: 15, fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: 0.4 },
  sub: { fontSize: 9, color: INK_SOFT, marginTop: 2, lineHeight: 1.4 },
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
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const datePart = iso.includes("T") ? iso.slice(0, 10) : iso;
  const [y, m, d] = datePart.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function fmtEuro(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Intestazione fissa (logo/ragione sociale a sinistra, recapiti a destra),
 * ripetuta identica su ogni pagina di ogni documento del fascicolo. */
export function DocHeader({ settings }: { settings: CompanySettings }) {
  const hasLogo = Boolean(settings.logoUrl);
  return (
    <View style={sharedStyles.headerRow} fixed>
      <View>
        {hasLogo ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image style={sharedStyles.logo} src={settings.logoUrl} />
        ) : (
          <Text style={sharedStyles.companyName}>{settings.ragioneSociale || "Ragione sociale non impostata"}</Text>
        )}
      </View>
      <View style={sharedStyles.companyBlock}>
        {hasLogo && settings.ragioneSociale ? (
          <Text style={[sharedStyles.companyLine, { fontWeight: 700, color: INK }]}>{settings.ragioneSociale}</Text>
        ) : null}
        {settings.indirizzo ? <Text style={sharedStyles.companyLine}>{settings.indirizzo}</Text> : null}
        {settings.partitaIva ? <Text style={sharedStyles.companyLine}>P.IVA {settings.partitaIva}</Text> : null}
        {settings.telefono ? <Text style={sharedStyles.companyLine}>Tel. {settings.telefono}</Text> : null}
      </View>
    </View>
  );
}

/** Piè di pagina fisso: due righe di testo a sinistra/destra (di solito un
 * riferimento del documento e "Pagina N di M"), stesso su ogni pagina. */
export function DocFooter({ left, right }: { left: string; right?: (info: { pageNumber: number; totalPages: number }) => string }) {
  return (
    <View style={sharedStyles.footer} fixed>
      <Text>{left}</Text>
      <Text render={right ?? (({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`)} />
    </View>
  );
}

export function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={sharedStyles.checkRow}>
      <View style={checked ? sharedStyles.checkBoxFilled : sharedStyles.checkBox} />
      <Text style={sharedStyles.checkLabel}>{label}</Text>
    </View>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={sharedStyles.row}>
      <Text style={sharedStyles.cellLabel}>{label}</Text>
      <Text style={sharedStyles.cellValue}>{value}</Text>
    </View>
  );
}

export function FieldLast({ label, value }: { label: string; value: string }) {
  return (
    <View style={sharedStyles.rowLast}>
      <Text style={sharedStyles.cellLabel}>{label}</Text>
      <Text style={sharedStyles.cellValue}>{value}</Text>
    </View>
  );
}

/** Blocco titolo/numero fascicolo in cima al documento, comune a tutti e
 * quattro i tipi di stampa (solo il "title" cambia da uno all'altro). */
export function DocTitleBlock({
  title,
  fascicoloNumero,
  stato,
}: {
  title: string;
  fascicoloNumero: string;
  stato?: string;
}) {
  return (
    <>
      <View style={sharedStyles.titleRow}>
        <Text style={sharedStyles.title}>{title}</Text>
        <View style={sharedStyles.metaBlock}>
          <Text style={sharedStyles.metaLine}>N. Fascicolo</Text>
          <Text style={sharedStyles.metaValue}>{fascicoloNumero}</Text>
          {stato ? (
            <>
              <Text style={[sharedStyles.metaLine, { marginTop: 5 }]}>Stato</Text>
              <Text style={sharedStyles.metaValue}>{stato}</Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={sharedStyles.accentBar} />
    </>
  );
}
