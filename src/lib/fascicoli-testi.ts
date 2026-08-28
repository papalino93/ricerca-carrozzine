/**
 * Testi legali/normativi del fascicolo plantare, trascritti dal documento
 * Word originale ("Fascicolazione per i Plantari su misura") così come
 * sono: nessun riferimento normativo nuovo, nessuna modifica del
 * significato giuridico (vedi il report di analisi del documento
 * originale). Tenuti qui, separati dal template grafico
 * (FascicoloDocument.tsx) e dai dati (fascicoli.ts), in modo che cambiare
 * la grafica del PDF in futuro non richieda toccare questi testi e
 * viceversa.
 *
 * NOTA: come le condizioni generali/informativa privacy già presenti in
 * settings.ts, restano testi da fare rivedere a un legale/consulente
 * privacy prima dell'uso con dati reali — qui sono solo la trascrizione
 * fedele di quanto già in uso su carta.
 */

export const CONDIZIONI_GENERALI_FORNITURA = `Gli ordini non sono vincolanti per Medical Center srl, che ha facoltà di dare o non dare esecuzione agli stessi a propria discrezione; inoltre Medical Center srl ha facoltà di recedere dal contratto o di sospenderne l'esecuzione in qualunque momento, senza preavviso e senza che nulla sia dovuto all'acquirente, né a titolo di corrispettivo per il recesso né a titolo di danni, salvo la restituzione integrale dell'eventuale deposito cauzionale infruttifero.

Il termine di consegna ha valore esclusivamente indicativo e mai tassativo: un eventuale ritardo non può costituire fonte di risarcimento del danno né causa di risoluzione del contratto.

Le merci sono vendute franco magazzino Medical Center srl e viaggiano ad esclusivo rischio e pericolo dell'acquirente, che se ne assume anche le eventuali spese di trasporto. L'acquirente può ritirare senza spese aggiuntive la merce ordinata presso il negozio di Scandicci (FI), Via di Scandicci 55/b.

Sono ritenuti validi solo i pagamenti effettuati direttamente a Medical Center srl.

Le condizioni di garanzia, le controindicazioni e le modalità di manutenzione e conservazione delle merci vendute sono riportate nel libretto "Note informative ed istruzioni per l'uso" consegnato all'acquirente insieme alle merci.

Medical Center srl non accetta reclami trascorsi 10 giorni dalla consegna della merce, o se la stessa risulta alterata anche da uso o conservazione inadatti.

Il foro competente è quello di Firenze.`;

// Versione allineata al "Fascicolo MODELLO DEFINITIVO" fornito da Medical
// Center: stesso contenuto giuridico della prima trascrizione (vedi git
// history), solo riscritto nella forma più snella che l'azienda ha
// approvato come definitiva.
export const INFORMATIVA_PRIVACY_FASCICOLO = `Informativa per il trattamento dei dati personali comuni e particolari (artt. 13 e 14 del Regolamento GDPR 679/2016).

Gentile Utente, Medical Center srl con sede in Scandicci CAP 50018 Via di Scandicci 55/b Le rilascia, ai sensi e per gli effetti degli artt. 13 e 14 del Regolamento GDPR 679/2016, le informazioni relative al trattamento dei dati personali Suoi o del soggetto del quale Lei esercita la rappresentanza legale, ivi compresi quelli particolari ed idonei a rivelare lo stato di salute.

1.1 Finalità del trattamento — a) i dati personali e particolari raccolti sono necessari per le attività di progettazione e realizzazione di dispositivi ortopedici su misura o di serie personalizzati, così come per i servizi accessori quali il monitoraggio dei dispositivi forniti, come richiesto dal D.Lgs. 46/97 e s.m.i.; b) attività professionali, amministrative e di gestione operativa legate ai servizi forniti, ivi comprese quelle connesse alla trasmissione dei dati agli enti competenti, come previsto da norme fiscali e regolamenti vigenti per l'erogazione di assistenza protesica verso gli assistiti del SSN (DM 332/99).

1.2 Titolare e responsabile del trattamento — Il Titolare è: Amulfi Claudia, contattabile a: email claudia.amulfi@hotmail.it, tel. 333 945 5188. Il medesimo soggetto è anche Responsabile nominato del trattamento.

1.3 Ambito di comunicazione — I dati non verranno diffusi all'esterno dell'azienda ma possono essere comunicati, per le finalità indicate, a soggetti terzi che collaborano con Medical Center per l'esecuzione delle procedure amministrative e fiscali richieste dalle norme vigenti.

1.4 Periodo di conservazione — I dati verranno conservati per 10 anni per i dati di rilievo fiscale e per 5 anni per i dati necessari alla fascicolazione tecnica dei dispositivi e alla sorveglianza post-vendita, salvo tempi più lunghi in caso di procedure, accertamenti o contestazioni in corso.

1.5 Diritti dell'utente — L'utente ha diritto, ai sensi degli artt. 15-20 del Regolamento, di ottenere conferma dell'esistenza dei propri dati, riceverne copia, chiederne la cancellazione, rettifica, limitazione o opposizione al trattamento, richiedere la portabilità dei dati e proporre reclamo a un'Autorità di controllo. Le richieste vanno indirizzate per iscritto al Titolare, che risponderà entro 1 mese.

1.6 Conseguenze del mancato consenso — Fatti salvi i casi di urgenza/emergenza sanitaria, il mancato conferimento dei dati e il mancato consenso al trattamento per le finalità di cui al punto 1.1 rende di fatto impossibile l'accesso alle prestazioni erogate da Medical Center.

2.1 Modalità ed efficacia del consenso — Il consenso viene manifestato con la sottoscrizione del presente modulo. Solo l'interessato può prestarlo; se minorenne o sotto tutela, lo esprime chi ne ha la potestà legale. Ha validità fino a revoca o modifica; per i minori decade al raggiungimento della maggiore età. Il tutore, per conto dell'utente tutelato, allega la documentazione dell'Autorità Giudiziaria o un'autodichiarazione di potestà tutoria. Chi non può firmare per analfabetismo o impedimento fisico può esprimere il consenso verbalmente o con altri modi inequivocabili, di cui l'operatore dà atto. La consegna del modulo (non l'espressione del consenso in sé) è delegabile a persona munita di documento valido proprio e del delegante.`;

