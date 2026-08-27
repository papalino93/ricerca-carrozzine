"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

/**
 * Riquadro in cima alla home: meteo di Scandicci (adesso e domani) accanto a
 * data e ora, in tre colonne con la stessa struttura — etichetta, numero
 * grande, dettaglio sotto.
 *
 * Data e ora sono rese solo lato client: il server gira su fuso UTC, quindi
 * la data calcolata lì sarebbe quella sbagliata nelle ore serali italiane, e
 * l'ora esatta del browser non può comunque conoscerla senza disallineare
 * l'HTML già inviato. L'ingombro resta però lo stesso anche prima che i
 * valori compaiano, così la riga non "salta" al caricamento.
 */
export function DeskClock({ weather }: { weather: Weather | null }) {
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

  const giorno = now ? now.toLocaleDateString("it-IT", { weekday: "long" }) : "";
  const data = now ? now.toLocaleDateString("it-IT", { day: "numeric", month: "long" }) : "";
  const ora = now ? now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="deskw">
      {weather ? (
        <div className="deskw-col">
          <span className="deskw-label">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="deskw-pin">
              <path d="M12 21s6.4-6 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15 12 21 12 21Z" />
              <circle cx="12" cy="10.4" r="2.3" />
            </svg>
            Scandicci
          </span>
          <span className="deskw-row">
            <span className="deskw-icon">
              <WeatherIcon tipo={weather.icona} notte={weather.notte} />
            </span>
            <span className="deskw-big">
              {weather.adesso}
              <i>&deg;</i>
            </span>
          </span>
          <span className="deskw-foot">
            <span className="deskw-desc">{weather.descrizione}</span>
            {weather.oggi ? (
              <span className="deskw-range">
                <i className="down" aria-hidden="true">
                  &darr;
                </i>
                {weather.oggi.min}&deg;
                <i className="up" aria-hidden="true">
                  &uarr;
                </i>
                {weather.oggi.max}&deg;
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="deskw-col">
        <span className="deskw-label">{giorno}</span>
        <span className="deskw-row">
          <span className="deskw-big deskw-hour">{ora || " "}</span>
        </span>
        <span className="deskw-foot">
          <span className="deskw-desc">{data || " "}</span>
        </span>
      </div>

      {weather?.domani ? (
        <div className="deskw-col">
          <span className="deskw-label">Domani</span>
          <span className="deskw-row">
            <span className="deskw-icon">
              <WeatherIcon tipo={weather.domani.icona} />
            </span>
            <span className="deskw-big">
              {weather.domani.max}
              <i>&deg;</i>
            </span>
          </span>
          <span className="deskw-foot">
            <span className="deskw-desc">{weather.domani.descrizione}</span>
            <span className="deskw-range">
              <i className="down" aria-hidden="true">
                &darr;
              </i>
              {weather.domani.min}&deg;
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
