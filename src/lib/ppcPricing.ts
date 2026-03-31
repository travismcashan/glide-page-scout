/**
 * PPC Management tiered pricing based on contract terms.
 *
 * - Under $8,000 ad spend: flat $1,250/mo management fee
 * - $8k–$30k: 17%
 * - $30k–$40k: 15%
 * - $40k–$50k: 12%
 * - $50k+: 10%
 *
 * Start-up cost: $1,250 (may be waived)
 */

export const PPC_SKU = 402;

export const PPC_STARTUP_COST = 1250;
export const PPC_FLAT_FEE = 1250;
export const PPC_FLAT_THRESHOLD = 8000;

export const PPC_TIERS = [
  { min: 8000, max: 30000, pct: 17 },
  { min: 30000, max: 40000, pct: 15 },
  { min: 40000, max: 50000, pct: 12 },
  { min: 50000, max: Infinity, pct: 10 },
] as const;

/**
 * Calculate the monthly management fee given an estimated monthly ad spend.
 */
export function calcPpcManagementFee(adSpend: number): number {
  if (adSpend <= 0) return 0;
  if (adSpend < PPC_FLAT_THRESHOLD) return PPC_FLAT_FEE;

  for (const tier of PPC_TIERS) {
    if (adSpend <= tier.max) {
      return Math.round(adSpend * (tier.pct / 100));
    }
  }
  return Math.round(adSpend * 0.1);
}

/**
 * Get a human-readable description of the tier for a given ad spend.
 */
export function getPpcTierLabel(adSpend: number): string {
  if (adSpend < PPC_FLAT_THRESHOLD) return `Flat $${PPC_FLAT_FEE.toLocaleString()}/mo`;
  for (const tier of PPC_TIERS) {
    if (adSpend <= tier.max) return `${tier.pct}% of ad spend`;
  }
  return "10% of ad spend";
}

/**
 * Check if a SKU is the PPC Management offering.
 */
export function isPpcOffering(name: string): boolean {
  return /ppc\s*manage/i.test(name);
}
