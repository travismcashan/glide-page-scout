import type { PillarCode } from "@/data/offerings";

export interface ServiceStep {
  id: string;
  serviceId: string;
  code: string;
  name: string;
  stepType: "phase" | "cycle";
  frequency: "monthly" | "quarterly" | null;
  sortOrder: number;
  isOnramp: boolean;
}

export interface TimelineItem {
  sku: number;
  name: string;
  pillar: PillarCode;
  startMonth: number; // 0-indexed (0 = first month on timeline)
  duration: number;   // in months
  sortOrder: number;  // vertical position within pillar lane
  unitPrice?: number | null; // chosen price for this item (defaults to min from catalog)
  estimatedAdSpend?: number | null; // PPC-only: estimated monthly ad budget
  discountType?: "percent" | "fixed" | null; // type of discount applied
  discountValue?: number | null; // discount amount (percentage 0-100 or fixed dollar amount)
}
