import Image from "next/image";
import { RecoveryPasswordForm } from "@/components/RecoveryPasswordForm";

export default async function NewPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="login-page"><section className="login-card" aria-labelledby="new-password-title">
    <div className="login-brand"><Image src="/medical-center-brand.png" alt="Medical Center" width={318} height={111} priority /></div>
    <div className="login-heading"><p className="eyebrow">Recupero accesso</p><h1 id="new-password-title">Scegli una nuova password</h1><p className="sub">Usa almeno 8 caratteri. Il collegamento è valido per 15 minuti.</p></div>
    {token ? <RecoveryPasswordForm token={token} /> : <div><div className="banner error">Collegamento non valido.</div><a className="login-recovery-link" href="/recupero-accesso">Richiedine uno nuovo</a></div>}
  </section></main>;
}
