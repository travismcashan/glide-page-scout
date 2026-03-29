import { supabase } from '@/integrations/supabase/client';

/**
 * Simplified Estimate Engine — 3 calculation modes:
 * 1. FIXED      → hours are constant regardless of project size
 * 2. VARIABLE   → hours scale with a driver (project_size, layouts, pages, qty, etc.)
 * 3. PERCENTAGE → phase gets % of subtotal
 */

// Display type for UI — maps internal calc_types to 3 modes
export type CalcMode = 'fixed' | 'variable' | 'percentage';

// Keep the full internal calc_type for backward compat with existing data
export type TaskCalcType = 'size' | 'complexity' | 'variable' | 'scope' | 'percentage' | 'conditional' | 'manual' | 'form_tiers' | 'bulk_import' | 'bulk_import_check' | 'size_multiplied';

export interface FormulaConfig {
  calc_type: TaskCalcType;
  // Size buckets
  small?: number;
  medium?: number;
  large?: number;
  // Complexity buckets
  simple?: number;
  moderate?: number;
  complex?: number;
  // Scope/variable
  variable?: string;
  multiplier?: number;
  min?: number;
  // Percentage
  of?: string;
  pct?: number;
  // Conditional
  field?: string;
  when_scope_only?: number;
  otherwise?: number;
  when_positive?: string;
  // Form tiers
  s_rate?: number;
  m_rate?: number;
  l_rate?: number;
  fallback_rate?: number;
  // Bulk import
  acf_table?: Record<string, number>;
  no_acf_table?: Record<string, number>;
  table?: Record<string, number>;
  // Size multiplied
  // Manual fixed
  fixed_hpp?: number;
}

export interface TaskFormula {
  id: string;
  task_name_pattern: string;
  variable_name: string;
  base_hours: number;
  hours_per_unit: number;
  description: string | null;
  is_active: boolean;
}

export interface EstimateVariables {
  name: string;
  client_name: string | null;
  description: string | null;
  project_size: string | null;
  project_complexity: string | null;
  user_personas: number | null;
  content_pages: number | null;
  design_layouts: number | null;
  form_count: number | null;
  form_count_s: number | null;
  form_count_m: number | null;
  form_count_l: number | null;
  integration_count: number | null;
  paid_discovery: string | null;
  pages_for_integration: number | null;
  custom_posts: number | null;
  bulk_import_amount: string | null;
  site_builder_acf: boolean | null;
  third_party_integrations: number | null;
  post_launch_services: number | null;
  complexity_score: number | null;
  pm_percentage?: number | null;
  qa_percentage?: number | null;
}

let cachedFormulas: TaskFormula[] | null = null;

export async function fetchFormulas(): Promise<TaskFormula[]> {
  if (cachedFormulas) return cachedFormulas;
  const { data, error } = await supabase
    .from('task_formulas')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) {
    console.error('Error fetching formulas:', error);
    return [];
  }
  cachedFormulas = (data || []) as TaskFormula[];
  return cachedFormulas;
}

export function clearFormulaCache() {
  cachedFormulas = null;
}

// ─── Display Helpers ───────────────────────────────────────────────

/** Map internal calc_type to simplified display mode */
export function getCalcMode(fc: FormulaConfig | null | undefined): CalcMode {
  if (!fc?.calc_type) return 'fixed';
  switch (fc.calc_type) {
    case 'percentage': return 'percentage';
    case 'complexity':
    case 'scope':
    case 'variable':
    case 'conditional':
    case 'form_tiers':
    case 'bulk_import':
    case 'bulk_import_check':
      return 'variable';
    case 'manual':
    default:
      return 'fixed';
  }
}

/** Get the driver name for variable tasks */
export function getDriver(fc: FormulaConfig | null | undefined): string {
  if (!fc?.calc_type) return '-';
  switch (fc.calc_type) {
    case 'complexity':
      return 'project_complexity';
    case 'scope':
      return fc.variable || 'unknown';
    case 'variable':
      return 'qty';
    case 'form_tiers':
      return 'forms';
    case 'bulk_import':
    case 'bulk_import_check':
      return 'bulk_import';
    case 'conditional':
      return fc.field || 'conditional';
    default:
      return '-';
  }
}

