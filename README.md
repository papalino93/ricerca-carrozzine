# Ricerca Ausili

Ricerca disponibilità e gestione del noleggio di carrozzine e altri
ausili/dispositivi (deambulatori, letti, ecc.): un magazzino su Google
Sheets, una ricerca pubblica per larghezza/categoria/stato, un'area di
amministrazione per aggiungere e modificare le unità e generare i
documenti di noleggio in PDF.

## Cosa fa

- **Ricerca pubblica** (`/`): filtra per larghezza seduta, categoria, stato
  e testo libero (cliente, marca, modello, codice). Non richiede login.
- **Amministrazione** (`/admin`, `/admin/impostazioni`): protetta da Basic
  Auth, permette di aggiungere/modificare/eliminare i dispositivi e
  configurare i dati aziendali.
- **Documento di noleggio** (da ogni scheda, in ricerca e in admin): genera
  un "Verbale di consegna" o "Verbale di restituzione" in PDF, con i campi
  precompilati ma modificabili prima del download.

## Stack

Next.js (App Router) · TypeScript · Google Sheets come "database" ·
`@react-pdf/renderer` per i PDF (generati lato server, nessun browser
headless: compatibile con le funzioni serverless di Vercel) · `@vercel/blob`
per il logo aziendale.

## Il foglio Google Sheets

Un solo foglio Google, con due tab:

**`Dispositivi`** (riga di intestazione + una riga per unità):

```
Codice | Categoria | Marca | Modello | Larghezza | Stato | Cliente | Telefono | Dal | Sanificazione | Nota
```

- `Stato` è uno tra: `disponibile`, `noleggiato`, `da_pulire`, `guasto`,
  `da_verificare`.
- `Larghezza`, `Cliente`, `Telefono`, `Dal`, `Sanificazione`, `Nota` possono
  restare vuoti — utile per dispositivi diversi dalle carrozzine, dove la
  larghezza seduta non ha senso.
- `Dal` e `Sanificazione` in formato `AAAA-MM-GG`.

**`Impostazioni`** (riga di intestazione + una sola riga di dati):

```
RagioneSociale | Indirizzo | PartitaIVA | Telefono | LogoURL | CondizioniGenerali
```

`LogoURL` e `CondizioniGenerali` vengono scritti automaticamente
dall'app (upload del logo e modulo Impostazioni) — non serve compilarli a
mano, ma l'app funziona anche se le tab non esistono ancora: le crea alla
prima scrittura.

### Creare l'account di servizio Google

1. Su [Google Cloud Console](https://console.cloud.google.com/), crea (o
   riusa) un progetto, poi abilita la **Google Sheets API**.
2. In **IAM e amministrazione → Service Account**, crea un account di
   servizio. Genera una chiave in formato JSON e scaricala.
