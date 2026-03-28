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

export function getBulkImportHours(amount: string | null): number {
  switch (amount) {
    case 'none': return 0;
    case '<500': return 28;
    case '500-1000': return 40;
    case '1000-5000': return 60;
    case '>5000': return 80;
    default: return 28;
  }
}

export function calculateTaskHours(
  taskName: string,
  defaultHours: number,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
): { hours: number; formula: string | null } {
  if (/^Bulk Import$/i.test(taskName)) {
    const hours = getBulkImportHours(variables.bulk_import_amount);
    return { hours, formula: `Based on bulk import amount: ${variables.bulk_import_amount}` };
  }

  for (const formula of formulas) {
    const matches = taskName.toLowerCase() === formula.task_name_pattern.toLowerCase() ||
                   taskName.toLowerCase().includes(formula.task_name_pattern.toLowerCase());
    if (matches) {
      const variableValue = variables[formula.variable_name as keyof EstimateVariables];
      const numValue = typeof variableValue === 'number' ? variableValue : 0;
      const calculatedHours = formula.base_hours + (numValue * formula.hours_per_unit);
      return {
        hours: Math.round(calculatedHours * 10) / 10,
        formula: `${formula.description || formula.variable_name} (${numValue} × ${formula.hours_per_unit} = ${calculatedHours.toFixed(1)}h)`
      };
    }
  }

  return { hours: defaultHours, formula: null };
}

export function recalculateAllTasks(
  tasks: Array<{ id: string; task_name: string; hours: number; base_hours?: number | null }>,
  variables: EstimateVariables,
  formulas: TaskFormula[] = []
) {
  return tasks.map(task => {
    const baseHours = (task.base_hours && task.base_hours > 0) ? task.base_hours : task.hours;
    const { hours } = calculateTaskHours(task.task_name, Number(baseHours), variables, formulas);
    return { ...task, hours, base_hours: baseHours };
  });
}
