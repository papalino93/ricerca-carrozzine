import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";

const INK = "#17301b";
const INK_SOFT = "#5c6b5e";
const ACCENT = "#175c22";
const LINE = "#e1e7df";

export interface FidelityModuleProps {
  settings: CompanySettings;
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
  logo: { maxWidth: 150, maxHeight: 60, objectFit: "contain" },
  companyName: { fontSize: 14, fontWeight: 700, color: INK },
  companyBlock: { alignItems: "flex-end", maxWidth: 260 },
  companyLine: { fontSize: 9, color: INK_SOFT, textAlign: "right" },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: INK,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 26,
  },
  subtitle: { fontSize: 9.5, color: INK_SOFT, marginTop: 4 },
  accentBar: {
    height: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: INK_SOFT,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  grid: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
  },
  gridRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  gridRowLast: { flexDirection: "row" },
  fieldBox: {
    flex: 1,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: LINE,
  },
  fieldBoxLast: { flex: 1, padding: 8 },
  fieldLabel: { fontSize: 8, color: INK_SOFT },
  fieldBlank: {
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: INK_SOFT,
    height: 1,
  },
  bodyText: { fontSize: 8.5, color: INK, lineHeight: 1.45 },
  consentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 4,
  },
  consentText: { fontSize: 8.5, color: INK, flex: 1, marginRight: 10 },
  consentChoice: { fontSize: 8.5, color: INK_SOFT },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  signatureBlock: { width: "45%" },
  signatureLine: { borderTopWidth: 1, borderTopColor: INK, marginBottom: 6, height: 34 },
  signatureLabel: { fontSize: 9, color: INK_SOFT, textAlign: "center" },
});

export function FidelityModule({ settings }: FidelityModuleProps) {
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
            {settings.indirizzo ? <Text style={styles.companyLine}>{settings.indirizzo}</Text> : null}
            {settings.partitaIva ? <Text style={styles.companyLine}>P.IVA {settings.partitaIva}</Text> : null}
            {settings.telefono ? <Text style={styles.companyLine}>Tel. {settings.telefono}</Text> : null}
          </View>
        </View>

        <Text style={styles.title}>Modulo di adesione alla carta fedeltà</Text>
        <Text style={styles.subtitle}>
          Da compilare e firmare in negozio al momento dell&apos;iscrizione — {settings.puntiPerEuro} punt
          {settings.puntiPerEuro === 1 ? "o" : "i"} per ogni euro speso, soglia premio: {settings.sogliaPremioPunti}{" "}
          punti = {settings.sogliaPremioEuro.toFixed(2).replace(".", ",")} €.
        </Text>
        <View style={styles.accentBar} />

        <Text style={styles.sectionLabel}>Dati del cliente</Text>
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Cognome</Text>
              <View style={styles.fieldBlank} />
            </View>
            <View style={styles.fieldBoxLast}>
              <Text style={styles.fieldLabel}>Nome</Text>
              <View style={styles.fieldBlank} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Data di nascita</Text>
              <View style={styles.fieldBlank} />
            </View>
            <View style={styles.fieldBoxLast}>
              <Text style={styles.fieldLabel}>Luogo di nascita</Text>
              <View style={styles.fieldBlank} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={{ ...styles.fieldBoxLast, borderRightWidth: 0 }}>
              <Text style={styles.fieldLabel}>Indirizzo</Text>
              <View style={styles.fieldBlank} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>CAP</Text>
              <View style={styles.fieldBlank} />
            </View>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Località</Text>
              <View style={styles.fieldBlank} />
            </View>
            <View style={styles.fieldBoxLast}>
              <Text style={styles.fieldLabel}>Provincia</Text>
              <View style={styles.fieldBlank} />
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldLabel}>Telefono</Text>
              <View style={styles.fieldBlank} />
            </View>
            <View style={styles.fieldBoxLast}>
              <Text style={styles.fieldLabel}>Cellulare</Text>
              <View style={styles.fieldBlank} />
            </View>
          </View>
          <View style={styles.gridRowLast}>
            <View style={{ ...styles.fieldBoxLast, borderRightWidth: 0 }}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.fieldBlank} />
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Regolamento</Text>
        <Text style={styles.bodyText}>{settings.regolamentoFedelta}</Text>

        <Text style={styles.sectionLabel}>Informativa privacy</Text>
        <Text style={styles.bodyText}>{settings.informativaPrivacy}</Text>

        <View style={styles.consentRow}>
          <Text style={styles.consentText}>
            Presto il mio consenso alle attività di marketing diretto (es. invio di promozioni)
          </Text>
          <Text style={styles.consentChoice}>☐ Do il consenso    ☐ Nego il consenso</Text>
        </View>
        <View style={styles.consentRow}>
          <Text style={styles.consentText}>
            Presto il mio consenso alle attività di profilazione (es. analisi delle abitudini d&apos;acquisto)
          </Text>
          <Text style={styles.consentChoice}>☐ Do il consenso    ☐ Nego il consenso</Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Luogo e data</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Firma leggibile del cliente</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
