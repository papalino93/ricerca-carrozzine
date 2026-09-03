import { Document, Page, Text } from "@react-pdf/renderer";
import type { CompanySettings } from "@/lib/settings";
import type { FascicoloRecord } from "@/lib/fascicoli-types";
import { DocFooter, DocHeader, sharedStyles } from "./shared";
import { FlussogrammaSvg } from "./FlussogrammaSvg";

export interface ProcessoProduttivoDocumentProps {
  settings: CompanySettings;
  fascicolo: FascicoloRecord;
}

/**
 * Allegato A — Flussogramma di progettazione, come documento a sé: stessa
 * procedura fissa (ISO 13485, 7.3.1-7.3.7) che può anche essere allegata
 * come ultima pagina del fascicolo cliente (vedi FascicoloDocument, flag
 * "includiAllegatoA") — qui invece stampabile da sola, senza dover aprire
 * un fascicolo specifico, per affiggerla come procedura interna.
 */
export function ProcessoProduttivoDocument({ settings, fascicolo }: ProcessoProduttivoDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        <DocHeader settings={settings} />
        <DocFooter left={`Commessa ${fascicolo.commessa || fascicolo.numero}`} />

        <Text style={sharedStyles.title}>Allegato A · Flussogramma di progettazione</Text>
        <Text style={sharedStyles.sub}>
          Piano di progetto — procedura standard per la progettazione dei dispositivi su misura (ISO 13485, punti
          7.3.1-7.3.7). Documento fisso: uguale per ogni commessa (rif. Scheda di produzione, commessa {fascicolo.commessa || fascicolo.numero}).
        </Text>
        <FlussogrammaSvg />
      </Page>
    </Document>
  );
}
