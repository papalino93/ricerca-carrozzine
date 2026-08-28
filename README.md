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
- **Fascicoli Plantari** (`/admin/fascicoli`): fascicolo digitale per i
  plantari su misura (anagrafica, privacy, anamnesi, esame del piede,
  prescrizione, produzione, conformità, consegna), con generazione del PDF
  finale pronto per la stampa — vedi la sezione dedicata più sotto.

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
Codice | Categoria | Marca | Modello | Larghezza | Stato | Cliente | Telefono | Contratto | Dal | Sanificazione | Nota | Foto | Sottocategoria
```

- `Stato` è uno tra: `disponibile`, `noleggiato`, `da_pulire`, `guasto`,
  `da_verificare`.
- `Larghezza`, `Cliente`, `Telefono`, `Contratto`, `Dal`, `Sanificazione`,
  `Nota`, `Foto`, `Sottocategoria` possono restare vuoti — utile per
  dispositivi diversi dalle carrozzine, dove la larghezza seduta non ha
  senso.
- `Dal` e `Sanificazione` in formato `AAAA-MM-GG`.
- Questi campi vengono aggiornati automaticamente dalle azioni di ciclo di
  vita ("Noleggia", "Segna restituito", "Segna sanificato") in `/admin`;
  restano comunque modificabili a mano dal form o dal foglio stesso.
- `Foto` è la foto del dispositivo, salvata come **data URI** direttamente
  nella cella (stesso meccanismo del logo aziendale, vedi sotto): si
  carica/rimuove dal form "Modifica" in `/admin` (bottone "Carica
  foto"/"Rimuovi foto"), niente storage esterno. Non contenendo dati del
  cliente, è visibile anche nella ricerca pubblica.
- `Categoria` è il reparto gestito da Impostazioni (Carrozzine, Rollatori,
  ecc. — vedi tab `Categorie` più sotto), mentre `Sottocategoria` è un
  sottotipo libero facoltativo all'interno della categoria (es. per le
  carrozzine: Autospinta, Transito, Bimbi). Entrambi compaiono come filtro
  nella ricerca pubblica; il filtro sottocategoria si popola solo se
  qualche dispositivo lo usa.

**`Storico`** (riga di intestazione + una riga per evento, scritta in coda
automaticamente dalle azioni di ciclo di vita):

```
Data | Codice | Evento | Cliente | Telefono | Contratto | Nota
```

`Evento` è uno tra `noleggio`, `restituzione`, `sanificazione`. È un
registro di sola consultazione, scritto in coda automaticamente e mai
modificato: consultabile sia dal bottone "Storico" di ogni dispositivo in
`/admin`, sia direttamente su Google Sheets.

**`Utenti`** (riga di intestazione + una riga per utente autorizzato):

```
Username | PasswordHash
```

Gestita da `/admin/impostazioni` (sezione "Utenti autorizzati") — non va
compilata a mano: le password sono salvate come hash (scrypt + salt), mai
in chiaro.

**`Categorie`** (riga di intestazione + una riga per categoria):

```
Nome
```

Gestita da `/admin/impostazioni` (sezione "Categorie ausili") — ogni
dispositivo appartiene a una di queste categorie (usate come filtro nella
ricerca pubblica e come scelta nel form dispositivo). Non compilare a
mano finché non serve: alla primissima richiesta dopo il rilascio di
questa funzione il foglio viene creato automaticamente con la categoria
"Carrozzine", assegnata anche a tutti i dispositivi già presenti in
magazzino (che finora erano comunque tutte carrozzine). Da lì puoi
aggiungere altre categorie (rollatori, stampelle, magnetoterapia, ecc.) —
non si può eliminare una categoria ancora usata da qualche dispositivo.

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
- `GOOGLE_SHEETS_BACKUP_SPREADSHEET_ID` — facoltativa. ID di un SECONDO
  foglio Google Sheets, separato da quello principale (idealmente in un
  account Google diverso), condiviso con lo stesso `client_email` e usato
  solo come destinazione di backup (vedi Impostazioni → Backup). Senza,
  il backup continua a scrivere solo nel foglio principale, come sempre.
- `GOOGLE_DRIVE_FOLDER_ID` — facoltativa. ID di una cartella Google Drive
  (dall'URL: `https://drive.google.com/drive/folders/{QUESTO_È_L_ID}`),
  condivisa con lo stesso `client_email` come **Editor**, dove archiviare i
  verbali firmati digitalmente (vedi "Genera documento" → Firma digitale).
  Serve anche abilitare la **Google Drive API** sullo stesso progetto
  Google Cloud usato per Sheets. Senza questa variabile, la sezione di
  firma digitale resta nascosta e tutto funziona come prima (verbale da
  scaricare e stampare).

