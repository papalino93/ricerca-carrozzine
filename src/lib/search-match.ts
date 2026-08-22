// Distanza di Levenshtein: usata solo per tollerare piccoli errori di
// battitura nella ricerca libera (es. "betatx" trova "BETATEX").
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Un match esatto (substring) vince sempre; per parole di almeno 4
// caratteri si accetta anche una piccola distanza di edit, per tollerare
// refusi senza dare troppi falsi positivi su query corte. Condivisa tra la
// ricerca pubblica e la casella di ricerca del magazzino in admin.
export function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  if (haystack.includes(query)) return true;
  const qTokens = query.split(/\s+/).filter(Boolean);
  const hTokens = haystack.split(/\s+/).filter(Boolean);
  return qTokens.every((qt) =>
    hTokens.some((ht) => {
      if (ht.includes(qt)) return true;
      if (qt.length < 4) return false;
      const maxDist = qt.length > 6 ? 2 : 1;
      return levenshtein(ht, qt) <= maxDist;
    })
  );
}
