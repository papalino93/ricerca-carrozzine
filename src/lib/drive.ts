import "server-only";
import { Readable } from "node:stream";
import { google } from "googleapis";

let cachedAuth: InstanceType<typeof google.auth.JWT> | null = null;

// "drive.file": lo stesso account di servizio dei fogli Google, ma con un
// permesso volutamente più stretto di "drive" completo — può creare file
// solo dentro la cartella che gli è stata condivisa esplicitamente (vedi
// README), non leggere/scrivere nel resto del Drive di chi la condivide.
function getAuth() {
  if (cachedAuth) return cachedAuth;

  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "Credenziali Google mancanti: imposta GOOGLE_SHEETS_CLIENT_EMAIL e GOOGLE_SHEETS_PRIVATE_KEY (vedi README)."
    );
  }

  cachedAuth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return cachedAuth;
}

function getDriveApi() {
  return google.drive({ version: "v3", auth: getAuth() });
}

/**
 * true solo quando esiste una cartella Drive dedicata ai verbali firmati:
 * finché non è configurata, tutta la parte di firma digitale resta
 * nascosta nell'interfaccia (vedi DocumentPanel) — l'archiviazione
 * cartacea di oggi continua a funzionare esattamente come prima, senza
 * che nessuno debba vedere un pulsante che non può ancora usare.
 */
export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID);
}

function getFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) {
    throw new Error("Google Drive non configurato: imposta GOOGLE_DRIVE_FOLDER_ID (vedi README).");
  }
  return id;
}

async function uploadToFolder(filename: string, pdf: Buffer, folderId: string): Promise<string> {
  const drive = getDriveApi();
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: "application/pdf", body: Readable.from(pdf) },
    fields: "id, webViewLink",
  });

  const url = res.data.webViewLink;
  if (!url) {
    throw new Error("Caricamento su Drive riuscito ma senza link restituito da Google.");
  }
  return url;
}

/** Carica un PDF già pronto nella cartella Drive dedicata, restituendo un link condivisibile. */
export async function uploadSignedDocument(filename: string, pdf: Buffer): Promise<string> {
  return uploadToFolder(filename, pdf, getFolderId());
}

/**
 * Cartella Drive usata per archiviare i PDF dei fascicoli plantari.
 * Facoltativa e distinta da GOOGLE_DRIVE_FOLDER_ID: una cartella dedicata
 * separa i fascicoli (dati potenzialmente sanitari) dai verbali di
 * noleggio. Se non impostata, ricade sulla stessa cartella dei verbali
 * (GOOGLE_DRIVE_FOLDER_ID) invece di richiedere subito una seconda
 * configurazione — così chi ha già Drive attivo per i verbali lo ottiene
 * gratis anche qui.
 */
export function isFascicoliDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_DRIVE_FASCICOLI_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID);
}

function getFascicoliFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_FASCICOLI_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!id) {
    throw new Error(
      "Google Drive non configurato: imposta GOOGLE_DRIVE_FASCICOLI_FOLDER_ID (o GOOGLE_DRIVE_FOLDER_ID) per archiviare i PDF dei fascicoli (vedi README)."
    );
  }
  return id;
}

/** Carica il PDF di un fascicolo plantare nella cartella Drive dedicata (o
 * in quella dei verbali, se non ne è stata configurata una a parte). */
export async function uploadFascicoloPdf(filename: string, pdf: Buffer): Promise<string> {
  return uploadToFolder(filename, pdf, getFascicoliFolderId());
}