export const DICHIARAZIONE_CONFORMITA_TESTO = `Si dichiara che il prodotto sopra indicato è stato realizzato secondo la documentazione tecnica relativa ed è classificato, ai sensi del Regolamento (UE) 2017/745, come dispositivo medico su misura non invasivo di classe I. Non è uno strumento di misura, non è destinato a indagini cliniche, è commercializzato in confezione non sterile e soddisfa i requisiti essenziali e le disposizioni applicabili del Regolamento.`;

// Attestazione fissa di chi realizza e fabbrica il dispositivo (dato
// aziendale, non per-fascicolo): presente due volte nel documento
// originale (dichiarazione di conformità e note informative finali), qui
// un solo posto da tenere aggiornato se cambiano tecnico o codice fabbricante.
export const ATTESTAZIONE_FABBRICANTE = {
  tecnico: "Realizzati dai T.O. Amulfi Claudia — Iscrizione Albo TSRM PSTRP n. 9",
  fabbricante: "Fabbricati da Medical Center s.r.l. (ITCA01058106)",
};

export const NOTE_INFORMATIVE_USO = {
  descrizione: `Questi presidi hanno lo scopo di migliorare l'appoggio plantare ottimizzando la postura e curando alcune patologie del soggetto. Particolare cura è stata posta nella scelta dei materiali impiegati, caratterizzati da morbidezza e tracciabilità, controllata da apposite procedure per l'individuazione dei lotti di provenienza.`,
  indicazioniUso: `Servono a prevenire e curare patologie a carico dell'apparato scheletrico. 1° giorno: un'ora d'uso. 2°-8° giorno: aumentare l'uso di un'ora al giorno. Dall'8° giorno al 1° controllo: uso quotidiano, seguendo il principio "maggior uso, maggior beneficio".`,
  comeSiUsano: `Indossare con l'impronta rivolta verso l'alto, rispettando il lato sinistro/destro indicato sul dispositivo.`,
  controindicazioni: `Trattandosi di dispositivi non invasivi, è sufficiente attenersi a quanto indicato al punto precedente. Il perdurare dell'uso oltre un anno senza previo controllo del fornitore è sconsigliato.`,
  manutenzione: `Pulire con una spugna umida, asciugare prima del riutilizzo, preservare da fonti di calore, non immergere in acqua o altri liquidi. Dispositivi non biodegradabili: a fine vita utile, smaltire come rifiuto indifferenziato.`,
  garanzia: `Validità 1 anno dalla consegna, subordinata alle validazioni previste entro il 2°, 6° e 12° mese (da effettuarsi presso Medical Center). La garanzia non è riconosciuta per usura causata da eccessiva sudorazione o uso improprio.`,
};

export const CONTROINDICAZIONI_FORNITORE = [
  "L'uso scorretto ed improprio dei presidi (inversione plantare destro con sinistro).",
  "Il perdurare dell'uso oltre un anno senza previo controllo da parte del fornitore.",
];

/**
 * Allegato A — Flussogramma di progettazione (ISO 13485, punti 7.3.1-7.3.7):
 * procedura aziendale fissa, identica per ogni commessa (vedi analisi del
 * documento originale). Non è farina di questo modulo: è il piano di
 * progetto qualità già in uso, qui reso disponibile come allegato
 * opzionale invece che ristampato manualmente ogni volta.
 */
export const ALLEGATO_A_FASI: { fase: string; descrizione: string; documenti: string; responsabile: string }[] = [
  { fase: "1 — Pianificazione (7.3.1)", descrizione: "Date e responsabili", documenti: "Scheda di commessa · Registro appuntamenti", responsabile: "AC+CA" },
  { fase: "2 — Elementi in ingresso (7.3.2)", descrizione: "Requisiti", documenti: "Scheda di commessa (Fase 1) · Richiesta medica · Doc. diagnostica", responsabile: "AC+CA" },
  { fase: "3 — Elementi in uscita (7.3.3)", descrizione: "Dati misurabili per le caratteristiche", documenti: "Rilevazione impronta / schiuma fenolica (Fase 2)", responsabile: "AC+CA" },
  { fase: "4 — Riesame P&S (7.3.4)", descrizione: "Dei calcoli o del disegno", documenti: "Sui disegni/calcoli (Fasi 1-4) · Scheda di commessa (Fase 5)", responsabile: "AC+CA" },
  { fase: "5 — Verifica P&S (7.3.5)", descrizione: "Tra prodotto e dati in ingresso", documenti: "Scheda di commessa (Fase 8)", responsabile: "AC+CA" },
  { fase: "6 — Validazione P&S (7.3.6)", descrizione: "Il prodotto va bene?", documenti: "Alla consegna · Scheda di commessa (Fasi 10 e 13)", responsabile: "AC+CA" },
  { fase: "7 — Controllo modifiche P&S (7.3.7)", descrizione: "Se ritenute necessarie", documenti: "Scheda di commessa (Fase 12)", responsabile: "AC+CA" },
];
