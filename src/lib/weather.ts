import "server-only";

/**
 * Meteo di Scandicci per il riquadro in cima alla home: condizioni attuali,
 * minima e massima di oggi e previsione di domani.
 *
 * Fonte: Open-Meteo — senza registrazione, senza chiave, senza costi. La
 * risposta viene tenuta in cache mezz'ora: il meteo non cambia al minuto e
 * così una pagina aperta e riaperta tutto il giorno resta a una manciata di
 * chiamate. Se il servizio non risponde la funzione restituisce null e la
 * home mostra solo data e ora, senza errori né spazi vuoti.
 */

/** Coordinate del negozio (Via di Scandicci, Scandicci FI). */
const LAT = 43.7545;
const LON = 11.1885;

export type WeatherIconKind =
  | "sereno"
  | "poche-nuvole"
  | "nuvoloso"
  | "nebbia"
  | "pioggia"
  | "neve"
  | "temporale";

export interface WeatherDay {
  /** Gradi centigradi, arrotondati. */
  min: number;
  max: number;
  descrizione: string;
  icona: WeatherIconKind;
}

export interface Weather {
  /** Temperatura di adesso, arrotondata. */
  adesso: number;
  descrizione: string;
  icona: WeatherIconKind;
  /** Vero fra tramonto e alba: il sereno diventa una luna. */
  notte: boolean;
  oggi: WeatherDay | null;
  domani: WeatherDay | null;
}

/** Codici meteo WMO usati da Open-Meteo, raggruppati per come vanno mostrati. */
function fromCode(code: number): { descrizione: string; icona: WeatherIconKind } {
  if (code === 0) return { descrizione: "Sereno", icona: "sereno" };
  if (code === 1) return { descrizione: "Poco nuvoloso", icona: "poche-nuvole" };
  if (code === 2) return { descrizione: "Parz. nuvoloso", icona: "poche-nuvole" };
  if (code === 3) return { descrizione: "Nuvoloso", icona: "nuvoloso" };
  if (code === 45 || code === 48) return { descrizione: "Nebbia", icona: "nebbia" };
  if (code >= 51 && code <= 57) return { descrizione: "Pioviggine", icona: "pioggia" };
  if (code >= 61 && code <= 67) return { descrizione: "Pioggia", icona: "pioggia" };
  if (code >= 71 && code <= 77) return { descrizione: "Neve", icona: "neve" };
  if (code >= 80 && code <= 82) return { descrizione: "Rovesci", icona: "pioggia" };
  if (code === 85 || code === 86) return { descrizione: "Neve", icona: "neve" };
  if (code >= 95) return { descrizione: "Temporale", icona: "temporale" };
  return { descrizione: "—", icona: "nuvoloso" };
}

interface DailyBlock {
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}

function toDay(daily: DailyBlock | undefined, i: number): WeatherDay | null {
  const max = daily?.temperature_2m_max?.[i];
  const min = daily?.temperature_2m_min?.[i];
  if (typeof max !== "number" || typeof min !== "number") return null;
  const { descrizione, icona } = fromCode(daily?.weather_code?.[i] ?? -1);
  return { min: Math.round(min), max: Math.round(max), descrizione, icona };
}

export async function getWeather(): Promise<Weather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&forecast_days=2&timezone=Europe%2FRome`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
      daily?: DailyBlock;
    };
    const current = data.current;
    if (!current || typeof current.temperature_2m !== "number") return null;

    const { descrizione, icona } = fromCode(current.weather_code ?? -1);
    return {
      adesso: Math.round(current.temperature_2m),
      descrizione,
      icona,
      notte: current.is_day === 0,
      oggi: toDay(data.daily, 0),
      domani: toDay(data.daily, 1),
    };
  } catch {
    // Rete assente, servizio giù o risposta lenta: la home deve aprirsi
    // comunque, il meteo è un di più.
    return null;
  }
}
