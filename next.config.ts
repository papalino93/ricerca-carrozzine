import type { NextConfig } from "next";

// Radunato qui in fase di build (Vercel imposta VERCEL_GIT_COMMIT_SHA senza
// bisogno di attivare "Automatically expose System Environment Variables":
// quel toggle serve solo per l'ambiente delle funzioni a runtime, non per la
// build) e passato al client tramite NEXT_PUBLIC_*, per il piccolo indicatore
// di versione in fondo alla pagina (vedi BuildInfo.tsx): serve a distinguere
// a colpo d'occhio se quello che si sta guardando è davvero l'ultimo deploy.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "1.0.15",
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
