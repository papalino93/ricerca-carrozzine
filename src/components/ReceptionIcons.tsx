/** Icone condivise tra la home Operatore banco e la sidebar di
 * amministrazione: stroke-only, stessa famiglia visiva, costruite con
 * primitive semplici (cerchi/linee/rettangoli) invece di path complessi,
 * apposta per restare nitide a qualunque dimensione. */

const SHARED = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconNoleggio() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <circle cx="9" cy="17" r="5" />
      <circle cx="18.5" cy="19.3" r="1.6" />
      <path d="M8 5.5h1.5v6.5" />
      <path d="M9.5 12h4.5l4 7.3" />
    </svg>
  );
}

export function IconCommessa() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2.3" width="6" height="3" rx="1" />
      <line x1="9" y1="10.5" x2="15" y2="10.5" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="17.5" x2="13" y2="17.5" />
    </svg>
  );
}

/** Tessera fedeltà: sagoma della carta con la banda e le righe del numero.
 * Una stella dice "preferito", non "tessera" — qui serve l'oggetto che il
 * cliente ha davvero in mano. */
export function IconFidelity() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <line x1="2.5" y1="9.5" x2="21.5" y2="9.5" />
      <line x1="6" y1="13.5" x2="12" y2="13.5" />
      <line x1="6" y1="16" x2="9.5" y2="16" />
    </svg>
  );
}

export function IconClienti() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M6 19c0-3.5 2.7-6 6-6s6 2.5 6 6" />
    </svg>
  );
}

export function IconMagazzino() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="4" y1="16" x2="20" y2="16" />
    </svg>
  );
}

export function IconImpostazioni() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <line x1="5" y1="8" x2="19" y2="8" />
      <circle cx="14" cy="8" r="1.8" />
      <line x1="5" y1="16" x2="19" y2="16" />
      <circle cx="10" cy="16" r="1.8" />
    </svg>
  );
}

/** Cartella con un piccolo appoggio plantare stilizzato: distingue il
 * fascicolo dal resto dell'archivio (icona Commessa/Magazzino), restando
 * nella stessa famiglia stroke-only. */
export function IconFascicoli() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M3.5 7.5c0-1 .8-1.8 1.8-1.8h4l1.6 2h7.8c1 0 1.8.8 1.8 1.8v8.7c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8z" />
      <path d="M11.5 11.2c-.5.9-.4 1.7.2 2.1.7.5.6 1.5-.1 1.8-1 .5-1.1 1.6-.3 2.2" />
    </svg>
  );
}
