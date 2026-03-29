import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Percent, Layers, DollarSign, Search } from 'lucide-react';
import { getTaskCalcType, type TaskCalcType } from '@/lib/estimateFormulas';

/* ─────────────────────────────────────────────
   Static data extracted from the formula engine.
   Each entry mirrors one branch of calculateTaskFromXlsx.
   ───────────────────────────────────────────── */

export interface FormulaEntry {
  task: string;
  type: TaskCalcType;
  formula: string;          // human-readable formula text
  smallVal?: number;        // size bucket values
  medVal?: number;
  largeVal?: number;
  simpleVal?: number;       // complexity bucket values
  moderateVal?: number;
  complexVal?: number;
  multiplier?: number;      // variable × N
  variable?: string;        // which variable drives it
}

const FORMULA_CATALOG: FormulaEntry[] = [
  // — PM —
  { task: 'Timeline (setup + adjustments)', type: 'size', formula: 'bySize(S/M/L)', smallVal: 2.5, medVal: 3.5, largeVal: 4.5 },
  { task: 'KOC Prep + Recap', type: 'size', formula: 'bySize(S/M/L)', smallVal: 2, medVal: 2.5, largeVal: 3 },
  { task: 'Admin Hours', type: 'percentage', formula: 'total × 6%', multiplier: 0.06, variable: 'total hours' },

  // — Strategy: Size —
  { task: 'Current Site Review', type: 'size', formula: 'bySize(S/M/L)', smallVal: 0.5, medVal: 1, largeVal: 1.5 },
  { task: 'Content Inventory', type: 'size', formula: 'bySize(S/M/L)', smallVal: 1, medVal: 1.5, largeVal: 2 },
  { task: 'Content Audit', type: 'size', formula: 'bySize(S/M/L)', smallVal: 1, medVal: 2, largeVal: 3 },
  { task: 'Competitor Review', type: 'size', formula: 'bySize(S/M/L)', smallVal: 2, medVal: 2, largeVal: 3 },
  { task: 'SEO Insights', type: 'size', formula: 'bySize(S/M/L)', smallVal: 1, medVal: 1.5, largeVal: 2 },
  { task: 'Hotjar Review', type: 'size', formula: 'bySize(S/M/L)', smallVal: 1, medVal: 1.5, largeVal: 2 },
  { task: 'Keyword Research', type: 'size', formula: 'bySize(S/M/L)', smallVal: 2, medVal: 2.5, largeVal: 3 },
  { task: 'Information Architecture', type: 'size', formula: 'bySize(S/M/L)', smallVal: 4, medVal: 6, largeVal: 8 },

  // — Strategy: Conditional —
  { task: 'Strategy Workshop (KOC)', type: 'conditional', formula: 'scope_only → 1.5h, paid → 0.5h' },
  { task: 'Strategy Review', type: 'conditional', formula: 'scope_only → 1h, paid → 0.5h' },

  // — Strategy: Variable (personas) —
  { task: 'User Personas', type: 'scope', formula: 'personas × 1', multiplier: 1, variable: 'personas' },
  { task: 'User Journey Map', type: 'scope', formula: 'personas × 1.5', multiplier: 1.5, variable: 'personas' },
  { task: 'Empathy Map', type: 'scope', formula: 'personas × 2.5', multiplier: 2.5, variable: 'personas' },
  { task: 'Scenario Map', type: 'scope', formula: 'personas × 3', multiplier: 3, variable: 'personas' },

  // — Strategy: Variable (qty) —
  { task: 'Design Thinking Workshop', type: 'variable', formula: 'qty × 1', multiplier: 1, variable: 'qty' },
  { task: 'Brainstorming Sessions', type: 'variable', formula: 'qty × 1', multiplier: 1, variable: 'qty' },
  { task: 'Interviews', type: 'variable', formula: 'qty × 2.5', multiplier: 2.5, variable: 'qty' },
  { task: 'Moderated User Testing', type: 'variable', formula: 'qty × 3', multiplier: 3, variable: 'qty' },
  { task: 'Focus Groups', type: 'variable', formula: 'qty × 6', multiplier: 6, variable: 'qty' },

  // — Strategy: Complexity —
  { task: 'Functional Requirements', type: 'complexity', formula: 'byComplexity(S/M/C)', simpleVal: 2, moderateVal: 3, complexVal: 4 },
  { task: 'Heuristic Evaluation', type: 'manual', formula: '0.5h × roles (fixed)' },

  // — Design: Size —
  { task: 'Client Design Review (weekly)', type: 'size', formula: 'bySize(S/M/L)', smallVal: 4, medVal: 5, largeVal: 6 },
  { task: 'Toolkit Outline', type: 'size', formula: 'bySize(S/M/L)', smallVal: 0.5, medVal: 1, largeVal: 1.5 },
  { task: 'Block Map + Functional Notes', type: 'size', formula: 'bySize(S/M/L)', smallVal: 1, medVal: 2, largeVal: 2.5 },
  { task: 'Content Collection', type: 'size', formula: 'bySize(S/M/L)', smallVal: 2, medVal: 4, largeVal: 6 },
  { task: 'Functional Notes', type: 'size', formula: 'bySize(S/M/L)', smallVal: 0.5, medVal: 1, largeVal: 1.5 },
  { task: 'UX Notes', type: 'size', formula: 'bySize(S/M/L)', smallVal: 0.5, medVal: 1, largeVal: 1.5 },

  // — Design: Scope (layouts) —
  { task: 'Storybrand > WFs + Copy Writing', type: 'scope', formula: 'layouts × 2.4', multiplier: 2.4, variable: 'layouts' },
  { task: 'Internal Page SFs', type: 'scope', formula: '(layouts − 2) × 1.5', multiplier: 1.5, variable: 'layouts − 2' },
  { task: 'Internal Page Layouts', type: 'scope', formula: '(layouts − 2) × 4.75', multiplier: 4.75, variable: 'layouts − 2' },
  { task: 'Responsive', type: 'scope', formula: 'layouts × 0.5', multiplier: 0.5, variable: 'layouts' },
  { task: 'Revisions', type: 'scope', formula: 'layouts × 1', multiplier: 1, variable: 'layouts' },

  // — Design: Complexity —
  { task: 'Technical Roadmap > Create', type: 'complexity', formula: 'byComplexity(S/M/C)', simpleVal: 1, moderateVal: 1.5, complexVal: 2 },

  // — Design Validation —
  { task: 'Design Validation > Moderated User Testing', type: 'variable', formula: 'qty × 1', multiplier: 1, variable: 'qty' },
  { task: 'Design Validation > Focus Groups', type: 'variable', formula: 'qty × 6', multiplier: 6, variable: 'qty' },

  // — Build: Scope —
  { task: 'CSS, HTML, Javascript', type: 'scope', formula: 'layouts × 7', multiplier: 7, variable: 'layouts' },
  { task: 'Wordpress Development', type: 'scope', formula: 'layouts × 4', multiplier: 4, variable: 'layouts' },
  { task: 'Quality Assurance', type: 'scope', formula: 'layouts × 2', multiplier: 2, variable: 'layouts' },

  // — Build: Complexity —
  { task: 'Standard Third Party Plugins + Integrations', type: 'complexity', formula: 'byComplexity(S/M/C)', simpleVal: 8, moderateVal: 10, complexVal: 12 },
  { task: 'Custom Third Party Integrations', type: 'complexity', formula: 'byComplexity(S/M/C)', simpleVal: 4, moderateVal: 6, complexVal: 10 },
  { task: 'Special Setup Integrations', type: 'complexity', formula: 'byComplexity(S/M/C)', simpleVal: 6, moderateVal: 10, complexVal: 16 },
  { task: 'Performance Optimization', type: 'size', formula: 'bySize(S/M/L)', smallVal: 6, medVal: 8, largeVal: 12 },

  // — Content —
  { task: 'Content Integration', type: 'scope', formula: 'pages × 0.8', multiplier: 0.8, variable: 'pages' },
  { task: 'Additional CPT Integration', type: 'scope', formula: 'custom_posts × 0.5', multiplier: 0.5, variable: 'custom_posts' },
  { task: 'Form Integration', type: 'scope', formula: 'S×0.25 + M×0.5 + L×1.5', variable: 'form tiers' },
  { task: 'Content + CMS Review', type: 'scope', formula: '(pages + CPTs) × 0.1', multiplier: 0.1, variable: 'pages + CPTs' },
  { task: 'URL Swap + Check', type: 'scope', formula: '(pages + CPTs) × 0.1', multiplier: 0.1, variable: 'pages + CPTs' },
  { task: 'Bulk Import', type: 'conditional', formula: 'ACF: <500→28h, 500-1k→38h, 1-5k→52h, >5k→72h' },
  { task: 'Bulk Import > Check + Clean', type: 'conditional', formula: '<500→4h, 500-1k→6h, 1-5k→10h, >5k→16h' },

  // — Review —
  { task: 'Design Review', type: 'scope', formula: 'pages × 0.05', multiplier: 0.05, variable: 'pages' },
  { task: 'UX Review', type: 'scope', formula: 'pages × 0.05', multiplier: 0.05, variable: 'pages' },
  { task: 'AMP Review', type: 'scope', formula: 'pages × 0.02', multiplier: 0.02, variable: 'pages' },
  { task: 'Functional Review', type: 'scope', formula: 'pages × 0.05', multiplier: 0.05, variable: 'pages' },

  // — Optimization —
  { task: '301 Redirect Setup', type: 'scope', formula: 'max(pages × 0.1, 2)', multiplier: 0.1, variable: 'pages' },
  { task: 'Technical On-Page SEO', type: 'size', formula: 'bySize(S/M/L)', smallVal: 4, medVal: 6, largeVal: 8 },
  { task: 'Alt Image/Title Integration', type: 'size', formula: 'bySize(S/M/L)', smallVal: 4, medVal: 6, largeVal: 8 },
  { task: 'Resolve Self Inflicted 301s', type: 'size', formula: 'bySize(S/M/L)', smallVal: 1, medVal: 1.5, largeVal: 2 },

  // — QA —
  { task: 'QA Forms', type: 'scope', formula: 'S×0.15 + M×0.25 + L×0.5', variable: 'form tiers' },
  { task: 'Proof Reading', type: 'scope', formula: 'pages × 0.05', multiplier: 0.05, variable: 'pages' },
  { task: 'DoneDone Management', type: 'scope', formula: 'bySize × 8', smallVal: 8, medVal: 24, largeVal: 36 },

  // — Post Launch —
  { task: 'Services Handoff Meeting', type: 'conditional', formula: 'post_launch_services > 0 → value, else 0' },
];

