"use client";

import { useEffect, useState } from "react";

/**
 * Data e ora del banco. Entrambe rese solo lato client: il server gira su
 * fuso UTC, quindi la data calcolata lì può essere quella sbagliata nelle
 * ore serali italiane, e l'ora esatta del browser non può comunque
 * conoscerla senza disallineare l'HTML già inviato.
 *
 * L'ingombro resta lo stesso anche prima che i valori compaiano, così la
 * riga di intestazione non "salta" al caricamento.
 */
export function DeskClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    // Il primo valore al frame successivo e non dentro l'effetto stesso:
    // impostarlo lì innescherebbe un render a cascata. Al frame dopo vuol
    // dire comunque una manciata di millisecondi, non un secondo.
    const frame = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, []);

  const giorno = now
    ? now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })
    : "";
  const ora = now ? now.toLocaleTimeString("it-IT") : "";

  return (
    <div className="desk-clock" aria-label={now ? `${giorno}, ore ${ora}` : undefined}>
      <span className="desk-clock-date">{giorno}</span>
      <span className="desk-clock-time">{ora || " "}</span>
    </div>
  );
}
