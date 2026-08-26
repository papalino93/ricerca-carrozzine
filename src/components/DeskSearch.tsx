"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Ricerca in cima alla home: al banco la prima cosa che si fa è cercare un
 * cliente o un ausilio, quindi il campo deve essere lì e non dietro un clic.
 * Non cerca da sé — passa il testo alla pagina Noleggi, che ha già tutti i
 * filtri e la logica di ricerca.
 */
export function DeskSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/noleggi?q=${encodeURIComponent(term)}` : "/noleggi");
  }

  return (
    <form className="desk-search" onSubmit={handleSubmit} role="search">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca un cliente, un ausilio, un numero di noleggio…"
        aria-label="Cerca"
      />
      <button className="btn primary" type="submit">
        Cerca
      </button>
    </form>
  );
}
