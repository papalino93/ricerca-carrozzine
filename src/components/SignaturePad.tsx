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

    function setup() {
      if (!canvas) return;
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
      const precedente = drawnRef.current ? canvas.toDataURL("image/png") : null;

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
          // Riadattata alla nuova larghezza: la firma resta la stessa, solo
          // ridimensionata come il riquadro che la contiene.
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          onChange(canvas.toDataURL("image/png"));
        };
        img.src = precedente;
      }
    }

    setup();
    const observer = new ResizeObserver(setup);
    observer.observe(canvas);
    return () => observer.disconnect();
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
