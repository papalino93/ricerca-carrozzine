import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { ClientRecord } from "@/lib/clients";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { FASCICOLO_STATO_LABEL } from "@/lib/fascicoli-types";
import {
  ATTESTAZIONE_FABBRICANTE,
  CONDIZIONI_GENERALI_FORNITURA,
  CONTROINDICAZIONI_FORNITORE,
  DICHIARAZIONE_CONFORMITA_TESTO,
  INFORMATIVA_PRIVACY_FASCICOLO,
  NOTE_INFORMATIVE_USO,
} from "@/lib/fascicoli-testi";
import {
  Check,
  DocFooter,
  DocHeader,
  DocTitleBlock,
  Field,
  FieldLast,
  fmtDate,
  fmtEuro,
  INK_SOFT,
  LINE,
  sharedStyles,
} from "./shared";
import { FlussogrammaSvg } from "./FlussogrammaSvg";

export interface FascicoloDocumentProps {
  settings: CompanySettings;
  cliente: ClientRecord;
  fascicolo: FascicoloRecord;
  /** Allegati-immagine (prescrizione, autorizzazione ASL fotografata, ecc.)
   * da aggiungere come pagine finali: solo per la stampa interna completa,
   * gli altri tre tipi di stampa non li includono mai. I PDF allegati non
   * passano da qui — vengono uniti a livello di byte dopo il rendering
   * (vedi la route /documento, che usa pdf-lib). */
  allegatiImmagini?: { dataUri: string; etichetta: string }[];
}

const styles = StyleSheet.create({
  allegatoHeadRow: { flexDirection: "row", backgroundColor: "#f2f5f0", borderBottomWidth: 1, borderBottomColor: LINE },
  allegatoHeadText: { fontSize: 7.5, fontWeight: 700, color: INK_SOFT, textTransform: "uppercase", padding: 5 },
  allegatoCellFase: { width: "24%", padding: 5, fontSize: 7.5, fontWeight: 700 },
  allegatoCellDescrizione: { width: "22%", padding: 5, fontSize: 7.5, borderLeftWidth: 1, borderLeftColor: LINE },
  allegatoCellDocumenti: { width: "42%", padding: 5, fontSize: 7.5, color: INK_SOFT, borderLeftWidth: 1, borderLeftColor: LINE },
  allegatoCellResp: { width: "12%", padding: 5, fontSize: 7.5, borderLeftWidth: 1, borderLeftColor: LINE },
  allegatoImage: { maxWidth: "100%", maxHeight: 650, objectFit: "contain", marginTop: 10 },
});

/**
 * Stampa interna completa: TUTTO il fascicolo, per l'archiviazione su
 * PC/Drive o la stampa cartacea da tenere in negozio — mai quella data al
 * cliente (per quella vedi StampaClienteDocument e
 * DichiarazioneConformitaDocument). Le sezioni scorrono in modo naturale
 * (nessun "break" forzato tra l'una e l'altra): con contenuti di lunghezza
 * variabile un'interruzione pagina obbligatoria prima di ogni sezione
 * lasciava spesso gran parte della pagina bianca. React-pdf sposta comunque
 * una sezione sulla pagina successiva se non ci sta per intero. Il break
 * resta solo prima dell'Allegato A, un annesso corposo e a sé stante che
 * ha comunque quasi sempre bisogno di una pagina dedicata.
 */
