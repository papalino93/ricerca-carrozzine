import { NextResponse } from "next/server";
import { isDriveConfigured, isFascicoliDriveConfigured } from "@/lib/drive";

export const runtime = "nodejs";

// Nessun dato sensibile restituito (solo due booleani): serve a DocumentPanel
// per decidere se mostrare la sezione di firma digitale, e a
// FascicoloEditorClient per sapere in anticipo se il caricamento di un
// allegato PDF funzionerà, senza dover far arrivare la configurazione del
// Drive fin dentro ogni componente client che genera o carica un documento.
// Le due cartelle sono facoltative e indipendenti (vedi drive.ts): un
// singolo booleano "configurato" avrebbe potuto essere vero per l'una e
// falso per l'altra senza che l'interfaccia se ne accorgesse.
export async function GET() {
  return NextResponse.json({
    configurato: isDriveConfigured(),
    fascicoliConfigurato: isFascicoliDriveConfigured(),
  });
}
