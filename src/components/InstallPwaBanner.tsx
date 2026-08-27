"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ra-install-banner-dismissed";

/**
 * localStorage può LANCIARE (non solo restituire null) quando i cookie sono
 * bloccati, in alcune WebView aziendali o in iframe con storage partizionato.
 * Questo componente è montato nel layout radice: un'eccezione non gestita qui
 * farebbe comparire "Application error" al posto dell'INTERA applicazione,
 * su ogni pagina. Ogni accesso passa quindi da questi due helper.
 */
function safeGetDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function safeSetDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Storage non disponibile: il banner si chiude comunque per questa
    // sessione (vedi dismiss), semplicemente ricomparirà la prossima volta.
  }
}

/**
 * Suggerisce di installare il sito come app sulla schermata Home. Nascosto
 * via CSS su schermi larghi (vedi globals.css): su desktop non compare mai.
 *
 * iOS Safari non ha un prompt di installazione nativo: mostriamo le
 * istruzioni per "Condividi → Aggiungi alla schermata Home". Su Android/
 * Chrome intercettiamo l'evento `beforeinstallprompt` e offriamo un
 * pulsante che lo richiama direttamente.
 */
export function InstallPwaBanner() {
  const [mode, setMode] = useState<"none" | "ios" | "android">("none");
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (safeGetDismissed()) return;

    let isStandalone = false;
    try {
      isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    } catch {
      isStandalone = false;
    }
    if (isStandalone) return;

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setMode("android");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Chrome emette `beforeinstallprompt` al caricamento, spesso PRIMA che
    // React abbia idratato: senza questo recupero, su Android il banner non
    // comparirebbe quasi mai. Uno script in layout.tsx parcheggia l'evento
    // su window e noi lo raccogliamo qui.
    // Il rilevamento del browser e dell'evento parcheggiato è possibile solo
    // dopo il mount (durante il render sul server `window` non esiste):
    // l'effect è la sede corretta per questo setState, non un caso da evitare.
    /* eslint-disable react-hooks/set-state-in-effect */
    const parked = (window as unknown as { __raInstallPrompt?: Event }).__raInstallPrompt;
    if (parked) {
      setDeferredEvent(parked as BeforeInstallPromptEvent);
      setMode("android");
    } else if (/iphone|ipad|ipod/i.test(window.navigator.userAgent)) {
      setMode("ios");
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    // Prima si chiude il banner, poi si prova a ricordarlo: se la scrittura
    // fallisse per prima, il banner non si chiuderebbe nemmeno visivamente e
    // la × sembrerebbe rotta.
    setMode("none");
    safeSetDismissed();
  }

  async function handleInstall() {
    if (!deferredEvent) return;
    try {
      await deferredEvent.prompt();
      const choice = await deferredEvent.userChoice;
      // Solo se ha davvero installato: se annulla il foglio nativo di
      // Chrome, il banner deve restare, non sparire per sempre.
      if (choice.outcome === "accepted") dismiss();
    } catch {
      // prompt() può rifiutare (già usato, o fuori da un gesto utente):
      // non deve produrre un errore non gestito.
    }
  }

  if (mode === "none") return null;

  return (
    <div className="install-banner">
      {mode === "ios" ? (
        <p>
          Aggiungi <b>Medical Center</b> alla schermata Home: tocca <b>Condividi</b> (il
          riquadro con la freccia, nella barra di Safari) e poi{" "}
          <b>&quot;Aggiungi alla schermata Home&quot;</b>.
        </p>
      ) : (
        <div className="install-banner-row">
          <p>
            Installa <b>Medical Center</b> come app sulla schermata Home.
          </p>
          <button type="button" className="btn primary" onClick={handleInstall}>
            Installa
          </button>
        </div>
      )}
      <button type="button" className="install-banner-close" aria-label="Chiudi" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