// ─── Derivation ────────────────────────────────────────────────────

/** @deprecated project_size no longer drives calculations — kept for display only */
export function deriveProjectSize(v: EstimateVariables): string {
  const sum = (v.design_layouts ?? 5) + (v.pages_for_integration ?? 20) + (v.custom_posts ?? 2);
  if (sum <= 30) return 'Small';
  if (sum <= 100) return 'Medium';
  return 'Large';
}

/** Derive project complexity from weighted score: Simple/Moderate/Complex */
export function deriveProjectComplexity(v: EstimateVariables): string {
  const score = v.complexity_score ?? (v.third_party_integrations ?? 2);
  if (score <= 8) return 'Simple';
  if (score <= 20) return 'Moderate';
  return 'Complex';
}

// ─── Internal Calculation Helpers ──────────────────────────────────

/** @deprecated kept for backward compat if any old data uses size tiers */
function bySizeNum(size: string, small: number, medium: number, large: number): number {
  if (size === 'Small') return small;
  if (size === 'Large') return large;
  return medium;
}

function byComplexity(complexity: string, simple: number, moderate: number, complex: number): number {
  if (complexity === 'Simple') return simple;
  if (complexity === 'Complex') return complex;
  return moderate;
}

/** Count roles from comma-separated string */
export function countRoles(roles: string | null | undefined): number {
  if (!roles) return 1;
  return roles.split(',').map(r => r.trim()).filter(Boolean).length || 1;
}

// ─── Core Engine ───────────────────────────────────────────────────

/**
 * Calculate hours for a single task based on its formula_config.
 * Handles all 3 modes: fixed (no formula or manual), variable (size/complexity/scope/qty/forms/bulk), percentage.
 */