export function FascicoloDocument({ settings, cliente, fascicolo, allegatiImmagini }: FascicoloDocumentProps) {
  const c = fascicolo.contenuto;
  const nomeCompleto = [cliente.nomeProprio || cliente.nome, cliente.cognome].filter(Boolean).join(" ") || cliente.nome;
  const indirizzoCompleto = [cliente.indirizzo, [cliente.cap, cliente.localita, cliente.provincia].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const telefono = [cliente.telefono, cliente.cellulare].filter(Boolean).join(" · ");
  const footerLeft = `Commessa ${fascicolo.commessa || fascicolo.numero} · ${cliente.nome} · Rev. ${fascicolo.versione}`;

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <DocHeader settings={settings} />
        <DocFooter left={footerLeft} />

        <DocTitleBlock
          title="Fascicolo plantare — stampa interna completa"
          fascicoloNumero={fascicolo.numero}
          stato={FASCICOLO_STATO_LABEL[fascicolo.stato]}
        />

        {/* 1 · ANAGRAFICA E COMMESSA — dati recuperati dalla scheda cliente, mai ridigitati */}
        <Text style={sharedStyles.sectionLabel}>1 · Dati cliente e commessa</Text>
        <View style={sharedStyles.table}>
          <Field label="Nome e cognome" value={nomeCompleto} />
          <Field label="Codice fiscale" value={cliente.codiceFiscale || "—"} />
          <Field label="Residente in" value={indirizzoCompleto || "—"} />
          <Field label="Nato/a il" value={fmtDate(cliente.dataNascita)} />
          <Field label="Recapiti" value={telefono || "—"} />
          <Field label="N. commessa" value={fascicolo.commessa || fascicolo.numero} />
          <FieldLast label="Data ordine" value={fmtDate(c.prescrizione.dataOrdine)} />
        </View>
        <View style={[sharedStyles.table, { marginTop: 8 }]}>
          <Field label="Materiale richiesto" value={`${c.prescrizione.quantita} — ${c.prescrizione.descrizioneMateriale}`} />
          <FieldLast label="Importo (IVA inclusa)" value={fmtEuro(c.prescrizione.importo)} />
        </View>
        <Check checked={c.prescrizione.dispositivoDetraibile} label="Dispositivo medico detraibile" />

        {/* 2 · ANAMNESI */}
        <Text style={sharedStyles.sectionLabel}>2 · Anamnesi e caratteristiche somatiche</Text>
        <View style={sharedStyles.table}>
          <Field label="Altezza / Peso" value={`${c.anamnesi.altezzaCm ?? "—"} cm · ${c.anamnesi.pesoKg ?? "—"} kg`} />
          <Field label="Patologia correlata al dispositivo" value={c.anamnesi.patologiaCorrelata || "—"} />
          <Field label="Altre patologie" value={c.anamnesi.altrePatologie || "—"} />
          <Field
            label="Allergie"
            value={c.anamnesi.nessunaAllergia ? "Dichiara di non averne" : c.anamnesi.allergie || "—"}
          />
          <FieldLast
            label="Capacità psicofisica"
            value={
              c.anamnesi.capacitaPsicofisica === "totale"
                ? "Totale"
                : c.anamnesi.capacitaPsicofisica === "parziale"
                  ? "Parziale"
                  : c.anamnesi.capacitaPsicofisica === "assistenza"
                    ? "Necessità di assistente"
                    : "—"
            }
          />
        </View>

        {/* 3 · DOCUMENTAZIONE MEDICA */}
        <Text style={sharedStyles.sectionLabel}>3 · Documentazione medica presentata</Text>
        <Check checked={c.prescrizione.richiestaMedica} label={`Richiesta medica${c.prescrizione.medicoPrescrittore ? ` — ${c.prescrizione.medicoPrescrittore}` : ""}`} />
        <Check checked={c.prescrizione.documentazioneDiagnostica} label="Documentazione diagnostica presentata" />
        {c.prescrizione.praticaAsl ? (
          <Check checked label={`Pratica ASL/SSN — autorizzazione n. ${c.prescrizione.autorizzazioneAslNumero || "—"}`} />
        ) : null}
        {c.prescrizione.note ? <Text style={sharedStyles.para}>Note: {c.prescrizione.note}</Text> : null}
        <Text style={[sharedStyles.legalTitle, { fontSize: 8, marginTop: 8, marginBottom: 2 }]}>
          Controindicazioni indicate dal fornitore
        </Text>
        {CONTROINDICAZIONI_FORNITORE.map((riga, i) => (
          <Text key={i} style={sharedStyles.para}>
            • {riga}
          </Text>
        ))}

        {/* 4 · ESAME DEL PIEDE */}
        <View>
          <Text style={sharedStyles.sectionLabel}>4 · Scheda rilevazione obiettiva</Text>
          {c.esamePiede.motivoVisita ? <Text style={sharedStyles.para}>Motivo della visita: {c.esamePiede.motivoVisita}</Text> : null}
          <View style={sharedStyles.twoCol}>
            {(["sinistro", "destro"] as const).map((lato) => {
              const l = c.esamePiede[lato];
              const righe = [
                l.piedePiatto && `Piede piatto ${l.piedePiatto}`,
                l.piedeCavo && `Piede cavo ${l.piedeCavo}`,
                l.pronazione && `Pronazione ${l.pronazione}`,
                l.alluce && `Alluce ${l.alluce}`,
                l.ditaAGriffe.length > 0 && `Dita a griffe: ${l.ditaAGriffe.map((n) => `${n}°`).join(", ")}`,
                (l.tallone.talalgie || l.tallone.spinaCalcaneare) &&
                  `Tallone: ${[l.tallone.talalgie && "talalgie", l.tallone.spinaCalcaneare && "spina calcaneare"].filter(Boolean).join(", ")}`,
                l.ginocchio && `Ginocchio ${l.ginocchio}`,
                l.tibiaVara && "Tibia vara",
                l.sovraccaricoMetatarsali.length > 0 &&
                  `Sovraccarico metatarsale: ${l.sovraccaricoMetatarsali.map((n) => `${n}°`).join(", ")}`,
                (l.ulcerazioni.dorsali || l.ulcerazioni.plantari || l.ulcerazioni.calcaneari) &&
                  `Ulcerazioni: ${[l.ulcerazioni.dorsali && "dorsali", l.ulcerazioni.plantari && "plantari", l.ulcerazioni.calcaneari && "calcaneari"].filter(Boolean).join(", ")}`,
                l.traumi && `Traumi: ${l.traumi}`,
              ].filter(Boolean) as string[];
              return (
                <View key={lato} style={sharedStyles.col}>
                  <Text style={[sharedStyles.legalTitle, { textTransform: "uppercase" }]}>Piede {lato}</Text>
                  {righe.length > 0 ? (
                    righe.map((r, i) => (
                      <Text key={i} style={sharedStyles.checkLabel}>
                        • {r}
                      </Text>
                    ))
                  ) : (
                    <Text style={sharedStyles.para}>Nessun rilievo segnalato.</Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[sharedStyles.legalTitle, { marginTop: 6 }]}>Destinazione d&apos;uso e calzatura</Text>
          <Text style={sharedStyles.para}>
            {[
              c.esamePiede.destinazioneUso.attivitaLavorativa && `Lavorativa: ${c.esamePiede.destinazioneUso.attivitaLavorativa}`,
              c.esamePiede.destinazioneUso.attivitaSportiva && `Sportiva: ${c.esamePiede.destinazioneUso.attivitaSportiva}`,
              c.esamePiede.destinazioneUso.attivitaTempoLibero && `Tempo libero: ${c.esamePiede.destinazioneUso.attivitaTempoLibero}`,
              c.esamePiede.calzaturaCollegamento.ciabattaPredisposta && "ciabatta predisposta",
              c.esamePiede.calzaturaCollegamento.scarpaPredisposta && "scarpa predisposta",
              c.esamePiede.calzaturaCollegamento.antinfortunistica && "antinfortunistica",
              c.esamePiede.calzaturaCollegamento.scarpaGinnastica && "scarpa da ginnastica",
            ]
              .filter(Boolean)
              .join(" · ") || "Non specificata"}
          </Text>

          {/* 5 · PIANO APPUNTAMENTI — condivide la pagina con la 4 se c'è
              spazio: sono entrambe brevi, un break dedicato le avrebbe solo
              separate senza motivo. */}
          <Text style={sharedStyles.sectionLabel}>5 · Piano appuntamenti</Text>
          <View style={sharedStyles.table}>
            <Field label="1° appuntamento (baropodometria+calco)" value={fmtDate(c.consegna.dataPrimoAppuntamento)} />
            <Field
              label="Prova/consegna prevista"
              value={`${fmtDate(c.consegna.dataConsegnaPrevista)}${c.consegna.oraConsegna ? ` alle ${c.consegna.oraConsegna}` : ""}`}
            />
            <Field label="Consegna effettiva" value={fmtDate(c.consegna.dataConsegnaEffettiva)} />
            <Field label="Follow-up a 2 mesi" value={fmtDate(c.consegna.dataFollowUp)} />
            <FieldLast label="Luogo" value={c.consegna.luogoConsegna || "—"} />
          </View>
        </View>

        {/* 6 · DICHIARAZIONE DI CONFORMITÀ */}
        <View>
          <Text style={sharedStyles.sectionLabel}>6 · Dichiarazione di conformità — Regolamento (UE) 2017/745</Text>
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
              <Text style={[sharedStyles.metaValue, { textAlign: "center" }]}>Scandicci, {fmtDate(c.prescrizione.dataOrdine)}</Text>
            </View>
          </View>
        </View>

        {/* 7 · SCHEDA DI PRODUZIONE */}
        <View>
          <Text style={sharedStyles.sectionLabel}>7 · Scheda di produzione — Commessa</Text>
          <View style={sharedStyles.table}>
            <Field label="Nome dispositivo" value={fascicolo.tipoDispositivo} />
            <Field label="Codice" value={c.produzione.codice || "—"} />
            <Field label="Matricola" value={c.produzione.matricola || "—"} />
            <Field label="Prescritto dal dottore" value={c.prescrizione.medicoPrescrittore || "—"} />
            <Field label="Data prescrizione" value={fmtDate(c.prescrizione.dataPrescrizione)} />
            <Field label="Responsabile di progetto" value={c.produzione.responsabileProgetto || "—"} />
            <Field label="Operatore" value={fascicolo.operatore || "—"} />
            <Field label="Data inizio lavori" value={fmtDate(c.produzione.dataInizioLavori)} />
            <FieldLast label="Data pronta consegna" value={fmtDate(c.produzione.dataProntaConsegna)} />
          </View>
          <View style={[sharedStyles.table, { marginTop: 8 }]}>
            <View style={styles.allegatoHeadRow}>
              <Text style={[styles.allegatoHeadText, { width: "6%" }]}>N.</Text>
              <Text style={[styles.allegatoHeadText, { width: "34%" }]}>Fase</Text>
              <Text style={[styles.allegatoHeadText, { width: "34%" }]}>Controlli</Text>
              <Text style={[styles.allegatoHeadText, { width: "26%" }]}>Data / Operatore</Text>
            </View>
            {c.produzione.fasi.map((f, i) => (
              <View key={f.numero} style={i === c.produzione.fasi.length - 1 ? sharedStyles.rowLast : sharedStyles.row}>
                <Text style={{ width: "6%", padding: 5, fontSize: 7.5 }}>{f.numero}</Text>
                <Text style={{ width: "34%", padding: 5, fontSize: 7.5 }}>
                  {f.nome}
                  {f.note ? ` — ${f.note}` : ""}
                </Text>
                <Text style={{ width: "34%", padding: 5, fontSize: 7.5, color: INK_SOFT }}>{f.controlli}</Text>
                <Text style={{ width: "26%", padding: 5, fontSize: 7.5 }}>
                  {f.completata ? "✓ " : "— "}
                  {fmtDate(f.data)}
                  {f.operatore ? ` · ${f.operatore}` : ""}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[sharedStyles.para, { marginTop: 6 }]}>
            Controllo finale:{" "}
            {c.produzione.controlloFinale === "conforme"
              ? "Conforme"
              : c.produzione.controlloFinale === "non_conforme"
                ? `Non conforme (N.C. n. ${c.produzione.nonConformitaNumero || "—"})`
                : "Non ancora effettuato"}
            {c.produzione.noteRiesame ? ` — Note per riesame: ${c.produzione.noteRiesame}` : ""}
          </Text>
        </View>

        {/* 8 · COMUNICAZIONE AVVENUTA CONSEGNA — solo per pratiche ASL/SSN */}
        {c.prescrizione.praticaAsl ? (
          <View>
            <Text style={sharedStyles.sectionLabel}>8 · Comunicazione di avvenuta consegna</Text>
            <Text style={sharedStyles.para}>
              Con la presente si comunica che in data odierna è stato consegnato alla/al Sig.ra/Sig.{" "}
              {nomeCompleto}
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

        {/* 9 · CONDIZIONI GENERALI DI FORNITURA */}
        <View>
          <Text style={sharedStyles.sectionLabel}>9 · Condizioni generali di fornitura</Text>
          <Text style={sharedStyles.para}>{CONDIZIONI_GENERALI_FORNITURA}</Text>
        </View>

        {/* 10 · PRIVACY E CONSENSI */}
        <View>
          <Text style={sharedStyles.sectionLabel}>10 · Informativa privacy e consenso al trattamento dati</Text>
          <Text style={sharedStyles.para}>{INFORMATIVA_PRIVACY_FASCICOLO}</Text>
          <Check checked={c.consensi.consensoTrattamentoDati} label="Acconsento al trattamento dei miei dati personali e particolari alle condizioni previste nell'informativa" />
          <Check checked={c.consensi.presaVisioneInformativa} label="Presa visione dell'informativa privacy" />
          <Check checked={c.consensi.consensoDocumentazione} label="Consenso alla documentazione tecnica del dispositivo" />
          <View style={sharedStyles.signatureRow}>
            <View style={sharedStyles.signatureBlock}>
              {c.consensi.firmaClienteUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={sharedStyles.signatureImage} src={c.consensi.firmaClienteUrl} />
              ) : (
                <View style={sharedStyles.signatureLine} />
              )}
              <Text style={sharedStyles.signatureLabel}>Firma del cliente</Text>
            </View>
            <View style={sharedStyles.signatureBlock}>
              <Text style={[sharedStyles.metaValue, { textAlign: "center" }]}>Data {fmtDate(c.consensi.dataConsenso)}</Text>
            </View>
          </View>
        </View>

        {/* 11 · NOTE INFORMATIVE / GARANZIA */}
        <View>
          <Text style={sharedStyles.sectionLabel}>11 · Note informative, istruzioni per l&apos;uso e garanzia</Text>
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

        {/* ALLEGATO A — procedura aziendale fissa: solo se richiesto esplicitamente */}
        {c.produzione.includiAllegatoA ? (
          <View break>
            <Text style={sharedStyles.sectionLabel}>Allegato A · Flussogramma di progettazione</Text>
            <Text style={sharedStyles.para}>
              Piano di progetto — procedura standard per la progettazione dei dispositivi su misura (ISO 13485, punti
              7.3.1-7.3.7). Documento fisso: uguale per ogni commessa.
            </Text>
            <FlussogrammaSvg />
          </View>
        ) : null}
      </Page>

      {/* Allegati-immagine: una pagina per foto/scansione, in coda al
          documento — solo nella stampa interna completa. I PDF allegati
          (prescrizioni, autorizzazioni ASL scansionate come PDF) NON sono
          qui: vengono uniti a livello di byte dopo il rendering (vedi la
          route /documento). */}
      {(allegatiImmagini ?? []).map((a, i) => (
        <Page key={i} size="A4" style={sharedStyles.page}>
          <DocHeader settings={settings} />
          <DocFooter left={footerLeft} />
          <Text style={sharedStyles.sectionLabel}>Allegato · {a.etichetta || `Immagine ${i + 1}`}</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.allegatoImage} src={a.dataUri} />
        </Page>
      ))}
    </Document>
  );
}
