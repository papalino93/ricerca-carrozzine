import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { ATTESTAZIONE_FABBRICANTE, DICHIARAZIONE_CONFORMITA_TESTO, NOTE_INFORMATIVE_USO } from "@/lib/fascicoli-testi";
import { DocFooter, DocHeader, DocTitleBlock, Field, FieldLast, fmtDate, sharedStyles } from "./shared";

export interface DichiarazioneConformitaDocumentProps {
  settings: CompanySettings;
  cliente: ClientRecord;
  fascicolo: FascicoloRecord;
}

/**
 * Documento consegnato al momento della consegna del plantare: dichiarazione
 * di conformità del prodotto (con i riferimenti del tecnico sanitario, sulla
 * stessa pagina i dati identificativi del cliente), il libretto d'uso
 * (note informative/istruzioni/garanzia) e — se la fornitura è autorizzata
 * da ASL/SSN — la comunicazione di avvenuta consegna da far firmare per
 * ricevuta.
 */
export function DichiarazioneConformitaDocument({ settings, cliente, fascicolo }: DichiarazioneConformitaDocumentProps) {
  const c = fascicolo.contenuto;
  const cognome = cliente.cognome || cliente.nome;
  const nomeProprio = cliente.nomeProprio || "";
  const footerLeft = `Fascicolo ${fascicolo.numero} · ${cliente.nome}`;

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <DocHeader settings={settings} />
        <DocFooter left={footerLeft} />

        <DocTitleBlock title="Dichiarazione di conformità e consegna" fascicoloNumero={fascicolo.numero} />

        <Text style={sharedStyles.sectionLabel}>Dati cliente</Text>
        <View style={sharedStyles.table}>
          <Field label="Cognome" value={cognome} />
          <Field label="Nome" value={nomeProprio || "—"} />
          <FieldLast label="Codice fiscale" value={cliente.codiceFiscale || "—"} />
        </View>

        <Text style={sharedStyles.sectionLabel}>Dichiarazione di conformità — Regolamento (UE) 2017/745</Text>
        <Text style={sharedStyles.para}>{DICHIARAZIONE_CONFORMITA_TESTO}</Text>
        <Text style={[sharedStyles.para, { marginTop: 6 }]}>
          {ATTESTAZIONE_FABBRICANTE.tecnico}
          {"\n"}
          {ATTESTAZIONE_FABBRICANTE.fabbricante}
        </Text>
        <View style={sharedStyles.signatureRow}>
          <View style={sharedStyles.signatureBlock}>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureLabel}>Firma della direzione</Text>
          </View>
          <View style={sharedStyles.signatureBlock}>
            <Text style={[sharedStyles.metaValue, { textAlign: "center" }]}>
              Scandicci, {fmtDate(c.consegna.dataConsegnaEffettiva || c.prescrizione.dataOrdine)}
            </Text>
          </View>
        </View>

        <View>
          <Text style={sharedStyles.sectionLabel}>Note informative, istruzioni per l&apos;uso e garanzia</Text>
          <Text style={sharedStyles.legalTitle}>1 — Descrizione</Text>
          <Text style={sharedStyles.para}>{NOTE_INFORMATIVE_USO.descrizione}</Text>
          <Text style={sharedStyles.legalTitle}>2 — Indicazioni d&apos;uso</Text>
          <Text style={sharedStyles.para}>{NOTE_INFORMATIVE_USO.indicazioniUso}</Text>
          <Text style={sharedStyles.legalTitle}>3 — Come si usano</Text>
          <Text style={sharedStyles.para}>{NOTE_INFORMATIVE_USO.comeSiUsano}</Text>
          <Text style={sharedStyles.legalTitle}>4 — Controindicazioni</Text>
          <Text style={sharedStyles.para}>{NOTE_INFORMATIVE_USO.controindicazioni}</Text>
          <Text style={sharedStyles.legalTitle}>5 — Manutenzione e conservazione</Text>
          <Text style={sharedStyles.para}>{NOTE_INFORMATIVE_USO.manutenzione}</Text>
          <Text style={sharedStyles.legalTitle}>6 — Garanzia</Text>
          <Text style={sharedStyles.para}>{NOTE_INFORMATIVE_USO.garanzia}</Text>
        </View>

        {c.prescrizione.praticaAsl ? (
          <View>
            <Text style={sharedStyles.sectionLabel}>Comunicazione di avvenuta consegna</Text>
            <Text style={sharedStyles.para}>
              Con la presente si comunica che in data odierna è stato consegnato alla/al Sig.ra/Sig.{" "}
              {[nomeProprio, cognome].filter(Boolean).join(" ") || cliente.nome}
              {c.consegna.comunicazioneAslDestinatario ? `, per conto di ${c.consegna.comunicazioneAslDestinatario},` : ""} il
              materiale autorizzato con pratica n.{" "}
              {c.consegna.comunicazioneAslPraticaNumero || c.prescrizione.autorizzazioneAslNumero || "—"}.
            </Text>
            <View style={sharedStyles.signatureRow}>
              <View style={sharedStyles.signatureBlock}>
                <View style={sharedStyles.signatureLine} />
                <Text style={sharedStyles.signatureLabel}>Firma per ricevuta</Text>
              </View>
              <View style={sharedStyles.signatureBlock}>
                <Text style={[sharedStyles.metaValue, { textAlign: "center" }]}>Data {fmtDate(c.consegna.dataConsegnaEffettiva)}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
