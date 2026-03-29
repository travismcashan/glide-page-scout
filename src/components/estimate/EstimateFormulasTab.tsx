import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Percent, DollarSign, Search, Layers } from 'lucide-react';
import { type FormulaConfig, type CalcMode, type EstimateVariables, getCalcMode, getDriver, describeFormula } from '@/lib/estimateFormulas';

interface TaskWithFormula {
  task_name: string;
  phase_name: string | null;
  formula_config?: FormulaConfig | null;
  is_required?: boolean;
  hours_per_person?: number | null;
  hours?: number;
  roles?: string | null;
  task_type?: string;
  variable_qty?: number | null;
}

const MODE_LABELS: Record<CalcMode, string> = {
  fixed: 'Fixed',
  variable: 'Variable',
  percentage: '%',
};

const MODE_COLORS: Record<CalcMode, string> = {
  fixed: 'bg-muted text-muted-foreground',
  variable: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  percentage: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
};

const TYPE_COLORS: Record<string, string> = {
  task: '',
  meeting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  deliverable: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

interface Props {
  pmPercentage: number;
  qaPercentage: number;
  blendedRate: number;
  onPmPercentageChange: (val: number) => void;
  onQaPercentageChange: (val: number) => void;
  onBlendedRateChange: (val: number) => void;
  tasks: TaskWithFormula[];
  estimate?: EstimateVariables | null;
}

function resolveDriverQty(driver: string, estimate?: EstimateVariables | null): string | null {
  if (!estimate || driver === '-') return null;
  const numMap: Record<string, number | null | undefined> = {
    design_layouts: estimate.design_layouts,
    content_pages: estimate.content_pages,
    pages_for_integration: estimate.pages_for_integration,
    custom_posts: estimate.custom_posts,
    form_count: estimate.form_count,
    integration_count: estimate.integration_count,
    third_party_integrations: estimate.third_party_integrations,
    user_personas: estimate.user_personas,
    post_launch_services: estimate.post_launch_services,
  };
  if (driver in numMap) {
    const v = numMap[driver];
    return v != null ? String(v) : null;
  }
  // String/derived drivers
  const strMap: Record<string, string | null | undefined> = {
    project_complexity: estimate.project_complexity,
    bulk_import: estimate.bulk_import_amount,
    paid_discovery: estimate.paid_discovery,
  };
  if (driver in strMap) return strMap[driver] ?? null;
  // Form tiers — show S/M/L counts
  if (driver === 'forms') {
    const s = estimate.form_count_s ?? 0;
    const m = estimate.form_count_m ?? 0;
    const l = estimate.form_count_l ?? 0;
    return `${s}/${m}/${l}`;
  }
  return null;
}

export function EstimateFormulasTab({
  pmPercentage,
  qaPercentage,
  blendedRate,
  onPmPercentageChange,
  onQaPercentageChange,
  onBlendedRateChange,
  tasks,
  estimate,
}: Props) {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<CalcMode | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  const rateCardRows = useMemo(() => {
    return tasks.map(t => {
      const fc = t.formula_config as FormulaConfig | null | undefined;
      const mode = getCalcMode(fc);
      const driver = getDriver(fc);
      const taskType = (t as any).task_type || 'task';
      const driverQty = mode === 'variable'
        ? (driver === 'qty' ? (t.variable_qty != null ? String(t.variable_qty) : null) : resolveDriverQty(driver, estimate))
        : null;
      return {
        name: t.task_name,
        phase: t.phase_name || 'Other',
        mode,
        driver: mode === 'variable' ? driver : '-',
        driverQty,
        formula: describeFormula(fc),
        hours: Number(t.hours_per_person ?? t.hours ?? 0),
        required: !!t.is_required,
        roles: t.roles || '',
        taskType,
      };
    });
  }, [tasks, estimate]);

  const filtered = useMemo(() => {
    return rateCardRows.filter(r => {
      if (modeFilter !== 'all' && r.mode !== modeFilter) return false;
      if (typeFilter !== 'all' && r.taskType !== typeFilter) return false;
      if (phaseFilter !== 'all' && r.phase !== phaseFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.name.toLowerCase().includes(s) && !r.formula.toLowerCase().includes(s) && !r.driver.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rateCardRows, search, modeFilter, typeFilter, phaseFilter]);

  const modeCounts = useMemo(() => {
    const counts: Record<string, number> = { fixed: 0, variable: 0, percentage: 0 };
    rateCardRows.forEach(r => { counts[r.mode] = (counts[r.mode] || 0) + 1; });
    return counts;
  }, [rateCardRows]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rateCardRows.forEach(r => { counts[r.taskType] = (counts[r.taskType] || 0) + 1; });
    return counts;
  }, [rateCardRows]);

  const phases = useMemo(() => {
    const set = new Set(rateCardRows.map(r => r.phase));
    return Array.from(set);
  }, [rateCardRows]);

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> PM Phase %
            </CardTitle>
            <CardDescription className="text-xs">Percentage of core subtotal for Project Management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={30} step={0.5} value={pmPercentage} onChange={(e) => onPmPercentageChange(Number(e.target.value))} className="w-20 text-right" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> QA Phase %
            </CardTitle>
            <CardDescription className="text-xs">Percentage of core subtotal for QA tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={30} step={0.5} value={qaPercentage} onChange={(e) => onQaPercentageChange(Number(e.target.value))} className="w-20 text-right" />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Blended Rate
            </CardTitle>
            <CardDescription className="text-xs">Hourly rate applied across all roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input type="number" min={50} max={500} step={5} value={blendedRate} onChange={(e) => onBlendedRateChange(Number(e.target.value))} className="w-24 text-right" />
              <span className="text-sm text-muted-foreground">/hr</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Rate Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Rate Card
          </CardTitle>
          <CardDescription>All {rateCardRows.length} tasks — single source of truth for estimation</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search tasks, formulas, or drivers…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {/* Calc Mode filters */}
              <Badge
                variant={modeFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setModeFilter('all')}
              >
                All ({rateCardRows.length})
              </Badge>
              {(['fixed', 'variable', 'percentage'] as CalcMode[]).map(mode => (
                <Badge
                  key={mode}
                  variant={modeFilter === mode ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs ${modeFilter !== mode ? MODE_COLORS[mode] : ''}`}
                  onClick={() => setModeFilter(modeFilter === mode ? 'all' : mode)}
                >
                  {MODE_LABELS[mode]} ({modeCounts[mode] || 0})
                </Badge>
              ))}

              <span className="text-muted-foreground text-xs self-center px-1">|</span>

              {/* Task type filters */}
              {Object.entries(typeCounts).map(([type, count]) => (
                <Badge
                  key={type}
                  variant={typeFilter === type ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs ${typeFilter !== type ? TYPE_COLORS[type] || '' : ''}`}
                  onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                </Badge>
              ))}

              <span className="text-muted-foreground text-xs self-center px-1">|</span>

              {/* Phase filters */}
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="text-xs border rounded px-2 py-0.5 bg-background text-foreground"
              >
                <option value="all">All Phases</option>
                {phases.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs w-[220px]">Task</TableHead>
                  <TableHead className="h-8 text-xs w-[70px]">Type</TableHead>
                  <TableHead className="h-8 text-xs w-[70px]">Mode</TableHead>
                  <TableHead className="h-8 text-xs w-[90px]">Driver</TableHead>
                  <TableHead className="h-8 text-xs w-[40px] text-right">Qty</TableHead>
                  <TableHead className="h-8 text-xs">Formula</TableHead>
                  <TableHead className="h-8 text-xs w-[60px] text-right">Hrs</TableHead>
                  <TableHead className="h-8 text-xs w-[40px] text-center">Req</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{row.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{row.phase}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {row.taskType !== 'task' && (
                        <Badge variant="secondary" className={`text-[10px] ${TYPE_COLORS[row.taskType] || ''}`}>
                          {row.taskType}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="secondary" className={`text-[10px] ${MODE_COLORS[row.mode]}`}>
                        {MODE_LABELS[row.mode]}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {row.driver !== '-' ? row.driver : ''}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-right font-medium tabular-nums">
                      {row.driverQty != null ? row.driverQty : ''}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.formula}</code>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-right font-medium tabular-nums">
                      {row.hours > 0 ? row.hours.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {row.required && <span className="text-[10px] text-muted-foreground">✓</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      No tasks match your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>{filtered.length} tasks shown</span>
            <span>•</span>
            <span>{filtered.filter(r => r.required).length} required</span>
            <span>•</span>
            <span>{filtered.filter(r => r.mode === 'variable').length} variable</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
