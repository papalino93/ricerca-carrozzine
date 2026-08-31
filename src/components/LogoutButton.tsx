"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LogoutButtonProps {
  className?: string;
  onLogout?: () => void;
}

export function LogoutButton({ className = "", onLogout }: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      onLogout?.();
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button type="button" className={className} onClick={logout} disabled={loading}>
      {loading ? "Uscita…" : "Esci"}
    </button>
  );
}
