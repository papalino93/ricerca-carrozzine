"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ra-install-banner-dismissed";

/**
 * Suggerisce di installare il sito come app sulla schermata Home. Nascosta
 * via CSS su schermi larghi (vedi globals.css): su desktop non compare mai,
 * a prescindere da cosa rilevi il browser.
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
    if (localStorage.getItem(DISMISS_KEY)) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) {
      // Rilevamento del browser possibile solo dopo il mount (SSR non ha
      // `window`): l'effect è la sede corretta, non un caso da evitare.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("ios");
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setMode("android");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setMode("none");
  }

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    dismiss();
  }

  if (mode === "none") return null;

  return (
    <div className="install-banner">
      {mode === "ios" ? (
        <p>
          Aggiungi <b>Ricerca Ausili</b> alla schermata Home: tocca <b>Condividi</b> (il
          riquadro con la freccia, nella barra di Safari) e poi{" "}
          <b>&quot;Aggiungi alla schermata Home&quot;</b>.
        </p>
      ) : (
        <div className="install-banner-row">
          <p>
            Installa <b>Ricerca Ausili</b> come app sulla schermata Home.
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
