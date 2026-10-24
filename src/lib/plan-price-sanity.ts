type Terms = { monthly: number; twoMonths: number; threeMonths: number };

/**
 * Catches typos that would go live within seconds of saving: a longer term must cost more in total but less per month
 * than buying monthly, and Pro must not undercut Creator. Returns the first problem, or null when the prices make sense.
 */
export function planPriceProblem(label: string, creator: Terms, pro: Terms): string | null {
  for (const [name, t] of [["Creator", creator], ["Pro", pro]] as const) {
    if (!(t.twoMonths > t.monthly)) return `${label} ${name}: 2 months must cost more than 1 month.`;
    if (!(t.threeMonths > t.twoMonths)) return `${label} ${name}: 3 months must cost more than 2 months.`;
    if (t.twoMonths > t.monthly * 2) return `${label} ${name}: 2 months costs more than paying monthly twice.`;
    if (t.threeMonths > t.monthly * 3) return `${label} ${name}: 3 months costs more than paying monthly three times.`;
  }
  if (pro.monthly < creator.monthly || pro.twoMonths < creator.twoMonths || pro.threeMonths < creator.threeMonths) {
    return `${label}: Pro is priced below Creator for at least one term.`;
  }
  return null;
}
