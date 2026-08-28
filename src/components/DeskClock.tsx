"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";

/**
 * Riquadro in cima alla home: meteo di Scandicci (adesso e domani) accanto a
 * data e ora, in tre colonne con la stessa struttura — etichetta, numero
 * grande, dettaglio sotto.
 *
 * Data e ora arrivano già scritte dal server (`iniziale`, calcolate nel
 * fuso di Roma e non in quello UTC su cui gira Vercel): così sono leggibili
 * fin dal primo istante invece di comparire dopo l'idratazione. Da lì in
 * poi le aggiorna il browser, che è l'unico a conoscere l'ora esatta di chi
 * guarda lo schermo.
 */
export function DeskClock({
  weather,
  iniziale,
}: {
  weather: Weather | null;
  iniziale: { giorno: string; data: string; ora: string };
}) {
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

  const giorno = now ? now.toLocaleDateString("it-IT", { weekday: "long" }) : iniziale.giorno;
  const data = now
    ? now.toLocaleDateString("it-IT", { day: "numeric", month: "long" })
    : iniziale.data;
  const ora = now
    ? now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : iniziale.ora;

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
            {weather.oggi ? (
              // Massima sopra, minima sotto (mai il contrario): a differenza
              // della freccia unica di "Domani", qui ci sono due valori
              // vicini e senza freccia — l'ordine verticale è l'unico modo
              // per non farli sembrare intercambiabili.
              <span className="deskw-today-range">
                <span className="deskw-today-max">{weather.oggi.max}&deg;</span>
                <span className="deskw-today-min">{weather.oggi.min}&deg;</span>
              </span>
            ) : null}
          </span>
          <span className="deskw-foot">
            <span className="deskw-desc">{weather.descrizione}</span>
          </span>
        </div>
      ) : null}

      <div className="deskw-col">
        <span className="deskw-label">{giorno}</span>
        <span className="deskw-row">
          <span className="deskw-big deskw-hour">{ora}</span>
        </span>
        <span className="deskw-foot">
          <span className="deskw-desc">{data}</span>
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
              {/* Senza questa freccia il numero grande di domani era solo
                  "36°", indistinguibile da una temperatura attuale: nella
                  colonna di oggi il numero grande È adesso, qui invece è
                  la massima, e nient'altro lo diceva. Stessa freccia e
                  stesso colore arancio della massima nel dettaglio sotto,
                  cosi le due colonne si leggono con la stessa chiave. */}
              <i className="deskw-big-marker up" aria-hidden="true">
                &uarr;
              </i>
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
