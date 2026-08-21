"use client";

interface ToastProps {
  message: string | null;
}

// Notifica temporanea per confermare un'operazione (salvato, eliminato,
// stato aggiornato...). Il chiamante gestisce il proprio stato/timer, vedi
// showToast negli altri componenti.
export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
