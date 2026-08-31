import { NextRequest, NextResponse } from "next/server";
import { requireBasicAuth } from "@/lib/basic-auth";
import { readSessionToken, SESSION_COOKIE } from "@/lib/session";

const SITE_URL = "https://medical-center-scandicci.vercel.app";
const TITLE = "Medical Center";
const DESCRIPTION =
  "Gestionale per noleggio ausili, commesse, fidelity e anagrafica clienti a Scandicci.";

// I crawler delle anteprime social (WhatsApp, Facebook, Telegram, ecc.) non
// sanno autenticarsi con Basic Auth: senza login non ricevono altro che un
// 401, quindi condividere il link non mostra nessuna anteprima. Questi user
// agent sono pubblici e ben noti, e a loro serviamo solo una paginetta
// statica con i tag Open Graph (nessun dato del magazzino: lo stesso testo
// già presente nei metadata del sito, mai protetto).
const CRAWLER_UA =
  /facebookexternalhit|WhatsApp|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|SkypeUriPreview|Googlebot|bingbot/i;

function previewHtml(pageUrl: string): string {
  const image = `${SITE_URL}/og-image.png`;
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="robots" content="noindex, nofollow" />
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}" />
<meta property="og:title" content="${TITLE}" />
<meta property="og:description" content="${DESCRIPTION}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:site_name" content="${TITLE}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="it_IT" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${TITLE}" />
<meta name="twitter:description" content="${DESCRIPTION}" />
<meta name="twitter:image" content="${image}" />
</head>
<body>${TITLE} — accesso riservato, richiede login.</body>
</html>`;
}

// L'intera applicazione richiede l'autenticazione: non esiste nessuna area
// pubblica. Sono esclusi solo gli asset statici (icone, logo, immagine di
// preview, manifest PWA) che il browser scarica prima di poter presentare
// le credenziali e che non contengono dati aziendali, più la paginetta di
// anteprima per i crawler social (vedi sopra).
export default async function proxy(req: NextRequest) {
  // Vercel Cron chiama /api/backup una volta al giorno senza Basic Auth:
  // qui si lascia passare solo con il segreto giusto (la rotta lo verifica
  // di nuovo per conto suo — difesa in profondità, come le altre rotte
  // sensibili). Senza questa eccezione il backup automatico riceverebbe
  // sempre 401 prima ancora di arrivare al gestore.
  if (req.nextUrl.pathname === "/api/backup") {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Accesso non autorizzato" }, { status: 401 });
  }

  // Su qualunque pagina, non solo sulla home: condividendo un link diretto
  // a una scheda (es. /noleggi?q=N130C) l'anteprima deve comparire lo
  // stesso, non solo quando si condivide l'indirizzo nudo. Il testo e
  // l'immagine restano sempre gli stessi — sono gli stessi metadata già
  // pubblici del sito, mai dati del magazzino — cambia solo l'URL riportato
  // in og:url, che rispecchia la pagina realmente condivisa.
  if (CRAWLER_UA.test(req.headers.get("user-agent") ?? "")) {
    const pageUrl = `${SITE_URL}${req.nextUrl.pathname}${req.nextUrl.search}`;
    return new NextResponse(previewHtml(pageUrl), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const isLoginRoute =
    req.nextUrl.pathname === "/login" ||
    req.nextUrl.pathname === "/api/auth/login" ||
    req.nextUrl.pathname === "/api/auth/logout";
  if (isLoginRoute) return NextResponse.next();

  if (readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // Compatibilità per integrazioni o postazioni che inviano già
  // Authorization: Basic. In assenza dell'header non restituiamo più 401
  // con WWW-Authenticate, quindi il browser non apre la vecchia finestrella.
  if (req.headers.get("authorization")?.startsWith("Basic ")) {
    const unauthorized = await requireBasicAuth(req);
    if (!unauthorized) return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sessione scaduta: accedi di nuovo." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

// Il matcher deve essere una stringa statica (Next.js lo analizza a
// compile-time): niente variabili o template literal, vedi
// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon-32.png|apple-icon.png|icon-192.png|icon-512.png|logo.png|og-image.png|manifest.webmanifest|robots.txt).*)",
  ],
};
