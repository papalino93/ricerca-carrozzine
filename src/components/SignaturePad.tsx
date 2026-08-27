"use client";

import { useEffect, useRef, useState } from "react";

interface SignaturePadProps {
  label: string;
  onChange: (dataUrl: string | null) => void;
}

// Riquadro di firma touch/mouse, senza librerie esterne: un canvas con gli
// eventi pointer (funzionano sia con dito su tablet sia con mouse), esportato
// come PNG solo quando c'è davvero un tratto disegnato — mai un'immagine
// vuota che sembrerebbe una firma valida ma non lo è.
export function SignaturePad({ label, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  /** Come `empty`, ma leggibile dentro l'effetto di ridimensionamento senza
   * doverlo far ripartire a ogni tratto. */
  const drawnRef = useRef(false);
  /** Copia della firma in attesa di essere ridisegnata dopo un
   * ridimensionamento: vedi il commento in setup(). */
  const pendingRef = useRef<string | null>(null);
  const [empty, setEmpty] = useState(true);

  // Il canvas ha due misure: quella su schermo (CSS) e quella della sua
  // immagine interna. Devono restare allineate, altrimenti il tratto esce
  // spostato rispetto al dito. Cambiano quando il riquadro cambia
  // larghezza — tipicamente ruotando il telefono mentre si firma — quindi
  // non basta impostarle una volta all'apertura: le riallineiamo a ogni
  // ridimensionamento.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Il componente può sparire (modale chiusa) mentre l'immagine della firma
    // si sta ancora ricaricando: da lì in poi non va più toccato nulla.
    let vivo = true;

    function setup() {
      if (!canvas || !vivo) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * ratio);
      const h = Math.round(rect.height * ratio);
      if (w === 0 || h === 0) return;
      if (canvas.width === w && canvas.height === h) return;

      // Ridimensionare il canvas ne azzera il contenuto: la firma già
      // tracciata va salvata prima e ridisegnata dopo. Senza, ruotare il
      // telefono per far firmare l'altra persona cancellerebbe in silenzio
      // la firma appena raccolta — e il documento verrebbe generato senza,
      // senza che nessuno se ne accorga.
      //
      // La copia viene tenuta da parte finché non è stata davvero ridisegnata:
      // ruotando lo schermo il ridimensionamento arriva due volte di fila, e
      // la seconda troverebbe il canvas già azzerato dalla prima — copiandone
      // una versione vuota e cancellando la firma per sempre.
      const precedente =
        pendingRef.current ?? (drawnRef.current ? canvas.toDataURL("image/png") : null);
      pendingRef.current = precedente;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // setTransform e non scale: scale si somma a ogni chiamata, e alla
      // seconda il tratto verrebbe disegnato al doppio della scala.
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#17301b";
      drawingRef.current = false;

      if (precedente) {
        const img = new Image();
        img.onload = () => {
          if (!vivo || !canvas) return;
          // Riadattata alla nuova larghezza: la firma resta la stessa, solo
          // ridimensionata come il riquadro che la contiene.
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          pendingRef.current = null;
          onChange(canvas.toDataURL("image/png"));
        };
        img.onerror = () => {
          pendingRef.current = null;
        };
        img.src = precedente;
      }
    }

    setup();
    const observer = new ResizeObserver(setup);
    observer.observe(canvas);
    return () => {
      vivo = false;
      observer.disconnect();
    };
  }, [onChange]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawnRef.current = true;
    if (empty) setEmpty(false);
  }

  function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && drawnRef.current) onChange(canvas.toDataURL("image/png"));
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawnRef.current = false;
    pendingRef.current = null;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="field">
      <label>{label}</label>
      <canvas
        ref={canvasRef}
        className="signature-pad"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        /* Su iOS un secondo dito o una gesture di sistema annulla il tratto
           in corso: senza questo il pad resterebbe convinto di star ancora
           disegnando e il tocco successivo continuerebbe la stessa linea. */
        onPointerCancel={handlePointerUp}
      />
      <div className="card-actions" style={{ marginTop: 6 }}>
        <button type="button" className="btn" onClick={handleClear} disabled={empty}>
          Cancella firma
        </button>
      </div>
    </div>
  );
}
