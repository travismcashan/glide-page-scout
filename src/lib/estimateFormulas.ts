import { supabase } from '@/integrations/supabase/client';

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
  integration_count: number | null;
  paid_discovery: string | null;
  pages_for_integration: number | null;
  custom_posts: number | null;
  bulk_import_amount: string | null;
  site_builder_acf: boolean | null;
  third_party_integrations: number | null;
  post_launch_services: number | null;
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

/** Derive project size from variables: Small/Medium/Large */
export function deriveProjectSize(v: EstimateVariables): string {
  const sum = (v.design_layouts ?? 5) + (v.pages_for_integration ?? 20) + (v.custom_posts ?? 2);
  if (sum <= 30) return 'Small';
  if (sum <= 100) return 'Medium';
  return 'Large';
}

/** Derive project complexity from variables: Simple/Moderate/Complex */
export function deriveProjectComplexity(v: EstimateVariables): string {
  const integrations = v.third_party_integrations ?? 2;
  if (integrations <= 5) return 'Simple';
  if (integrations <= 10) return 'Moderate';
  return 'Complex';
}

/** Pick value based on project size */
function bySizeNum(size: string, small: number, medium: number, large: number): number {
  if (size === 'Small') return small;
  if (size === 'Large') return large;
  return medium;
}

/** Pick value based on project complexity */
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

/**
 * Master formula engine - calculates hours_per_person for each task
 * based on the XLSX formulas from Jessica's Estimator Tool.
 * Returns { hpp, total } where total = hpp * roleCount (unless overridden).
 */
