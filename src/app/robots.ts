import type { MetadataRoute } from "next";

// Il sito è già protetto da Basic Auth (proxy.ts): nessun dato del
// magazzino è mai raggiungibile senza login. Questo file serve solo a
// evitare che il nome/descrizione del sito compaia nei risultati dei
// motori di ricerca — vedi anche il tag noindex nella pagina di anteprima
// per i crawler social in proxy.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
