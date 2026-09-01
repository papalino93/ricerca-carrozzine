"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useModalA11y } from "./useModalA11y";

type ConfirmTone = "default" | "danger";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions({ confirmLabel: "Conferma", tone: "default", ...nextOptions });
    });
  }, []);
  const dialogRef = useModalA11y(() => close(false), Boolean(options));

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options ? (
        <div className="confirm-backdrop" role="presentation" onMouseDown={() => close(false)}>
          <div
            className={`confirm-dialog ${options.tone === "danger" ? "danger" : ""}`}
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog-icon" aria-hidden="true">
              {options.tone === "danger" ? "!" : "✓"}
            </div>
            <h2 id="confirm-dialog-title">{options.title}</h2>
            <p id="confirm-dialog-description">{options.description}</p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn"
                onClick={() => close(false)}
                autoFocus={options.tone === "danger"}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => close(true)}
                autoFocus={options.tone !== "danger"}
              >
                {options.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm deve essere usato dentro ConfirmProvider");
  return confirm;
}
