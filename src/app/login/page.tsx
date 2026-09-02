import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, cookieStore] = await Promise.all([searchParams, cookies()]);
  const nextPath = safeNext(next);
  if (readSessionToken(cookieStore.get(SESSION_COOKIE)?.value)) redirect(nextPath);

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-welcome" aria-label="Benvenuto in Medical Center">
          <p className="login-welcome-kicker">Medical Center · Scandicci</p>
          <h2>Ogni giornata di lavoro, in un unico posto.</h2>
          <p>
            Noleggi, clienti, commesse e scadenze: il gestionale pensato per il banco,
            con le informazioni importanti sempre a portata di mano.
          </p>
          <ul className="login-welcome-points">
            <li>Magazzino e noleggi aggiornati</li>
            <li>Scadenze evidenziate in tempo</li>
            <li>Accesso protetto per ogni operatore</li>
          </ul>
        </section>

        <section className="login-card" aria-labelledby="login-title">
          <div className="login-brand">
            <Image src="/medical-center-brand.png" alt="Medical Center" width={318} height={111} priority />
          </div>
          <div className="login-heading">
            <p className="eyebrow">Area riservata</p>
            <h1 id="login-title">Accedi al gestionale</h1>
            <p className="sub">Usa le stesse credenziali che utilizzavi nella finestra del browser.</p>
          </div>
          <LoginForm nextPath={nextPath} />
        </section>
      </div>
    </main>
  );
}
