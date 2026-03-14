/**
 * Fuzzy matching utility for specialties, locations, and doctor names.
 * Handles common Spanish typos and accent omissions.
 * @module whatsapp/utils/fuzzyMatch
 */

/** Remove accents and normalize to lowercase */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Normalized similarity score (0-1, higher = better match) */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface FuzzyMatchResult<T = string> {
  match: T;
  label: string;
  score: number;
  index: number;
}

/**
 * Find the best fuzzy match for `input` among `options`.
 * Returns the best match above the threshold, or null.
 *
 * @param input - User input (may contain typos)
 * @param options - Array of { label, value } or string[]
 * @param threshold - Minimum similarity score (default 0.55)
 */
export function findBestMatch<T = string>(
  input: string,
  options: Array<{ label: string; value: T }>,
  threshold = 0.55,
): FuzzyMatchResult<T> | null {
  const normalizedInput = normalize(input);
  if (!normalizedInput || options.length === 0) return null;

  let best: FuzzyMatchResult<T> | null = null;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const score = similarity(normalizedInput, opt.label);

    // Also check if input is a significant substring of the option
    const normalizedLabel = normalize(opt.label);
    const substringBonus = normalizedLabel.includes(normalizedInput) && normalizedInput.length >= 3 ? 0.15 : 0;
    const adjustedScore = Math.min(score + substringBonus, 1);

    if (adjustedScore >= threshold && (!best || adjustedScore > best.score)) {
      best = { match: opt.value, label: opt.label, score: adjustedScore, index: i };
    }
  }

  return best;
}

/**
 * Convenience wrapper: match against a simple string array.
 */
export function findBestStringMatch(
  input: string,
  options: string[],
  threshold = 0.55,
): FuzzyMatchResult<string> | null {
  return findBestMatch(
    input,
    options.map(o => ({ label: o, value: o })),
    threshold,
  );
}

/**
 * Try to match user input to an option by number (1-based) or by fuzzy name.
 * Useful for selection menus ("1", "el primero", "odontolgia").
 */
export function matchByNumberOrName<T>(
  input: string,
  options: Array<{ label: string; value: T }>,
  threshold = 0.55,
): FuzzyMatchResult<T> | null {
  const trimmed = input.trim();

  // Try number match first
  const numMatch = trimmed.match(/^(?:el\s+)?(?:opci[oó]n\s+)?(\d{1,2})$/i);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    if (idx >= 0 && idx < options.length) {
      return { match: options[idx].value, label: options[idx].label, score: 1, index: idx };
    }
  }

  // Ordinal words
  const ordinals: Record<string, number> = {
    primero: 0, primera: 0, segundo: 1, segunda: 1,
    tercero: 2, tercera: 2, cuarto: 3, cuarta: 3, quinto: 4, quinta: 4,
  };
  const normalizedTrimmed = normalize(trimmed);
  for (const [word, idx] of Object.entries(ordinals)) {
    if (normalizedTrimmed.includes(word) && idx < options.length) {
      return { match: options[idx].value, label: options[idx].label, score: 1, index: idx };
    }
  }

  // Fuzzy name match
  return findBestMatch(input, options, threshold);
}