export function calculateTaskFromFormula(
  formulaConfig: FormulaConfig | null | undefined,
  currentHpp: number,
  roles: string | null,
  variableQty: number | null,
  variables: EstimateVariables,
  allSelectedHours?: number
): { hpp: number; total: number } {
  const roleCount = countRoles(roles);

  // FIXED: no formula — use currentHpp as-is
  if (!formulaConfig || !formulaConfig.calc_type) {
    const hpp = Math.max(currentHpp, 0);
    return { hpp, total: Math.round(hpp * roleCount * 100) / 100 };
  }

  const size = deriveProjectSize(variables);
  const complexity = deriveProjectComplexity(variables);
  const pages = variables.pages_for_integration ?? 20;
  const layouts = variables.design_layouts ?? 5;
  const personas = variables.user_personas ?? 3;
  const customPosts = variables.custom_posts ?? 2;
  const forms = variables.form_count ?? 2;
  const bulkImport = variables.bulk_import_amount ?? '<500';
  const siteBuilderAcf = variables.site_builder_acf ?? true;
  const paidDiscovery = variables.paid_discovery ?? 'scope_only';
  const postLaunchServices = variables.post_launch_services ?? 0;
  const fc = formulaConfig;

  let hpp: number;

  switch (fc.calc_type) {

    case 'complexity':
      hpp = byComplexity(complexity, fc.simple ?? 0, fc.moderate ?? 0, fc.complex ?? 0);
      break;

    case 'scope': {
      let val: number;
      switch (fc.variable) {
        case 'personas': val = personas; break;
        case 'layouts': val = layouts; break;
        case 'layouts_minus_2': val = Math.max(layouts - 2, 0); break;
        case 'pages': val = pages; break;
        case 'custom_posts': val = customPosts; break;
        case 'pages_plus_cpts': val = pages + customPosts; break;
        default: val = 1;
      }
      hpp = val * (fc.multiplier ?? 1);
      if (fc.min != null) hpp = Math.max(hpp, fc.min);
      break;
    }

    case 'variable':
      hpp = (variableQty ?? 1) * (fc.multiplier ?? 1);
      break;

    case 'conditional':
      if (fc.field === 'paid_discovery') {
        hpp = (paidDiscovery === 'scope_only' || !paidDiscovery) ? (fc.when_scope_only ?? 1) : (fc.otherwise ?? 0.5);
      } else if (fc.field === 'post_launch_services') {
        hpp = postLaunchServices > 0 ? postLaunchServices : 0;
      } else {
        hpp = currentHpp;
      }
      break;

    case 'form_tiers': {
      const sF = variables.form_count_s ?? 0;
      const mF = variables.form_count_m ?? 0;
      const lF = variables.form_count_l ?? 0;
      hpp = (sF > 0 || mF > 0 || lF > 0)
        ? (sF * (fc.s_rate ?? 0)) + (mF * (fc.m_rate ?? 0)) + (lF * (fc.l_rate ?? 0))
        : forms * (fc.fallback_rate ?? 0.5);
      break;
    }

    case 'bulk_import': {
      const table = siteBuilderAcf ? fc.acf_table : fc.no_acf_table;
      hpp = table?.[bulkImport] ?? table?.['<500'] ?? 0;
      if (bulkImport === 'none') hpp = 0;
      break;
    }

    case 'bulk_import_check': {
      hpp = fc.table?.[bulkImport] ?? fc.table?.['<500'] ?? 0;
      if (bulkImport === 'none') hpp = 0;
      break;
    }

    case 'manual':
      hpp = fc.fixed_hpp ?? currentHpp;
      break;

    // ── PERCENTAGE ──
    case 'percentage':
      hpp = Math.round((allSelectedHours ?? 0) * (fc.pct ?? 0.06) * 100) / 100;
      break;

    default:
      hpp = currentHpp;
  }

  hpp = Math.max(hpp, 0);
  const total = Math.round(hpp * roleCount * 100) / 100;
  return { hpp: Math.round(hpp * 100) / 100, total };
}

// Legacy wrapper
export function calculateTaskFromXlsx(
  taskName: string,
  currentHpp: number,
  roles: string | null,
  variableQty: number | null,
  variables: EstimateVariables,
  allSelectedHours?: number
): { hpp: number; total: number } {
  return calculateTaskFromFormula(null, currentHpp, roles, variableQty, variables, allSelectedHours);
}

/** Returns the calc mode for display */
export function getTaskCalcType(taskName: string, formulaConfig?: FormulaConfig | null): TaskCalcType {
  if (formulaConfig?.calc_type) return formulaConfig.calc_type as TaskCalcType;
  return 'manual';
}

/** Returns true if a task has a formula_config */
export function isFormulaTask(taskName: string, formulaConfig?: FormulaConfig | null): boolean {
  return !!formulaConfig?.calc_type;
}

/** Human-readable formula description */
export function describeFormula(fc: FormulaConfig | null | undefined): string {
  if (!fc) return 'Fixed hours';
  const mode = getCalcMode(fc);
  switch (mode) {
    case 'fixed':
      return fc.fixed_hpp != null ? `${fc.fixed_hpp}h fixed` : 'Fixed hours';
    case 'percentage':
      return `${((fc.pct ?? 0) * 100).toFixed(0)}% of subtotal`;
    case 'variable': {
      const driver = getDriver(fc);
      switch (fc.calc_type) {
        case 'complexity':
          return `Simple:${fc.simple} Mod:${fc.moderate} Complex:${fc.complex}`;
        case 'scope':
          return `${driver} × ${fc.multiplier}${fc.min != null ? ` min:${fc.min}` : ''}`;
        case 'variable':
          return `qty × ${fc.multiplier}`;
        case 'conditional':
          if (fc.field === 'paid_discovery') return `scope_only→${fc.when_scope_only}h, paid→${fc.otherwise}h`;
          if (fc.field === 'post_launch_services') return `post_launch value or 0`;
          return 'Conditional';
        case 'form_tiers':
          return `S×${fc.s_rate} M×${fc.m_rate} L×${fc.l_rate}`;
        case 'bulk_import':
          return `bulk import lookup`;
        case 'bulk_import_check':
          return `bulk check lookup`;
        default:
          return `${driver}`;
      }
    }
    default:
      return 'Fixed hours';
  }
}

