"use client";

import { useEffect, useState } from "react";

/** Orario aggiornato al secondo: reso solo lato client (parte da null) per
 * non disallineare l'HTML renderizzato dal server, che non può conoscere
 * l'ora esatta del browser di chi guarda. */
export function LiveClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString("it-IT"));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;
  return <>{time}</>;
}
