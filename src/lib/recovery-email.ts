import "server-only";
import type { RecoverableAccount } from "./users";
import { createRecoveryToken, recoveryRecipients } from "./recovery";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}

export async function sendRecoveryEmail(accounts: RecoverableAccount[], origin: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = recoveryRecipients();
  if (!apiKey || recipients.length === 0) {
    throw new Error("Recupero accesso non configurato");
  }

  const rows = accounts.map((account) => {
    const token = createRecoveryToken(account.username, account.version);
    const url = `${origin}/recupero-accesso/nuova-password?token=${encodeURIComponent(token)}`;
    return `<li style="margin:0 0 18px"><strong>${escapeHtml(account.username)}</strong><br>` +
      `<a href="${url}" style="color:#16622b">Imposta una nuova password</a></li>`;
  }).join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_RECOVERY_FROM ?? "Medical Center <onboarding@resend.dev>",
      to: recipients,
      subject: "Recupero accesso — Medical Center",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#19341f;line-height:1.5">` +
        `<h1 style="font-size:24px">Recupero accesso</h1>` +
        `<p>È stato richiesto il recupero delle credenziali del gestionale Medical Center.</p>` +
        `<p>Gli username autorizzati sono:</p><ul>${rows}</ul>` +
        `<p>I collegamenti scadono dopo 15 minuti e smettono di funzionare appena viene cambiata la password.</p>` +
        `<p>Se non hai richiesto tu il recupero, ignora questo messaggio.</p></div>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Invio recupero Resend non riuscito:", response.status, detail.slice(0, 300));
    throw new Error("Invio email non riuscito");
  }
}