export function getBulkImportHours(amount: string | null, siteBuilderAcf: boolean = true): number {
  if (amount === 'none') return 0;
  if (siteBuilderAcf) {
    switch (amount) {
      case '<500': case '< 500': return 28;
      case '500-1000': case '500 +': return 38;
      case '1000-5000': return 52;
      case '>5000': return 72;
      default: return 28;
    }
  } else {
    switch (amount) {
      case '<500': case '< 500': return 16;
      case '500-1000': case '500 +': return 22;
      case '1000-5000': return 32;
      case '>5000': return 44;
      default: return 16;
    }
  }
}

/** Calculate total hours for a task using the formula engine */
export function calculateTaskHours(
  taskName: string,
  defaultHours: number,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
): { hours: number; formula: string | null } {
  return { hours: defaultHours, formula: null };
}

/** PM and QA phase names used for percentage-based calculation */
const PM_PHASE = 'Project Management';
const QA_PHASE = 'QA';

/** Phases that count as "core work" for percentage-based PM/QA calculation */
const CORE_PHASES = new Set(['Strategy', 'Design', 'Build', 'Content', 'Optimization', 'Review']);

export function recalculateAllTasks(
  tasks: Array<{
    id: string;
    task_name: string;
    hours: number;
    base_hours?: number | null;
    roles?: string | null;
    hours_per_person?: number | null;
    variable_qty?: number | null;
    is_selected?: boolean;
    phase_name?: string | null;
    formula_config?: FormulaConfig | null;
  }>,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
) {
  const pmPct = (variables.pm_percentage ?? 8) / 100;
  const qaPct = (variables.qa_percentage ?? 6) / 100;

  // Pass 1: Calculate all core phase tasks (not PM, QA, or percentage-based)
  const pass1 = tasks.map(task => {
    const phase = task.phase_name || '';
    const fc = task.formula_config as FormulaConfig | null | undefined;
    if (phase === PM_PHASE || phase === QA_PHASE || fc?.calc_type === 'percentage') return task;
    const currentHpp = task.hours_per_person ?? task.hours;
    const result = calculateTaskFromFormula(fc, currentHpp, task.roles, task.variable_qty, variables);
    return { ...task, hours_per_person: result.hpp, hours: result.total };
  });

  // Calculate core subtotal (selected tasks in core phases)
  const coreSubtotal = pass1
    .filter(t => t.is_selected && CORE_PHASES.has(t.phase_name || ''))
    .reduce((sum, t) => sum + Number(t.hours), 0);

  // Pass 2: Distribute PM and QA hours proportionally across their tasks
  const pmTasks = tasks.filter(t => t.phase_name === PM_PHASE && (t.formula_config as FormulaConfig | null)?.calc_type !== 'percentage');
  const qaTasks = tasks.filter(t => t.phase_name === QA_PHASE);

  const pmTargetHours = coreSubtotal * pmPct;
  const qaTargetHours = coreSubtotal * qaPct;

  const distributePhaseHours = (phaseTasks: typeof tasks, targetTotal: number, allTasks: typeof pass1) => {
    if (phaseTasks.length === 0) return;
    const naturalHours = phaseTasks.map(t => {
      const currentHpp = t.hours_per_person ?? t.hours;
      const fc = t.formula_config as FormulaConfig | null | undefined;
      const result = calculateTaskFromFormula(fc, currentHpp, t.roles, t.variable_qty, variables);
      return { id: t.id, hpp: result.hpp, total: result.total, roleCount: countRoles(t.roles) };
    });
    const naturalTotal = naturalHours.reduce((s, t) => s + t.total, 0);

    phaseTasks.forEach(t => {
      const idx = allTasks.findIndex(at => at.id === t.id);
      if (idx === -1) return;
      const natural = naturalHours.find(n => n.id === t.id)!;
      const weight = naturalTotal > 0 ? natural.total / naturalTotal : 1 / phaseTasks.length;
      const allocatedTotal = Math.round(targetTotal * weight * 100) / 100;
      const roleCount = natural.roleCount;
      const hpp = Math.round((allocatedTotal / roleCount) * 100) / 100;
      allTasks[idx] = { ...allTasks[idx], hours_per_person: hpp, hours: allocatedTotal };
    });
  };

  const pass2 = [...pass1];
  distributePhaseHours(pmTasks, pmTargetHours, pass2);
  distributePhaseHours(qaTasks, qaTargetHours, pass2);

  // Pass 3: Calculate percentage-based tasks (Admin Hours)
  const selectedTotal = pass2
    .filter(t => t.is_selected && (t.formula_config as FormulaConfig | null)?.calc_type !== 'percentage')
    .reduce((sum, t) => sum + Number(t.hours), 0);

  return pass2.map(task => {
    const fc = task.formula_config as FormulaConfig | null | undefined;
    if (fc?.calc_type === 'percentage') {
      const result = calculateTaskFromFormula(fc, 0, task.roles, task.variable_qty, variables, selectedTotal);
      return { ...task, hours_per_person: result.hpp, hours: result.total };
    }
    return task;
  });
}

