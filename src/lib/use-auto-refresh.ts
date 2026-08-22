"use client";
import { useEffect, useRef } from "react";

/**
 * Richiama `refresh` ogni `intervalMs` millisecondi, e in più ogni volta che
 * la pagina torna visibile o riprende il focus (cambio scheda e ritorno,
 * schermo del telefono che si riaccende).
 *
 * Senza questo, chi tiene la pagina aperta continua a vedere il magazzino
 * di ore prima: è la causa profonda per cui due operatori potevano
 * noleggiare lo stesso ausilio a due clienti diversi, ognuno vedendo sul
 * proprio schermo il pulsante "Noleggia" perché la propria pagina non
 * sapeva ancora dell'operazione dell'altro.
 */
export function useAutoRefresh(refresh: () => void, intervalMs = 60_000): void {
  // In un ref: l'intervallo/i listener non vanno ricreati ogni volta che la
  // funzione di refresh cambia identità tra un render e l'altro. L'aggiornamento
  // del ref avviene in un effect, non durante il render (leggere/scrivere
  // `.current` in fase di render non è supportato da React).
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => refreshRef.current(), intervalMs);
    function onWake() {
      if (document.visibilityState === "visible") refreshRef.current();
    }
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [intervalMs]);
}