const TYPE_COLORS: Record<TaskCalcType, string> = {
  size: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  complexity: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  scope: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  variable: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  percentage: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  conditional: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  manual: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const TYPE_LABELS: Record<TaskCalcType, string> = {
  size: 'Size',
  complexity: 'Complexity',
  scope: 'Scope Var',
  variable: 'Qty Var',
  percentage: '% Based',
  conditional: 'Conditional',
  manual: 'Fixed',
};

interface Props {
  pmPercentage: number;
  qaPercentage: number;
  blendedRate: number;
  onPmPercentageChange: (val: number) => void;
  onQaPercentageChange: (val: number) => void;
  onBlendedRateChange: (val: number) => void;
}

export function EstimateFormulasTab({
  pmPercentage,
  qaPercentage,
  blendedRate,
  onPmPercentageChange,
  onQaPercentageChange,
  onBlendedRateChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TaskCalcType | 'all'>('all');

  const filtered = useMemo(() => {
    return FORMULA_CATALOG.filter(f => {
      if (typeFilter !== 'all' && f.type !== typeFilter) return false;
      if (search && !f.task.toLowerCase().includes(search.toLowerCase()) && !f.formula.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    FORMULA_CATALOG.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
    return counts;
  }, []);

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

      {/* Task Formula Catalog */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Task Formula Catalog
          </CardTitle>
          <CardDescription>Every formula used to calculate task hours — {FORMULA_CATALOG.length} formulas</CardDescription>
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
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={typeFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setTypeFilter('all')}
              >
                All ({FORMULA_CATALOG.length})
              </Badge>
              {(Object.keys(TYPE_LABELS) as TaskCalcType[]).map(type => (
                typeCounts[type] ? (
                  <Badge
                    key={type}
                    variant="outline"
                    className={`cursor-pointer text-xs ${typeFilter === type ? TYPE_COLORS[type] : ''}`}
                    onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                  >
                    {TYPE_LABELS[type]} ({typeCounts[type]})
                  </Badge>
                ) : null
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Task</TableHead>
                  <TableHead className="h-8 text-xs w-[80px]">Type</TableHead>
                  <TableHead className="h-8 text-xs">Formula</TableHead>
                  <TableHead className="h-8 text-xs text-center w-[60px]">S</TableHead>
                  <TableHead className="h-8 text-xs text-center w-[60px]">M</TableHead>
                  <TableHead className="h-8 text-xs text-center w-[60px]">L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f, i) => (
                  <TableRow key={i} className="group">
                    <TableCell className="text-sm py-1.5 font-medium">{f.task}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[f.type]}`}>
                        {TYPE_LABELS[f.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-1.5 font-mono">{f.formula}</TableCell>
                    <TableCell className="text-xs text-center py-1.5">
                      {f.smallVal != null ? f.smallVal : f.simpleVal != null ? f.simpleVal : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-center py-1.5">
                      {f.medVal != null ? f.medVal : f.moderateVal != null ? f.moderateVal : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-center py-1.5">
                      {f.largeVal != null ? f.largeVal : f.complexVal != null ? f.complexVal : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
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
