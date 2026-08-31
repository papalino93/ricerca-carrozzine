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
      <section className="login-card" aria-labelledby="login-title">
        <Image src="/logo.png" alt="Medical Center" width={310} height={92} priority />
        <div className="login-heading">
          <p className="eyebrow">Area riservata</p>
          <h1 id="login-title">Accedi al gestionale</h1>
          <p className="sub">Usa le stesse credenziali che utilizzavi nella finestra del browser.</p>
        </div>
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
