import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { FASCICOLO_STATO_LABEL } from "@/lib/fascicoli-types";
import { CONDIZIONI_GENERALI_FORNITURA, INFORMATIVA_PRIVACY_FASCICOLO } from "@/lib/fascicoli-testi";
import { Check, DocFooter, DocHeader, DocTitleBlock, Field, FieldLast, fmtDate, fmtEuro, sharedStyles } from "./shared";

export interface StampaClienteDocumentProps {
  settings: CompanySettings;
  cliente: ClientRecord;
  fascicolo: FascicoloRecord;
}

/**
 * Stampa cliente — primo appuntamento: quello che si consegna e fa firmare
 * al cliente il giorno della misurazione/ordine. Niente dati clinici
 * dettagliati (anamnesi, esame del piede, scheda di produzione interna):
 * solo anagrafica, prezzo, tempistiche, e i due testi che il cliente deve
 * poter leggere e firmare (privacy, condizioni di fornitura). Per tutto il
 * resto vedi la stampa interna completa.
 */
export function StampaClienteDocument({ settings, cliente, fascicolo }: StampaClienteDocumentProps) {
  const c = fascicolo.contenuto;
  const nomeCompleto = [cliente.nomeProprio || cliente.nome, cliente.cognome].filter(Boolean).join(" ") || cliente.nome;
  const indirizzoCompleto = [cliente.indirizzo, [cliente.cap, cliente.localita, cliente.provincia].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  const telefono = [cliente.telefono, cliente.cellulare].filter(Boolean).join(" · ");
  const footerLeft = `Fascicolo ${fascicolo.numero} · ${cliente.nome}`;
  const haPraticaAsl = c.prescrizione.praticaAsl;
  const haPrescrizioneMedica = c.prescrizione.richiestaMedica;

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <DocHeader settings={settings} />
        <DocFooter left={footerLeft} />

        <DocTitleBlock
          title="Fascicolo plantare — primo appuntamento"
          fascicoloNumero={fascicolo.numero}
          stato={FASCICOLO_STATO_LABEL[fascicolo.stato]}
        />

        <Text style={sharedStyles.sectionLabel}>Dati cliente</Text>
        <View style={sharedStyles.table}>
          <Field label="Nome e cognome" value={nomeCompleto} />
          <Field label="Codice fiscale" value={cliente.codiceFiscale || "—"} />
          <Field label="Residente in" value={indirizzoCompleto || "—"} />
          <FieldLast label="Recapiti" value={telefono || "—"} />
        </View>

        <Text style={sharedStyles.sectionLabel}>Materiale, prezzo e tempistiche</Text>
        <View style={sharedStyles.table}>
          <Field label="Materiale richiesto" value={`${c.prescrizione.quantita} — ${c.prescrizione.descrizioneMateriale}`} />
          <Field label="Importo (IVA inclusa)" value={fmtEuro(c.prescrizione.importo)} />
          <FieldLast label="Data di consegna prevista" value={fmtDate(c.consegna.dataConsegnaPrevista)} />
        </View>

        {haPraticaAsl || haPrescrizioneMedica ? (
          <>
            <Text style={sharedStyles.sectionLabel}>Prescrizione e pratica ASL/SSN</Text>
            <View style={sharedStyles.table}>
              {haPrescrizioneMedica && haPraticaAsl ? (
                <Field
                  label="Prescrizione medica"
                  value={`${c.prescrizione.medicoPrescrittore || "—"} — ${fmtDate(c.prescrizione.dataPrescrizione)}`}
                />
              ) : null}
              {haPrescrizioneMedica && !haPraticaAsl ? (
                <FieldLast
                  label="Prescrizione medica"
                  value={`${c.prescrizione.medicoPrescrittore || "—"} — ${fmtDate(c.prescrizione.dataPrescrizione)}`}
                />
              ) : null}
              {haPraticaAsl ? <FieldLast label="Numero pratica ASL/SSN" value={c.prescrizione.autorizzazioneAslNumero || "—"} /> : null}
            </View>
          </>
        ) : null}

        <View break>
          <Text style={sharedStyles.sectionLabel}>Informativa privacy e consenso al trattamento dati</Text>
          <Text style={sharedStyles.para}>{INFORMATIVA_PRIVACY_FASCICOLO}</Text>
          <Check checked={c.consensi.consensoTrattamentoDati} label="Acconsento al trattamento dei miei dati personali e particolari alle condizioni previste nell'informativa" />
          <Check checked={c.consensi.presaVisioneInformativa} label="Presa visione dell'informativa privacy" />
          <Check checked={c.consensi.consensoDocumentazione} label="Consenso alla documentazione tecnica del dispositivo" />
          <View style={sharedStyles.signatureRow}>
            <View style={sharedStyles.signatureBlock}>
              <View style={sharedStyles.signatureLine} />
              <Text style={sharedStyles.signatureLabel}>Firma del cliente</Text>
            </View>
            <View style={sharedStyles.signatureBlock}>
              <Text style={[sharedStyles.metaValue, { textAlign: "center" }]}>Data {fmtDate(c.consensi.dataConsenso)}</Text>
            </View>
          </View>
        </View>

        <View break>
          <Text style={sharedStyles.sectionLabel}>Condizioni generali di fornitura</Text>
          <Text style={sharedStyles.para}>{CONDIZIONI_GENERALI_FORNITURA}</Text>
        </View>
      </Page>
    </Document>
  );
}
