export type PillarCode = "IS" | "FB" | "GO" | "TS";

export interface Pillar {
  code: PillarCode;
  name: string;
  tailwindKey: string;
}

export interface Offering {
  sku: number;
  name: string;
  defaultDuration: number;
  pillar: PillarCode;
  roadmapGrade: boolean;
  /** If set, this offering is a phase that can be created by splitting a parent */
  phaseOf?: number;
  phase?: number;
}

export const PILLARS: Pillar[] = [
  { code: "IS", name: "Insight & Strategy", tailwindKey: "is" },
  { code: "FB", name: "Foundation & Build", tailwindKey: "fb" },
  { code: "GO", name: "Growth & Optimization", tailwindKey: "go" },
  { code: "TS", name: "Technical & Support", tailwindKey: "ts" },
];

export const OFFERINGS: Offering[] = [
  // Insight & Strategy
  { sku: 101, name: "Paid Discovery", defaultDuration: 2, pillar: "IS", roadmapGrade: true },
  { sku: 110, name: "QA Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: true },
  { sku: 102, name: "SEO Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: true },
  { sku: 103, name: "PPC Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: true },
  { sku: 104, name: "Accessibility Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: false },
  { sku: 105, name: "Security Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: false },
  { sku: 106, name: "Compliance Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: false },
  { sku: 107, name: "Performance Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: false },
  { sku: 108, name: "Analytics Tracking Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: false },
  { sku: 109, name: "Usability Audit", defaultDuration: 1, pillar: "IS", roadmapGrade: false },

  // Foundation & Build
  { sku: 201, name: "Website Redesign", defaultDuration: 4, pillar: "FB", roadmapGrade: true },
  { sku: 202, name: "Website Redesign P1", defaultDuration: 2, pillar: "FB", roadmapGrade: false, phaseOf: 201, phase: 1 },
  { sku: 203, name: "Website Redesign P2", defaultDuration: 2, pillar: "FB", roadmapGrade: false, phaseOf: 201, phase: 2 },
  { sku: 204, name: "New Website", defaultDuration: 4, pillar: "FB", roadmapGrade: true },
  { sku: 205, name: "New Website P1", defaultDuration: 2, pillar: "FB", roadmapGrade: false, phaseOf: 204, phase: 1 },
  { sku: 206, name: "New Website P2", defaultDuration: 2, pillar: "FB", roadmapGrade: false, phaseOf: 204, phase: 2 },
  { sku: 301, name: "Design Only", defaultDuration: 2, pillar: "FB", roadmapGrade: false },
  { sku: 302, name: "Development Only", defaultDuration: 3, pillar: "FB", roadmapGrade: false },
  { sku: 303, name: "CMS Replatform", defaultDuration: 3, pillar: "FB", roadmapGrade: false },
  { sku: 304, name: "Single Page Website", defaultDuration: 1, pillar: "FB", roadmapGrade: false },
  { sku: 305, name: "Landing Page", defaultDuration: 1, pillar: "FB", roadmapGrade: true },

  // Growth & Optimization
  { sku: 401, name: "Search Engine Optimization", defaultDuration: 9, pillar: "GO", roadmapGrade: true },
  { sku: 402, name: "PPC Management", defaultDuration: 9, pillar: "GO", roadmapGrade: true },
  { sku: 403, name: "Continuous Improvement", defaultDuration: 8, pillar: "GO", roadmapGrade: true },
  { sku: 404, name: "Analytics Maintenance", defaultDuration: 9, pillar: "GO", roadmapGrade: true },
  { sku: 405, name: "Monthly Performance Report", defaultDuration: 9, pillar: "GO", roadmapGrade: true },

  // Technical & Support
  { sku: 501, name: "On-Demand Support", defaultDuration: 8, pillar: "TS", roadmapGrade: true },
  { sku: 502, name: "Quarterly Maintenance", defaultDuration: 9, pillar: "TS", roadmapGrade: true },
  { sku: 503, name: "Legacy Retainer", defaultDuration: 12, pillar: "TS", roadmapGrade: false },
];

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function getMonthLabels(startMonthIndex: number, totalMonths: number = 12): string[] {
  return Array.from({ length: totalMonths }, (_, i) => MONTH_NAMES[(startMonthIndex + i) % 12]);
}

export function getMonthYearLabels(startMonthIndex: number, totalMonths: number = 12): { month: string; year: number }[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: totalMonths }, (_, i) => {
    const monthIdx = (startMonthIndex + i) % 12;
    const yearOffset = Math.floor((startMonthIndex + i) / 12);
    return { month: MONTH_NAMES[monthIdx], year: currentYear + yearOffset };
  });
}