export function calculateTaskFromXlsx(
  taskName: string,
  currentHpp: number,
  roles: string | null,
  variableQty: number | null,
  variables: EstimateVariables,
  allSelectedHours?: number // for Admin Hours calc
): { hpp: number; total: number } {
  const size = deriveProjectSize(variables);
  const complexity = deriveProjectComplexity(variables);
  const roleCount = countRoles(roles);
  const pages = variables.pages_for_integration ?? 20;
  const layouts = variables.design_layouts ?? 5;
  const personas = variables.user_personas ?? 3;
  const customPosts = variables.custom_posts ?? 2;
  const forms = variables.form_count ?? 2;
  const bulkImport = variables.bulk_import_amount ?? '<500';
  const siteBuilderAcf = variables.site_builder_acf ?? true;
  const paidDiscovery = variables.paid_discovery ?? 'scope_only';
  const postLaunchServices = variables.post_launch_services ?? 0;
  const name = taskName.trim();

  let hpp: number | null = null; // hours per person (if computed)

  // === PROJECT MANAGEMENT ===
  if (/^Timeline \(setup \+ adjustments\)$/i.test(name)) {
    hpp = bySizeNum(size, 2.5, 3.5, 4.5);
  } else if (/^KOC Prep \+ Recap$/i.test(name)) {
    hpp = bySizeNum(size, 2, 2.5, 3);
  } else if (/^Admin Hours$/i.test(name)) {
    // 6% of all selected task hours (excluding admin itself)
    const base = allSelectedHours ?? 0;
    hpp = Math.round(base * 0.06 * 100) / 100;
  }

  // === STRATEGY - Size-based ===
  else if (/^Current Site Review$/i.test(name)) {
    hpp = bySizeNum(size, 0.5, 1, 1.5);
  } else if (/^Content Inventory$/i.test(name)) {
    hpp = bySizeNum(size, 1, 1.5, 2);
  } else if (/^Content Audit$/i.test(name)) {
    hpp = bySizeNum(size, 1, 2, 3);
  } else if (/^Competitor Review$/i.test(name)) {
    hpp = bySizeNum(size, 2, 2, 3);
  } else if (/^SEO Insights$/i.test(name)) {
    hpp = bySizeNum(size, 1, 1.5, 2);
  } else if (/^Hotjar Review$/i.test(name) && !/Check/i.test(name)) {
    hpp = bySizeNum(size, 1, 1.5, 2);
  } else if (/^Keyword Research$/i.test(name)) {
    hpp = bySizeNum(size, 2, 2.5, 3);
  } else if (/^Information Architecture$/i.test(name)) {
    hpp = bySizeNum(size, 4, 6, 8);
  }

  // === STRATEGY - Paid Discovery based ===
  else if (/^Strategy Workshop \(KOC\)$/i.test(name)) {
    hpp = (paidDiscovery === 'scope_only' || !paidDiscovery) ? 1.5 : 0.5;
  } else if (/^Strategy Review$/i.test(name)) {
    hpp = (paidDiscovery === 'scope_only' || !paidDiscovery) ? 1 : 0.5;
  }

  // === STRATEGY - Variable-based (personas) ===
  else if (/^User Personas$/i.test(name)) {
    hpp = personas * 1;
  } else if (/^User Journey Map$/i.test(name)) {
    hpp = personas * 1.5;
  } else if (/^Empathy Map$/i.test(name)) {
    hpp = personas * 2.5;
  } else if (/^Scenario Map$/i.test(name)) {
    hpp = personas * 3;
  }

  // === STRATEGY - Variable tasks with qty ===
  else if (/^Design Thinking Workshop$/i.test(name)) {
    const qty = variableQty ?? 4;
    hpp = qty * 1;
  } else if (/^Brainstorming Sessions$/i.test(name)) {
    const qty = variableQty ?? 1;
    hpp = qty * 1;
  } else if (/^Interviews$/i.test(name)) {
    const qty = variableQty ?? 4;
    hpp = qty * 2.5;
  } else if (/^Moderated User Testing$/i.test(name) && !/Design Validation/i.test(name)) {
    const qty = variableQty ?? 4;
    hpp = qty * 3;
  } else if (/^Focus Groups$/i.test(name) && !/Design Validation/i.test(name)) {
    const qty = variableQty ?? 1;
    hpp = qty * 6;
  }

  // === STRATEGY - Complexity-based ===
  else if (/^Functional Requirements$/i.test(name)) {
    hpp = byComplexity(complexity, 2, 3, 4);
  } else if (/^Heuristic Evaluation$/i.test(name) && !/Design Validation/i.test(name)) {
    hpp = 0.5; // multi-role
  }

  // === DESIGN ===
  else if (/^Client Design Review \(weekly\)$/i.test(name)) {
    hpp = bySizeNum(size, 4, 5, 6);
  } else if (/^Storybrand > WFs \+ Copy Writing$/i.test(name)) {
    hpp = layouts * 2.4;
  } else if (/^Internal Page SFs$/i.test(name)) {
    hpp = (layouts - 2) * 1.5;
  } else if (/^Internal Page Layouts$/i.test(name)) {
    hpp = (layouts - 2) * 4.75;
  } else if (/^Toolkit Outline$/i.test(name)) {
    hpp = bySizeNum(size, 0.5, 1, 1.5);
  } else if (/^Responsive$/i.test(name)) {
    hpp = layouts * 0.5;
  } else if (/^Revisions$/i.test(name)) {
    hpp = layouts * 1;
  } else if (/^Block Map \+ Functional Notes$/i.test(name)) {
    hpp = bySizeNum(size, 1, 2, 2.5);
  } else if (/^Content Collection$/i.test(name) && !/Client Call/i.test(name)) {
    hpp = bySizeNum(size, 2, 4, 6);
  } else if (/^Technical Roadmap > Create$/i.test(name)) {
    hpp = byComplexity(complexity, 1, 1.5, 2);
  } else if (/^Functional Notes$/i.test(name) && !/Block Map/i.test(name)) {
    hpp = bySizeNum(size, 0.5, 1, 1.5);
  } else if (/^UX Notes$/i.test(name)) {
    hpp = bySizeNum(size, 0.5, 1, 1.5);
  }

  // === DESIGN VALIDATION - Variable tasks ===
  else if (/^Design Validation > Moderated User Testing$/i.test(name)) {
    const qty = variableQty ?? 4;
    hpp = qty * 1;
  } else if (/^Design Validation > Focus Groups$/i.test(name)) {
    const qty = variableQty ?? 1;
    hpp = qty * 6;
  }

  // === BUILD ===
  else if (/^CSS, HTML, Javascript$/i.test(name)) {
    hpp = layouts * 7;
  } else if (/^Wordpress Development$/i.test(name)) {
    hpp = layouts * 4;
  } else if (/^Standard Third Party Plugins \+ Integrations$/i.test(name)) {
    hpp = byComplexity(complexity, 8, 10, 12);
  } else if (/^Performance Optimization$/i.test(name)) {
    hpp = bySizeNum(size, 6, 8, 12);
  } else if (/^Quality Assurance$/i.test(name)) {
    hpp = layouts * 2;
  }

  // === CONTENT ===
  else if (/^Content Integration \(primary, secondary, footer\)$/i.test(name) || /^Content Integration$/i.test(name)) {
    hpp = pages * 0.8;
  } else if (/^Additional CPT Integration$/i.test(name)) {
    hpp = customPosts * 0.5;
  } else if (/^Bulk Import$/i.test(name) && !/Check/i.test(name)) {
    hpp = getBulkImportHours(bulkImport, siteBuilderAcf);
  } else if (/^Bulk Import > Check \+ Clean$/i.test(name)) {
    hpp = getBulkImportCheckHours(bulkImport);
  } else if (/^Form Integration$/i.test(name)) {
    hpp = forms * 0.5;
  } else if (/^Content \+ CMS Review$/i.test(name)) {
    hpp = (pages + customPosts) * 0.1;
  } else if (/^URL Swap \+ Check$/i.test(name)) {
    hpp = (pages + customPosts) * 0.1;
  }

  // === REVIEW ===
  else if (/^Design Review$/i.test(name)) {
    hpp = pages * 0.05;
  } else if (/^UX Review$/i.test(name)) {
    hpp = pages * 0.05;
  } else if (/^AMP Review$/i.test(name)) {
    hpp = pages * 0.02;
  } else if (/^Functional Review$/i.test(name)) {
    hpp = pages * 0.05;
  }

  // === OPTIMIZATION ===
  else if (/^301 Redirect Setup$/i.test(name)) {
    hpp = bySizeNum(size, 2, 4, 6);
  } else if (/^Technical On-Page SEO$/i.test(name)) {
    hpp = bySizeNum(size, 4, 6, 8);
  } else if (/^Alt Image\/Title Integraton$/i.test(name) || /^Alt Image.Title Integration$/i.test(name)) {
    hpp = bySizeNum(size, 4, 6, 8);
  } else if (/^Resolve Self Inflicted 301s$/i.test(name)) {
    hpp = bySizeNum(size, 1, 1.5, 2);
  }

  // === QA ===
  else if (/^QA Forms$/i.test(name)) {
    hpp = forms * 0.25;
  } else if (/^Proof Reading$/i.test(name)) {
    hpp = pages * 0.05;
  } else if (/^DoneDone Management$/i.test(name)) {
    hpp = bySizeNum(size, 1, 3, 4.5) * 8;
  }

  // === POST LAUNCH ===
  else if (/^Services Handoff Meeting$/i.test(name)) {
    hpp = postLaunchServices > 0 ? postLaunchServices : 0;
  }

  // If no formula matched, keep current hpp
  if (hpp === null) {
    hpp = currentHpp;
  }

  // Calculate total: hpp * roleCount (XLSX pattern)
  const total = Math.round(hpp * roleCount * 100) / 100;

  return { hpp: Math.round(hpp * 100) / 100, total };
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

function getBulkImportCheckHours(amount: string | null): number {
  if (amount === 'none') return 0;
  switch (amount) {
    case '<500': case '< 500': return 4;
    case '500-1000': case '500 +': return 6;
    case '1000-5000': return 10;
    case '>5000': return 16;
    default: return 4;
  }
}

/** Calculate total hours for a task using the XLSX formula engine */
export function calculateTaskHours(
  taskName: string,
  defaultHours: number,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
): { hours: number; formula: string | null } {
  const result = calculateTaskFromXlsx(taskName, defaultHours, null, null, variables);
  if (result.hpp !== defaultHours) {
    return { hours: result.total, formula: `Calculated from variables` };
  }
  return { hours: defaultHours, formula: null };
}

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
  }>,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
) {
  // First pass: calculate all tasks except Admin Hours to get the total
  const firstPass = tasks.map(task => {
    if (/^Admin Hours$/i.test(task.task_name)) return task;
    const currentHpp = task.hours_per_person ?? task.hours;
    const result = calculateTaskFromXlsx(
      task.task_name, currentHpp, task.roles, task.variable_qty, variables
    );
    return { ...task, hours_per_person: result.hpp, hours: result.total };
  });

  // Calculate sum of selected task hours (excluding Admin Hours)
  const selectedTotal = firstPass
    .filter(t => t.is_selected && !/^Admin Hours$/i.test(t.task_name))
    .reduce((sum, t) => sum + Number(t.hours), 0);

  // Second pass: calculate Admin Hours
  return firstPass.map(task => {
    if (/^Admin Hours$/i.test(task.task_name)) {
      const result = calculateTaskFromXlsx(
        task.task_name, 0, task.roles, task.variable_qty, variables, selectedTotal
      );
      return { ...task, hours_per_person: result.hpp, hours: result.total };
    }
    return task;
  });
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
