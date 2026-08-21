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
- **Ciclo di vita del noleggio**: azioni dedicate per portare un
  dispositivo da disponibile a noleggiato (assegnazione cliente/telefono/
  contratto), poi a restituito (torna "da pulire") e infine di nuovo
  disponibile dopo la sanificazione. Ogni passaggio viene registrato nella
  tab `Storico` del foglio.
- **Utenti multipli**: da Impostazioni azienda si possono autorizzare altri
  account (username/password) per l'accesso a `/admin`, oltre alle
  credenziali principali impostate su Vercel.
- **Documento di noleggio** (da ogni scheda, in ricerca e in admin): genera
  un "Verbale di consegna" o "Verbale di restituzione" in PDF, con i campi
  precompilati ma modificabili prima del download.

## Stack

Next.js (App Router) · TypeScript · Google Sheets come "database" ·
`@react-pdf/renderer` per i PDF (generati lato server, nessun browser
headless: compatibile con le funzioni serverless di Vercel) · `sharp` per
comprimere il logo aziendale, salvato come data URI nel foglio stesso
(nessuno storage esterno).

## Il foglio Google Sheets

Un solo foglio Google, con quattro tab. Tutte si creano da sole alla prima
scrittura se non esistono ancora — non serve prepararle a mano.

**`Dispositivi`** (riga di intestazione + una riga per unità):

```
Codice | Categoria | Marca | Modello | Larghezza | Stato | Cliente | Telefono | Contratto | Dal | Sanificazione | Nota
```

- `Stato` è uno tra: `disponibile`, `noleggiato`, `da_pulire`, `guasto`,
  `da_verificare`.
- `Larghezza`, `Cliente`, `Telefono`, `Contratto`, `Dal`, `Sanificazione`,
  `Nota` possono restare vuoti — utile per dispositivi diversi dalle
  carrozzine, dove la larghezza seduta non ha senso.
- `Dal` e `Sanificazione` in formato `AAAA-MM-GG`.
- Questi campi vengono aggiornati automaticamente dalle azioni di ciclo di
  vita ("Noleggia", "Segna restituito", "Segna sanificato") in `/admin`;
  restano comunque modificabili a mano dal form o dal foglio stesso.

**`Storico`** (riga di intestazione + una riga per evento, scritta in coda
automaticamente dalle azioni di ciclo di vita):

```
Data | Codice | Evento | Cliente | Telefono | Contratto | Nota
```

