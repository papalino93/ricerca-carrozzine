import Image from "next/image";
import { RecoveryRequestForm } from "@/components/RecoveryRequestForm";

export default function RecoveryPage() {
  return <main className="login-page"><section className="login-card" aria-labelledby="recovery-title">
    <div className="login-brand" aria-label="Medical Center"><Image src="/logo.png" alt="" width={56} height={56} priority /><span>Medical<br />Center</span></div>
    <div className="login-heading"><p className="eyebrow">Recupero accesso</p><h1 id="recovery-title">Username o password dimenticati?</h1><p className="sub">Invieremo gli username autorizzati e i collegamenti per scegliere una nuova password alle email di recupero configurate.</p></div>
    <RecoveryRequestForm />
  </section></main>;
}