## Meteo nella home (nessuna configurazione)

Il riquadro in alto nella home mostra il meteo di Scandicci — condizioni
attuali, minima/massima di oggi e previsione di domani — accanto a data e
ora. I dati arrivano da [Open-Meteo](https://open-meteo.com): niente
registrazione, niente chiave, niente costi, quindi non c'è alcuna variabile
d'ambiente da impostare (vedi `src/lib/weather.ts`, coordinate del negozio
incluse nel file).

La risposta viene tenuta in cache mezz'ora, e se il servizio non risponde
entro 4 secondi il riquadro mostra semplicemente data e ora: la home si apre
comunque, il meteo è un di più.

Nota: il piano gratuito di Open-Meteo è pensato per usi non commerciali.
L'utilizzo qui è di pochissime chiamate al giorno per una schermata interna;
se in futuro si volesse essere formalmente in regola con un uso commerciale,
esiste un piano a pagamento — oppure basta togliere la chiamata a
`getWeather()` in `src/app/page.tsx` e il riquadro torna a mostrare solo
data e ora.

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

## Logo aziendale e foto dispositivi (nessuno storage esterno)

Il logo caricato da **Impostazioni azienda** e la foto di ogni dispositivo
non vanno su Vercel Blob, Google Drive o altri storage esterni: entrambi
passano dall'helper condiviso `src/lib/image-to-data-uri.ts`, che
ridimensiona e comprime l'immagine con `sharp` (convertendola in JPEG,
sfondo trasparente appiattito su bianco) finché non entra in una cella del
foglio Google come **data URI** — il logo nella colonna `LogoURL` della
tab `Impostazioni`, la foto nella colonna `Foto` della tab `Dispositivi`.
Zero variabili d'ambiente da configurare, zero account terzi.

(Per i documenti PDF/scheda tecnica degli ausili non è invece prevista una
soluzione: un account di servizio Google non ha una propria quota di
storage su Drive, nemmeno in una cartella condivisa come editor — serve un
Drive condiviso (Google Workspace) o la delega a livello di dominio, che
questo progetto non usa. Solo la foto è quindi supportata.)

Il limite è quello di una cella di Google Sheets (50.000 caratteri): per un
logo o una foto semplici non è un problema, ma un'immagine molto ricca di
dettagli potrebbe non entrarci nemmeno dopo la compressione massima — in
quel caso l'upload risponde con un errore che chiede un'immagine più
semplice o più piccola.

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

## Fascicoli Plantari

Sostituisce il fascicolo cartaceo "Fascicolazione per i Plantari su
misura" (10 pagine Word, dati ripetuti a mano più volte) con un fascicolo
digitale: il cliente si cerca/crea una sola volta, ogni sezione si compila
una volta sola, il PDF finale recupera automaticamente tutti i dati.

**Dove si trova**: `/admin/fascicoli` (dashboard), `/admin/fascicoli/nuovo`
(cerca cliente/crea fascicolo), `/admin/fascicoli/archivio` (elenco con
filtri), `/admin/fascicoli/[numero]` (editor a sezioni).

**Dati**: due nuove tab nel foglio Google Sheets, stesso "database" di
sempre — nessun servizio nuovo.

- `FascicoliPlantari`: una riga per fascicolo (numero progressivo
  `PL-<anno>-0001`, cliente, commessa collegata, stato, date, operatore),
  con l'intero contenuto clinico (anamnesi, esame del piede, prescrizione,
  produzione, consegna, consensi) in un'unica colonna JSON — evita una tab
  con decine di colonne per ogni singola checkbox del fascicolo cartaceo.
- `FascicoliPdf`: registro dei PDF generati (data, versione, operatore,
  link Drive se archiviato).
- L'anagrafica cliente resta quella di sempre (tab `Clienti`, vedi sopra):
  il fascicolo referenzia il cliente per nome, non lo duplica. È stato
  aggiunto solo il campo `CodiceFiscale`, richiesto dal fascicolo ma
  assente finora.

**PDF**: generato con lo stesso motore già in uso (`@react-pdf/renderer`),
template separato dal contenuto (`src/lib/pdf/FascicoloDocument.tsx`),
struttura allineata al "Fascicolo MODELLO DEFINITIVO" di Medical Center (11
sezioni numerate: dati cliente e commessa, anamnesi, documentazione medica,
scheda rilevazione obiettiva, piano appuntamenti, dichiarazione di
conformità, scheda di produzione, comunicazione di avvenuta consegna,
condizioni generali, privacy, note informative/garanzia) — eliminando le
ripetizioni del documento Word originale (header, dati cliente, doppia
dichiarazione di conformità) senza togliere informazioni. Il flussogramma
di progettazione (Allegato A, procedura ISO 13485 fissa e identica per
ogni commessa) resta **fuori dal PDF per default**: si include come ultima
pagina solo spuntando "Includi l'Allegato A" nel tab Produzione, oppure si
stampa a parte con lo stesso pulsante.