`Evento` è uno tra `noleggio`, `restituzione`, `sanificazione`. È un
registro di sola consultazione: aprilo direttamente su Google Sheets per
vedere lo storico completo di un dispositivo (non c'è ancora una vista
dedicata dentro l'app).

**`Utenti`** (riga di intestazione + una riga per utente autorizzato):

```
Username | PasswordHash
```

Gestita da `/admin/impostazioni` (sezione "Utenti autorizzati") — non va
compilata a mano: le password sono salvate come hash (scrypt + salt), mai
in chiaro.

**`Impostazioni`** (riga di intestazione + una sola riga di dati):

```
RagioneSociale | Indirizzo | PartitaIVA | Telefono | LogoURL | CondizioniGenerali
```

`LogoURL` e `CondizioniGenerali` vengono scritti automaticamente
dall'app (upload del logo e modulo Impostazioni) — non serve compilarli a
mano.

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
- `ADMIN_USER` / `ADMIN_PASSWORD` — credenziali "principali" della Basic
  Auth per `/admin`. Sono le uniche che funzionano anche se il foglio
  Google non è raggiungibile (utili come accesso di emergenza).

## Autorizzare altri utenti

`ADMIN_USER`/`ADMIN_PASSWORD` sono pensate per un solo account "titolare".
Per farne usare altri (altri operatori, colleghi, ecc.) senza condividere
quella password: vai su `/admin/impostazioni`, sezione **"Utenti
autorizzati"**, e aggiungi username e password per ciascuno. Vengono
salvati nella tab `Utenti` del foglio (password come hash scrypt, mai in
chiaro) e possono accedere a `/admin` con le proprie credenziali da subito,
senza redeploy né variabili d'ambiente da toccare. Per revocare l'accesso
a qualcuno, usa "Revoca" nella stessa sezione.

Non c'è (ancora) un "password dimenticata?" self-service via email: se un
utente perde la password, chi ha accesso a Impostazioni azienda usa
"Reimposta password" sulla riga di quell'utente per impostargliene una
nuova da comunicargli direttamente.

## Logo aziendale (nessuno storage esterno)

Il logo caricato da **Impostazioni azienda** non va su Vercel Blob o altri
storage: la route `/api/upload-logo` lo ridimensiona e comprime con `sharp`
(convertendolo in JPEG, sfondo trasparente appiattito su bianco) finché non
entra in una cella del foglio Google come **data URI**, poi lo scrive
direttamente nella colonna `LogoURL` della tab `Impostazioni`. Zero
variabili d'ambiente da configurare, zero account terzi.

Il limite è quello di una cella di Google Sheets (50.000 caratteri): per un
logo semplice non è un problema, ma un'immagine molto ricca di dettagli
potrebbe non entrarci nemmeno dopo la compressione massima — in quel caso
l'upload risponde con un errore che chiede un'immagine più semplice o più
piccola.

**Primo caricamento del logo**: vai su `/admin/impostazioni` (ti verrà
richiesta la Basic Auth), seleziona il file immagine sotto "Logo
aziendale" — viene caricato e compresso subito e l'anteprima compare
immediatamente — poi premi "Salva impostazioni" per scrivere anche gli
altri campi. Finché non carichi un logo, i documenti PDF mostrano solo la
ragione sociale in testo, senza uno spazio vuoto al posto del logo.

## Icone, favicon e immagine di condivisione (branding dell'app)

Le icone (favicon, home screen/PWA, apple-touch) e l'immagine mostrata
quando il link viene condiviso (WhatsApp, social, ecc.) **non sono il logo
aziendale** di cui sopra — sono il logo dell'app stessa, fisso nel codice:

- Sorgente: `scripts/brand-src/logo-source.png` (immagine trasparente) e
  `scripts/brand-src/og-template.html` (layout della card di condivisione).
- Rigenerazione: `node scripts/generate-icons.mjs` (favicon, icone PWA,
  apple-touch) e `node scripts/generate-og-image.mjs` (immagine 1200×630
  per Open Graph/Twitter Card) — quest'ultimo richiede Chromium
  (`playwright-core`, già tra le devDependencies).
- Output in `public/`: `favicon-32.png`, `icon-192.png`, `icon-512.png`,
  `apple-icon.png`, `logo.png` (usato in-app nell'header), `og-image.png`.
- Collegati in `src/app/layout.tsx` (metadata `icons`/`openGraph`/
  `twitter`) e `src/app/manifest.ts` (manifest PWA).

Per cambiare il logo dell'app: sostituisci
`scripts/brand-src/logo-source.png` con la nuova immagine (idealmente
quadrata, sfondo trasparente) e rilancia i due script.

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
3. Dopo il primo deploy, vai su `/admin/impostazioni` e carica il logo e i
   dati aziendali.

## Struttura del progetto

```
src/
  app/
    page.tsx                 ricerca pubblica
    admin/page.tsx            elenco/CRUD dispositivi (Basic Auth)
    admin/impostazioni/       dati aziendali + upload logo (Basic Auth)
    api/dispositivi/          GET pubblico, POST/DELETE riservati
    api/dispositivi/[codice]/eventi/  noleggio/restituzione/sanificazione (riservato)
    api/impostazioni/         GET/POST riservati (protetti dal proxy)
    api/upload-logo/          comprime il logo e lo salva come data URI (riservato)
    api/utenti/                GET/POST/DELETE utenti autorizzati (protetti dal proxy)
    api/documento/            genera il PDF del verbale (pubblico)
  components/                 componenti React (ricerca, admin, pannello documento)
  lib/
    device-types.ts           tipi/costanti condivisi anche dai componenti client
    devices.ts, settings.ts   lettura/scrittura del foglio Google (solo server)
    history.ts                registro eventi (tab Storico, solo server)
    users.ts                   utenti autorizzati aggiuntivi (tab Utenti, solo server)
    sheets.ts                 client Google Sheets (solo server, crea le tab mancanti)
    basic-auth.ts             verifica le credenziali (env oppure tab Utenti)
    pdf/VerbaleDocument.tsx   template del verbale di noleggio
  proxy.ts                    Basic Auth su /admin e sulle API di scrittura (gira su Node.js)
scripts/
  generate-icons.mjs          favicon/icone PWA dal logo sorgente (sharp)
  generate-og-image.mjs       immagine di condivisione 1200x630 (playwright)
  brand-src/                  logo sorgente e template della card OG
```
