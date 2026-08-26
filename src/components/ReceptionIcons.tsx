/** Icone della home fronte banco: stroke-only, stessa famiglia visiva,
 * costruite con primitive semplici (cerchi/linee/rettangoli) invece di
 * path complessi, apposta per restare nitide a qualunque dimensione. */

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

export function IconFidelity() {
  return (
    <svg viewBox="0 0 24 24" {...SHARED}>
      <polygon points="12,5 13.7,9.65 18.66,9.84 14.76,12.9 16.11,17.66 12,14.9 7.89,17.66 9.24,12.9 5.34,9.84 10.3,9.65" />
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