**Archiviazione**: il PDF generato con "Scarica PDF" o "Genera fascicolo"
viene archiviato su Google Drive se è impostata
`GOOGLE_DRIVE_FASCICOLI_FOLDER_ID` (facoltativa; se assente, ricade sulla
stessa cartella di `GOOGLE_DRIVE_FOLDER_ID` usata per i verbali firmati —
vedi sopra). Senza nessuna delle due, il PDF resta comunque scaricabile,
solo non archiviato automaticamente in cloud: nessuna funzione si blocca,
manca solo il ritrovamento automatico da un altro PC.

**Versione**: ogni fascicolo tiene un numero di versione, incrementato ad
ogni PDF generato (non ad ogni autosave) — la cronologia dei PDF prodotti
per un fascicolo è in `FascicoliPdf`. Il salvataggio del contenuto è
automatico (autosave con qualche secondo di ritardo dopo l'ultima
modifica, più un pulsante "Salva" esplicito), con un avviso se si prova a
lasciare la pagina con modifiche non ancora salvate.

**Firma**: il PDF esce sempre con la riga della firma vuota, da firmare a
penna dopo la stampa — il flusso resta cartaceo per scelta. Il componente
di firma digitale su schermo già usato per i verbali di noleggio
(`SignaturePad`) non è collegato qui, ma il modello dati è già predisposto
(`consensi.firmaClienteUrl`) per attivarla in futuro senza modifiche allo
schema.

> ⚠️ **Punti da verificare prima dell'uso con dati reali** (segnalati in
> fase di analisi, non decisi unilateralmente): il modulo introduce per la
> prima volta dati sanitari nel gestionale, che oggi ha un solo livello di
> accesso (`/admin` protetto da un'unica Basic Auth, senza ruoli separati)
> — da valutare con un consulente privacy se serve un accesso più
> ristretto per questa sezione. I testi legali (informativa privacy,
> dichiarazione di conformità, condizioni di fornitura) sono trascritti dal
> fascicolo cartaceo esistente, non testi nuovi — comunque da far
> confermare a chi segue la parte legale/qualità prima dell'uso reale.

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
    admin/fascicoli/          dashboard, archivio, nuovo, editor (Basic Auth)
    api/dispositivi/          GET pubblico, POST/DELETE riservati
    api/dispositivi/[codice]/eventi/  noleggio/restituzione/sanificazione (riservato)
    api/impostazioni/         GET/POST riservati (protetti dal proxy)
    api/upload-logo/          comprime il logo e lo salva come data URI (riservato)
    api/utenti/                GET/POST/DELETE utenti autorizzati (protetti dal proxy)
    api/documento/            genera il PDF del verbale (pubblico)
    api/fascicoli/            CRUD fascicoli + generazione PDF (riservato)
  components/                 componenti React (ricerca, admin, pannello documento, fascicoli)
  lib/
    device-types.ts           tipi/costanti condivisi anche dai componenti client
    devices.ts, settings.ts   lettura/scrittura del foglio Google (solo server)
    history.ts                registro eventi (tab Storico, solo server)
    users.ts                   utenti autorizzati aggiuntivi (tab Utenti, solo server)
    sheets.ts                 client Google Sheets (solo server, crea le tab mancanti)
    basic-auth.ts             verifica le credenziali (env oppure tab Utenti)
    pdf/VerbaleDocument.tsx   template del verbale di noleggio
    fascicoli-types.ts        tipi/costanti dei Fascicoli Plantari (condivisi client/server)
    fascicoli.ts              lettura/scrittura fascicoli (tab FascicoliPlantari, solo server)
    fascicoli-testi.ts        testi legali del fascicolo plantare (trascritti dal cartaceo)
    fascicoli-pdf-log.ts      registro PDF generati (tab FascicoliPdf, solo server)
    pdf/FascicoloDocument.tsx        template del fascicolo plantare (documentazione cliente)
    pdf/ProcessoProduttivoDocument.tsx  template del processo produttivo (documentazione interna)
  proxy.ts                    Basic Auth su /admin e sulle API di scrittura (gira su Node.js)
scripts/
  generate-icons.mjs          favicon/icone PWA dal logo sorgente (sharp)
  generate-og-image.mjs       immagine di condivisione 1200x630 (playwright)
  brand-src/                  logo sorgente e template della card OG
```
