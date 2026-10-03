/** Scores how well `query` matches `text` as a subsequence; -1 when it doesn't. Higher is better. */
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 1 + streak * 2;
    // Matches at the start of a word or the file name count more.
    if (found === 0 || "/\\-_. ".includes(t[found - 1])) score += 3;
    ti = found + 1;
  }
  const name = t.slice(t.lastIndexOf("/") + 1);
  if (name.includes(q)) score += 10;
  return score - t.length * 0.01;
}
