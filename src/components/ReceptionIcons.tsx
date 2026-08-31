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

export function IconSalva() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 4v5h8V4" />
      <rect x="8.5" y="13" width="7" height="5" rx="0.5" />
    </svg>
  );
}

export function IconAnteprima() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconScarica() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 18.5h15" />
    </svg>
  );
}

export function IconStampa() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <rect x="5" y="8.5" width="14" height="7.5" rx="1.5" />
      <path d="M7.5 8.5V4.5h9v4" />
      <rect x="8.5" y="13" width="7" height="6" rx="0.5" />
    </svg>
  );
}

export function IconCerca() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20.5 20.5" />
    </svg>
  );
}

export function IconModifica() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M4 20l1-4.2L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z" />
      <path d="M14 6.5l3.5 3.5" />
    </svg>
  );
}

/** Freccia a U: "rimetti in magazzino" senza usare un colore di stato
 * (il verde/rosso dell'azione lo decide chi la usa, vedi legend-swatch). */
export function IconRestituzione() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M6 8h9a4.5 4.5 0 0 1 0 9h-3" />
      <path d="M9 4.5 6 8l3 3.5" />
    </svg>
  );
}

export function IconSanificato() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

/** Check dentro un cerchio: controllo/verifica conclusa, distinto dal check
 * semplice usato per la sanificazione. */
export function IconVerificato() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.2l2.6 2.7L16.5 9" />
    </svg>
  );
}

export function IconDocumento() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <path d="M6.5 3.5h8l3 3v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M14 3.5v3.5h3.5" />
      <line x1="8.5" y1="12" x2="15.5" y2="12" />
      <line x1="8.5" y1="15.5" x2="13" y2="15.5" />
    </svg>
  );
}

export function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function IconChiudi() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
