/**
 * Shared badge color maps — single source of truth.
 *
 * Used by Plans, Companies, Contacts, CompanyDetail, and other pages.
 * Import from here instead of defining inline.
 */

// ── Deal statuses (HubSpot pipeline) ──
export const DEAL_STATUS_COLORS: Record<string, string> = {
  won: 'bg-green-500/15 text-green-400',
  lost: 'bg-red-500/15 text-red-400',
  open: 'bg-blue-500/15 text-blue-400',
  archived: 'bg-gray-500/15 text-gray-400',
  closed: 'bg-gray-500/15 text-gray-400',
};

// ── Lead statuses (HubSpot contacts) ──
export const LEAD_STATUS_COLORS: Record<string, string> = {
  'Inbound': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  'Contacting': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Scheduled': 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  'Future Follow-Up': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

// ── Lead statuses — border-only variant (ContactsPage list view) ──
export const LEAD_STATUS_BORDER_COLORS: Record<string, string> = {
  'Inbound': 'text-foreground border-emerald-500',
  'Contacting': 'text-foreground border-blue-500',
  'Scheduled': 'text-foreground border-violet-500',
  'Future Follow-Up': 'text-foreground border-amber-500',
};

// ── Company statuses ──
export const COMPANY_STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  past: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

// ── Company statuses — border-only variant (CompaniesPage list view) ──
export const COMPANY_STATUS_BORDER_COLORS: Record<string, string> = {
  prospect: 'text-foreground border-blue-500',
  active: 'text-foreground border-green-500',
  past: 'text-foreground border-yellow-500',
  archived: 'text-foreground border-zinc-500',
};

// ── Plan / workflow statuses ──
export const PLAN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  ready: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'in-progress': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  shipped: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

// ── Priority levels ──
export const PRIORITY_COLORS: Record<string, string> = {
  p0: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  p1: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  p2: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  p3: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
};

// ── Tier levels (plan tiers) ──
export const TIER_COLORS: Record<string, string> = {
  '0': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  '1': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
  '2': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  '3': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  '4': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  '5': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  '6': 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
};

// ── Ticket statuses (Freshdesk) ──
export const TICKET_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-blue-500/15 text-blue-400',
  Pending: 'bg-amber-500/15 text-amber-400',
  Resolved: 'bg-green-500/15 text-green-400',
  Closed: 'bg-green-500/15 text-green-400',
};

// ── Ticket priority (Freshdesk) ──
export const TICKET_PRIORITY_COLORS: Record<string, string> = {
  Low: 'text-zinc-400',
  Medium: 'text-blue-400',
  High: 'text-amber-400',
  Urgent: 'text-red-400',
};

// ── Project statuses (Harvest) ──
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  archived: 'bg-zinc-500/15 text-zinc-400',
};

// ── Seniority levels (Apollo contacts) ──
export const SENIORITY_COLORS: Record<string, string> = {
  c_suite: 'bg-purple-500/15 text-purple-400',
  vp: 'bg-indigo-500/15 text-indigo-400',
  director: 'bg-blue-500/15 text-blue-400',
  manager: 'bg-teal-500/15 text-teal-400',
  senior: 'bg-green-500/15 text-green-400',
  owner: 'bg-orange-500/15 text-orange-400',
};

// ── Contact role badges ──
export const CONTACT_ROLE_COLORS: Record<string, string> = {
  primary: 'text-foreground border-violet-500',
};

// ── Effort t-shirt sizes ──
export const EFFORT_LABELS: Record<string, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
  xl: 'XL',
};

// ── Pattern types ──
export const PATTERN_TYPE_COLORS: Record<string, string> = {
  conversion: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  layout: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  content: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  navigation: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  engagement: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  seo: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  accessibility: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
};

// ── Pattern industries ──
export const INDUSTRY_COLORS: Record<string, string> = {
  saas: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  healthcare: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  nonprofit: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  legal: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  home_services: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  cross_industry: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  manufacturing: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  education: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  financial_services: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  ecommerce: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  professional_services: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
};

// ── Pattern statuses ──
export const PATTERN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  validated: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  deprecated: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  suggested: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
};

// ── Application outcomes ──
export const OUTCOME_COLORS: Record<string, string> = {
  improved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  neutral: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  declined: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};
