"use client";

import { useRouter } from "next/navigation";

/**
 * Torna alla schermata precedente (cronologia del browser), non alla
 * home: chi arriva qui da "Da tenere d'occhio" o da un risultato di
 * ricerca si aspetta di tornare lì, non di ripartire dal menu principale
 * — per quello c'è già il tasto Home accanto.
 */
export function BackButton() {
  const router = useRouter();

  return (
    <button type="button" className="btn front-bar-back" onClick={() => router.back()}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5 8 12l7 7" />
      </svg>
      Indietro
    </button>
  );
}
