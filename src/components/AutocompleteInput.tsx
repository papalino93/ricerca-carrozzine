"use client";

import { useEffect, useRef, useState } from "react";

export interface AutocompleteOption {
  value: string;
  /** Seconda riga, più chiara (es. telefono, cliente della commessa). */
  sublabel?: string | null;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  /** Chiamato solo quando l'utente sceglie un suggerimento (click o Invio),
   * non a ogni battitura: è il punto giusto per azioni come precompilare
   * il telefono di un cliente già noto. */
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  maxSuggestions?: number;
  disabled?: boolean;
}

/**
 * Sostituisce <input list> + <datalist>: il popup nativo del browser non si
 * può stilare (colori, bordi, posizione decide tutto il browser) e finiva
 * per stonare col resto dell'app, oltre ad aprirsi in punti imprevedibili
 * dello schermo. Qui il menu è un elemento normale, posizionato subito
 * sotto il campo, con lo stesso linguaggio visivo del resto dell'app.
 */
export function AutocompleteInput({
  value,
  onChange,
  options,
  onSelect,
  placeholder,
  autoFocus,
  id,
  maxSuggestions = 8,
  disabled,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const suggestions = disabled
    ? []
    : q
      ? options
          .filter((o) => o.value.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
          .slice(0, maxSuggestions)
      : [];

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function selectOption(o: AutocompleteOption) {
    onChange(o.value);
    onSelect?.(o);
    setOpen(false);
  }

  const showMenu = open && suggestions.length > 0;

  return (
    <div className="autocomplete" ref={containerRef}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        // Chiude il menu anche uscendo con Tab, non solo cliccando fuori
        // (l'ascoltatore su document sotto reagisce solo al mouse): il
        // click su un suggerimento non arriva qui perché onMouseDown lo
        // previene già (vedi sotto), quindi non c'è conflitto con la
        // selezione.
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showMenu) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            if (suggestions[highlight]) {
              e.preventDefault();
              selectOption(suggestions[highlight]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        disabled={disabled}
      />
      {showMenu ? (
        <ul className="autocomplete-menu">
          {suggestions.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                className={`autocomplete-option ${i === highlight ? "active" : ""}`}
                // onMouseDown, non onClick: previene il blur dell'input (che
                // chiuderebbe il menu) PRIMA che il click venga registrato.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(o)}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="autocomplete-option-label">{o.value}</span>
                {o.sublabel ? <span className="autocomplete-option-sub">{o.sublabel}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