3. Dal JSON scaricato prendi `client_email` e `private_key`.
4. Crea il foglio Google Sheets (con le due tab sopra, anche solo con
   l'intestazione) e **condividilo** con l'indirizzo email dell'account di
   servizio (`client_email`), con permesso di **Editor**.
5. Copia l'ID del foglio dall'URL:
   `https://docs.google.com/spreadsheets/d/{QUESTO_È_L_ID}/edit`.

### Variabili d'ambiente

Vedi `.env.example`. In sintesi:

- `GOOGLE_SHEETS_SPREADSHEET_ID` — l'ID del foglio.
- `GOOGLE_SHEETS_CLIENT_EMAIL` — il `client_email` dell'account di servizio.
- `GOOGLE_SHEETS_PRIVATE_KEY` — il `private_key` dell'account di servizio
  (incolla il valore intero, incluse le righe `BEGIN/END PRIVATE KEY`; se il
  tuo editor di variabili non accetta più righe, sostituisci gli a-capo con
  `\n` letterali — l'app li normalizza automaticamente).
- `ADMIN_USER` / `ADMIN_PASSWORD` — credenziali della Basic Auth per
  `/admin`.

## Vercel Blob Storage (logo aziendale)

Il logo caricato da **Impostazioni azienda** viene salvato su Vercel Blob
Storage, non nel repository né nel foglio (nel foglio viene salvato solo
l'URL pubblico del file).

Per abilitarlo sul progetto Vercel:

1. Nel progetto su [vercel.com](https://vercel.com), vai su
   **Storage → Create Database → Blob**.
2. Crea lo store (piano gratuito incluso) e collegalo al progetto: Vercel
   imposta automaticamente la variabile `BLOB_READ_WRITE_TOKEN`.
3. Se sviluppi in locale, copia quel token in `.env.local` come
   `BLOB_READ_WRITE_TOKEN` (lo trovi in **Storage → il tuo Blob store →
   Settings**, oppure con `vercel env pull`).

**Primo caricamento del logo**: vai su `/admin/impostazioni` (ti verrà
richiesta la Basic Auth), seleziona il file immagine sotto "Logo
aziendale" — viene caricato subito e l'URL compare in anteprima — poi premi
"Salva impostazioni" per scrivere anche gli altri campi. Finché non carichi
un logo, i documenti PDF mostrano solo la ragione sociale in testo, senza
uno spazio vuoto al posto del logo.

## Documenti di noleggio (PDF)

Dalla scheda di un dispositivo (sia in ricerca pubblica che in admin), il
pulsante **"Genera documento"** apre un pannello con due opzioni — Verbale
di consegna o di restituzione — con i campi già precompilati dai dati del
dispositivo/cliente ma modificabili (data, note, numero contratto) prima di
premere **"Scarica PDF"**. Il PDF viene generato lato server con
`@react-pdf/renderer` (nessun browser headless), quindi funziona anche
sulle funzioni serverless di Vercel.

> ⚠️ **Il testo delle "condizioni generali"** che compare in piccolo in
> fondo al documento (modificabile da Impostazioni azienda) è un
> **segnaposto**, non una clausola legale verificata. Fallo rivedere e
> integrare da un commercialista o consulente legale prima di usarlo con i
> clienti reali.

## Sviluppo locale

```bash
cp .env.example .env.local   # compila almeno ADMIN_USER/ADMIN_PASSWORD
                              # e le variabili di Google Sheets
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Senza le variabili di
Google Sheets l'app parte comunque: la ricerca e l'admin mostrano un
messaggio d'errore invece dell'elenco, finché non configuri il foglio.

## Deploy su Vercel

1. Importa il repository su [vercel.com/new](https://vercel.com/new).
2. In **Settings → Environment Variables** aggiungi `ADMIN_USER`,
   `ADMIN_PASSWORD`, `GOOGLE_SHEETS_SPREADSHEET_ID`,
   `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`.
3. Abilita Vercel Blob Storage come descritto sopra (imposta
   `BLOB_READ_WRITE_TOKEN` automaticamente).
4. Dopo il primo deploy, vai su `/admin/impostazioni` e carica il logo e i
   dati aziendali.

## Struttura del progetto

```
src/
  app/
    page.tsx                 ricerca pubblica
    admin/page.tsx            elenco/CRUD dispositivi (Basic Auth)
    admin/impostazioni/       dati aziendali + upload logo (Basic Auth)
    api/dispositivi/          GET pubblico, POST/DELETE riservati
    api/impostazioni/         GET/POST riservati (protetti dal proxy)
    api/upload-logo/          upload immagine su Vercel Blob (riservato)
    api/documento/            genera il PDF del verbale (pubblico)
  components/                 componenti React (ricerca, admin, pannello documento)
  lib/
    device-types.ts           tipi/costanti condivisi anche dai componenti client
    devices.ts, settings.ts   lettura/scrittura del foglio Google (solo server)
    sheets.ts                 client Google Sheets (solo server)
    basic-auth.ts             verifica delle credenziali Basic Auth
    pdf/VerbaleDocument.tsx   template del verbale di noleggio
  proxy.ts                    Basic Auth su /admin e sulle API di scrittura
```
