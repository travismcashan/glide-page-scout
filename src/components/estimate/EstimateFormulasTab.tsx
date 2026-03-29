import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Percent, Layers, DollarSign, Search } from 'lucide-react';
import { type FormulaConfig, type TaskCalcType, describeFormula } from '@/lib/estimateFormulas';

interface TaskWithFormula {
  task_name: string;
  phase_name: string | null;
  formula_config?: FormulaConfig | null;
}

const CALC_TYPE_LABELS: Record<string, string> = {
  size: 'Size',
  size_multiplied: 'Size × N',
  complexity: 'Complexity',
  scope: 'Scope Var',
  variable: 'Qty Var',
  percentage: '% Based',
  conditional: 'Conditional',
  form_tiers: 'Form Tiers',
  bulk_import: 'Bulk Import',
  bulk_import_check: 'Bulk Check',
  manual: 'Fixed',
};

const CALC_TYPE_COLORS: Record<string, string> = {
  size: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  size_multiplied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  complexity: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  scope: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  variable: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  percentage: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  conditional: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  form_tiers: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  bulk_import: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  bulk_import_check: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  manual: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

function getBucketValues(fc: FormulaConfig): string {
  if (!fc) return '';
  if (fc.calc_type === 'size' || fc.calc_type === 'size_multiplied') {
    return `S: ${fc.small} | M: ${fc.medium} | L: ${fc.large}`;
  }
  if (fc.calc_type === 'complexity') {
    return `Simple: ${fc.simple} | Mod: ${fc.moderate} | Complex: ${fc.complex}`;
  }
  return '';
}

interface Props {
  pmPercentage: number;
  qaPercentage: number;
  blendedRate: number;
  onPmPercentageChange: (val: number) => void;
  onQaPercentageChange: (val: number) => void;
  onBlendedRateChange: (val: number) => void;
  tasks: TaskWithFormula[];
}

export function EstimateFormulasTab({
  pmPercentage,
  qaPercentage,
  blendedRate,
  onPmPercentageChange,
  onQaPercentageChange,
  onBlendedRateChange,
  tasks,
}: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const formulaTasks = useMemo(() => {
    return tasks
      .filter(t => t.formula_config?.calc_type)
      .map(t => ({
        task: t.task_name,
        phase: t.phase_name || 'Other',
        type: t.formula_config!.calc_type,
        config: t.formula_config!,
        formula: describeFormula(t.formula_config),
      }));
  }, [tasks]);

  const filtered = useMemo(() => {
    return formulaTasks.filter(f => {
      if (typeFilter !== 'all' && f.type !== typeFilter) return false;
      if (search && !f.task.toLowerCase().includes(search.toLowerCase()) && !f.formula.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [formulaTasks, search, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    formulaTasks.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    return counts;
  }, [formulaTasks]);

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> PM Phase %
            </CardTitle>
            <CardDescription className="text-xs">Percentage of core subtotal allocated to Project Management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={pmPercentage}
                onChange={(e) => onPmPercentageChange(Number(e.target.value))}
                className="w-20 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5" /> QA Phase %
            </CardTitle>
            <CardDescription className="text-xs">Percentage of core subtotal allocated to QA tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={qaPercentage}
                onChange={(e) => onQaPercentageChange(Number(e.target.value))}
                className="w-20 text-right"
              />
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
              <Input
                type="number"
                min={50}
                max={500}
                step={5}
                value={blendedRate}
                onChange={(e) => onBlendedRateChange(Number(e.target.value))}
                className="w-24 text-right"
              />
              <span className="text-sm text-muted-foreground">/hr</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Size / Complexity Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Size Buckets
            </CardTitle>
            <CardDescription className="text-xs">How project size is derived from variables</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 text-xs">Size</TableHead>
                  <TableHead className="h-7 text-xs">Condition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm py-1.5"><Badge variant="outline" className="text-xs">Small</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1.5">layouts + pages + CPTs ≤ 30</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm py-1.5"><Badge variant="outline" className="text-xs">Medium</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1.5">layouts + pages + CPTs ≤ 100</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm py-1.5"><Badge variant="outline" className="text-xs">Large</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1.5">layouts + pages + CPTs &gt; 100</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Complexity Buckets
            </CardTitle>
            <CardDescription className="text-xs">Derived from TPA weighted score (Plugins×1, 3rd-Party×2, Special×4)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 text-xs">Complexity</TableHead>
                  <TableHead className="h-7 text-xs">Score Range</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm py-1.5"><Badge variant="outline" className="text-xs">Simple</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1.5">score ≤ 8</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm py-1.5"><Badge variant="outline" className="text-xs">Moderate</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1.5">score ≤ 20</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm py-1.5"><Badge variant="outline" className="text-xs">Complex</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground py-1.5">score &gt; 20</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Task Formula Catalog — now driven by live data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Task Formula Catalog
          </CardTitle>
          <CardDescription>Live formula definitions from the database — {formulaTasks.length} formula-driven tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tasks or formulas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setTypeFilter('all')}
              >
                All ({formulaTasks.length})
              </Badge>
              {Object.entries(typeCounts).map(([type, count]) => (
                <Badge
                  key={type}
                  variant={typeFilter === type ? 'default' : 'outline'}
                  className={`cursor-pointer text-xs ${typeFilter !== type ? CALC_TYPE_COLORS[type] || '' : ''}`}
                  onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                >
                  {CALC_TYPE_LABELS[type] || type} ({count})
                </Badge>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs w-[250px]">Task</TableHead>
                  <TableHead className="h-8 text-xs w-[90px]">Type</TableHead>
                  <TableHead className="h-8 text-xs">Formula</TableHead>
                  <TableHead className="h-8 text-xs w-[200px]">Bucket Values</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/30">
                    <TableCell className="py-1.5">
                      <div>
                        <span className="text-sm font-medium">{entry.task}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{entry.phase}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="secondary" className={`text-[10px] ${CALC_TYPE_COLORS[entry.type] || ''}`}>
                        {CALC_TYPE_LABELS[entry.type] || entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{entry.formula}</code>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {getBucketValues(entry.config)}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      No formulas match your search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