/** Calculate the base model — minimum project cost with all variables at minimum */
export function calculateBaseModel(
  tasks: Array<{
    id?: string;
    task_name: string;
    hours: number;
    roles?: string | null;
    hours_per_person?: number | null;
    variable_qty?: number | null;
    is_selected?: boolean;
    is_required?: boolean;
    default_included?: boolean;
    phase_name?: string | null;
    hourly_rate?: number;
    formula_config?: FormulaConfig | null;
  }>,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
): { totalHours: number; totalCost: number } {
  // Base model = absolute minimum: all vars at 1, only required+default_included tasks
  const minVars: EstimateVariables = {
    ...variables,
    design_layouts: 1,
    pages_for_integration: 1,
    user_personas: 1,
    custom_posts: 0,
    form_count: 1,
    form_count_s: 1,
    form_count_m: 0,
    form_count_l: 0,
    third_party_integrations: 1,
    complexity_score: 1,
    bulk_import_amount: 'none',
    post_launch_services: 0,
  };

  // Filter: only is_required tasks for the base model (ignore user selections)
  // Reset variable_qty to 1
  const tasksWithIds = tasks.map((t, i) => ({
    ...t,
    id: t.id || `base-${i}`,
    variable_qty: 1,
    is_selected: !!t.is_required,
  }));

  const recalced = recalculateAllTasks(tasksWithIds, minVars, formulas);
  const selected = recalced.filter(t => t.is_selected);
  const totalHours = selected.reduce((s, t) => s + Math.max(Number(t.hours), 0), 0);
  const totalCost = selected.reduce((s, t) => s + Math.max(Number(t.hours), 0) * Number((t as any).hourly_rate || 150), 0);
  return { totalHours, totalCost };
}

/** Phase timeline calculation */
export function calculatePhaseTimeline(
  byPhase: Record<string, { hours: number; cost: number }>
): Array<{ phase: string; hours: number; lowWeeks: number; highWeeks: number; lowDays: number; highDays: number }> {
  return Object.entries(byPhase).map(([phase, data]) => ({
    phase,
    hours: data.hours,
    lowDays: Math.round((data.hours / 8) * 1000) / 1000,
    highDays: Math.round((data.hours / 6) * 10) / 10,
    lowWeeks: Math.round((data.hours / 40) * 1000) / 1000,
    highWeeks: Math.round((data.hours / 30) * 100) / 100,
  }));
}
