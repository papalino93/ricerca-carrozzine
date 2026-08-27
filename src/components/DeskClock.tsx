"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

/**
 * Riquadro in cima alla home: meteo di Scandicci (adesso, minima/massima di
 * oggi e previsione di domani) accanto a data e ora.
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
        <div className="deskw-now">
          <span className="deskw-now-icon">
            <WeatherIcon tipo={weather.icona} notte={weather.notte} />
          </span>
          <span className="deskw-now-txt">
            <b>
              {weather.adesso}
              <i>°</i>
            </b>
            <span className="deskw-now-desc">{weather.descrizione}</span>
            {weather.oggi ? (
              <span className="deskw-range">
                <i className="down" aria-hidden="true">
                  ↓
                </i>
                {weather.oggi.min}°
                <i className="up" aria-hidden="true">
                  ↑
                </i>
                {weather.oggi.max}°
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="deskw-time">
        <span className="deskw-day">{giorno}</span>
        <span className="deskw-hour">{ora || " "}</span>
        <span className="deskw-date">{data || " "}</span>
      </div>

      {weather?.domani ? (
        <div className="deskw-tomorrow">
          <span className="deskw-tomorrow-label">Domani</span>
          <span className="deskw-tomorrow-row">
            <span className="deskw-tomorrow-icon">
              <WeatherIcon tipo={weather.domani.icona} />
            </span>
            <span className="deskw-tomorrow-temp">
              {weather.domani.min}° / <b>{weather.domani.max}°</b>
            </span>
          </span>
          <span className="deskw-tomorrow-desc">{weather.domani.descrizione}</span>
        </div>
      ) : null}
    </div>
  );
}
