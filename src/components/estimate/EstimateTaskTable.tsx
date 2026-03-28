import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { isFormulaTask, getTaskCalcType, type TaskCalcType } from '@/lib/estimateFormulas';
import type { EstimateTask } from './EstimateTaskRow';

type SortField = 'task_name' | 'phase_name' | 'hours_per_person' | 'hours' | 'display_order';
type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'phase' | 'role';

interface Props {
  tasks: EstimateTask[];
  onToggle: (id: string, checked: boolean) => void;
  onHoursChange: (id: string, hours: number) => void;
  onHoursPerPersonChange: (id: string, hpp: number) => void;
  onVariableQtyChange: (id: string, qty: number) => void;
}

export function EstimateTaskTable({ tasks, onToggle, onHoursChange, onHoursPerPersonChange, onVariableQtyChange }: Props) {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('phase');
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [includedOpen, setIncludedOpen] = useState(true);
  const [excludedOpen, setExcludedOpen] = useState(true);

  const phases = useMemo(() => [...new Set(tasks.map(t => t.phase_name || 'Other'))], [tasks]);
  const roles = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      (t.roles || t.team_role_abbreviation || 'Other').split(',').map(r => r.trim()).filter(Boolean).forEach(r => set.add(r));
    });
    return [...set];
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.task_name.toLowerCase().includes(q) ||
        (t.phase_name || '').toLowerCase().includes(q) ||
        (t.roles || '').toLowerCase().includes(q)
      );
    }
    if (filterPhase !== 'all') {
      result = result.filter(t => (t.phase_name || 'Other') === filterPhase);
    }
    if (filterStatus === 'selected') result = result.filter(t => t.is_selected);
    if (filterStatus === 'excluded') result = result.filter(t => !t.is_selected);
    return result;
  }, [tasks, search, filterPhase, filterStatus]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'task_name': cmp = a.task_name.localeCompare(b.task_name); break;
        case 'phase_name': cmp = (a.phase_name || '').localeCompare(b.phase_name || ''); break;
        case 'hours_per_person': cmp = Number(a.hours_per_person ?? a.hours) - Number(b.hours_per_person ?? b.hours); break;
        case 'hours': cmp = Number(a.hours) - Number(b.hours); break;
        default: cmp = a.display_order - b.display_order;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': sorted };
    const groups: Record<string, EstimateTask[]> = {};
    sorted.forEach(t => {
      if (groupBy === 'phase') {
        const key = t.phase_name || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      } else {
        const roleList = (t.roles || t.team_role_abbreviation || 'Other').split(',').map(r => r.trim()).filter(Boolean);
        roleList.forEach(role => {
          if (!groups[role]) groups[role] = [];
          if (!groups[role].find(x => x.id === t.id)) groups[role].push(t);
        });
      }
    });
    return groups;
  }, [sorted, groupBy]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Group by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Grouping</SelectItem>
            <SelectItem value="phase">Group by Phase</SelectItem>
            <SelectItem value="role">Group by Role</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {phases.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="selected">Included</SelectItem>
            <SelectItem value="excluded">Excluded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50 h-8">
              <TableHead className="w-10" />
              {groupBy !== 'phase' && (
                <TableHead className="cursor-pointer select-none w-[120px] whitespace-nowrap" onClick={() => toggleSort('phase_name')}>
                  <span className="flex items-center text-sm">Phase<SortIcon field="phase_name" /></span>
                </TableHead>
              )}
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('task_name')}>
                <span className="flex items-center text-sm">Task<SortIcon field="task_name" /></span>
              </TableHead>
              <TableHead className="w-[160px] text-sm">Role(s)</TableHead>
              <TableHead className="w-[50px] text-sm text-center">Req</TableHead>
              <TableHead className="w-[70px] text-sm text-center">Type</TableHead>
              <TableHead className="w-[80px] text-sm text-center">Variable</TableHead>
              <TableHead className="w-[60px] text-sm text-center">#</TableHead>
              <TableHead className="w-[90px] cursor-pointer select-none text-center" onClick={() => toggleSort('hours_per_person')}>
                <span className="flex items-center justify-center text-sm">Hrs/Person<SortIcon field="hours_per_person" /></span>
              </TableHead>
              <TableHead className="w-[90px] cursor-pointer select-none text-center" onClick={() => toggleSort('hours')}>
                <span className="flex items-center justify-center text-sm">Total<SortIcon field="hours" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Included in Scope section */}
            <ScopeSection
              label="Included in Scope"
              tasks={sorted.filter(t => t.is_selected)}
              isOpen={includedOpen}
              onToggleOpen={() => setIncludedOpen(o => !o)}
              colSpan={groupBy !== 'phase' ? 10 : 9}
              groupBy={groupBy}
              showPhaseCol={groupBy !== 'phase'}
              onToggle={onToggle}
              onHoursChange={onHoursChange}
              onHoursPerPersonChange={onHoursPerPersonChange}
              onVariableQtyChange={onVariableQtyChange}
              variant="included"
            />
            {/* Not Included in Scope section */}
            <ScopeSection
              label="Not Included in Scope"
              tasks={sorted.filter(t => !t.is_selected)}
              isOpen={excludedOpen}
              onToggleOpen={() => setExcludedOpen(o => !o)}
              colSpan={groupBy !== 'phase' ? 10 : 9}
              groupBy={groupBy}
              showPhaseCol={groupBy !== 'phase'}
              onToggle={onToggle}
              onHoursChange={onHoursChange}
              onHoursPerPersonChange={onHoursPerPersonChange}
              onVariableQtyChange={onVariableQtyChange}
              variant="excluded"
            />
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground px-1">
        {filtered.length} of {tasks.length} tasks · {filtered.filter(t => t.is_selected).reduce((s, t) => s + Number(t.hours), 0).toFixed(1)}h selected
      </div>
    </div>
  );
}

const CALC_TYPE_CONFIG: Record<TaskCalcType, { label: string; className: string }> = {
  size: { label: 'Size', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' },
  complexity: { label: 'Cmplx', className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  variable: { label: 'Var', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  scope: { label: 'Scope', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800' },
  percentage: { label: '%', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
  conditional: { label: 'Cond', className: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800' },
  manual: { label: 'Manual', className: 'bg-muted text-muted-foreground border-border' },
};

function CalcTypeBadge({ type }: { type: TaskCalcType }) {
  const config = CALC_TYPE_CONFIG[type];
  return (
    <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 font-normal ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function ScopeSection({
  label, tasks, isOpen, onToggleOpen, colSpan, groupBy, showPhaseCol,
  onToggle, onHoursChange, onHoursPerPersonChange, onVariableQtyChange, variant,
}: {
  label: string;
  tasks: EstimateTask[];
  isOpen: boolean;
  onToggleOpen: () => void;
  colSpan: number;
  groupBy: GroupBy;
  showPhaseCol: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onHoursChange: (id: string, hours: number) => void;
  onHoursPerPersonChange: (id: string, hpp: number) => void;
  onVariableQtyChange: (id: string, qty: number) => void;
  variant: 'included' | 'excluded';
}) {
  const totalHours = tasks.reduce((s, t) => s + Number(t.hours), 0);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': tasks };
    const groups: Record<string, EstimateTask[]> = {};
    tasks.forEach(t => {
      if (groupBy === 'phase') {
        const key = t.phase_name || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      } else {
        const roleList = (t.roles || t.team_role_abbreviation || 'Other').split(',').map(r => r.trim()).filter(Boolean);
        roleList.forEach(role => {
          if (!groups[role]) groups[role] = [];
          if (!groups[role].find(x => x.id === t.id)) groups[role].push(t);
        });
      }
    });
    return groups;
  }, [tasks, groupBy]);

  return (
    <>
      <TableRow
        className={`cursor-pointer select-none h-8 ${variant === 'included' ? 'bg-accent/10 hover:bg-accent/15' : 'bg-destructive/10 hover:bg-destructive/15'}`}
        onClick={onToggleOpen}
      >
        <TableCell colSpan={colSpan} className="py-0">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {label}
            <Badge variant="secondary" className="text-xs">{tasks.length} tasks</Badge>
            <Badge variant="outline" className="text-xs">{totalHours.toFixed(1)}h</Badge>
          </span>
        </TableCell>
      </TableRow>
      {isOpen && Object.entries(grouped).map(([group, groupTasks]) => {
        const groupHours = groupTasks.reduce((s, t) => s + Number(t.hours), 0);
        return (
          <GroupRows
            key={group}
            group={group}
            tasks={groupTasks}
            groupHours={groupHours}
            showGroup={groupBy !== 'none'}
            showPhaseCol={showPhaseCol}
            onToggle={onToggle}
            onHoursChange={onHoursChange}
            onHoursPerPersonChange={onHoursPerPersonChange}
            onVariableQtyChange={onVariableQtyChange}
          />
        );
      })}
    </>
  );
}

function GroupRows({
  group, tasks, groupHours, showGroup, showPhaseCol,
  onToggle, onHoursChange, onHoursPerPersonChange, onVariableQtyChange,
}: {
  group: string;
  tasks: EstimateTask[];
  groupHours: number;
  showGroup: boolean;
  showPhaseCol: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onHoursChange: (id: string, hours: number) => void;
  onHoursPerPersonChange: (id: string, hpp: number) => void;
  onVariableQtyChange: (id: string, qty: number) => void;
}) {
  const colSpan = showPhaseCol ? 10 : 9;

  return (
    <>
      {showGroup && (
        <TableRow className="bg-muted/30 hover:bg-muted/40 h-8">
          <TableCell colSpan={colSpan} className="py-0">
            <span className="text-sm font-semibold flex items-center gap-2">
              {group}
              <Badge variant="secondary" className="text-xs">{groupHours.toFixed(1)}h</Badge>
              <Badge variant="outline" className="text-xs">{tasks.filter(t => t.is_selected).length}/{tasks.length}</Badge>
            </span>
          </TableCell>
        </TableRow>
      )}
      {tasks.map(task => (
        <TaskTableRow
          key={task.id}
          task={task}
          showPhaseCol={showPhaseCol}
          onToggle={onToggle}
          onHoursChange={onHoursChange}
          onHoursPerPersonChange={onHoursPerPersonChange}
          onVariableQtyChange={onVariableQtyChange}
        />
      ))}
    </>
  );
}

function TaskTableRow({
  task, showPhaseCol, onToggle, onHoursChange, onHoursPerPersonChange, onVariableQtyChange,
}: {
  task: EstimateTask;
  showPhaseCol: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onHoursChange: (id: string, hours: number) => void;
  onHoursPerPersonChange: (id: string, hpp: number) => void;
  onVariableQtyChange: (id: string, qty: number) => void;
}) {
  const formulaDriven = isFormulaTask(task.task_name);
  const roleList = (task.roles || '').split(',').map(r => r.trim()).filter(Boolean);
  const roleCount = roleList.length || 1;
  const hasVariable = !!task.variable_label && task.variable_label !== '-';

  return (
    <TableRow className={`h-8 ${formulaDriven ? 'bg-muted/20 opacity-60' : ''}`}>
      {/* Checkbox */}
      <TableCell className="py-0 w-10">
        <Checkbox
          checked={task.is_selected}
          onCheckedChange={task.is_required ? undefined : (checked) => onToggle(task.id, checked as boolean)}
          disabled={task.is_required}
          className={formulaDriven || task.is_required ? 'border-muted-foreground/60 data-[state=checked]:bg-muted-foreground/70 data-[state=checked]:border-muted-foreground/70' : ''}
        />
      </TableCell>

      {/* Phase — first data column */}
      {showPhaseCol && (
        <TableCell className="py-0 text-sm whitespace-nowrap">
          {(task.phase_name === 'Project Management' ? 'PM' : task.phase_name) || '-'}
        </TableCell>
      )}

      {/* Task name */}
      <TableCell className="py-0 text-sm truncate whitespace-nowrap">
        {task.task_name}
      </TableCell>

      {/* Roles */}
      <TableCell className="py-0">
        <div className="flex flex-nowrap gap-0.5">
          {roleList.map(role => (
            <Badge key={role} variant="outline" className="text-xs px-1.5 py-0 h-5 font-normal whitespace-nowrap">{role}</Badge>
          ))}
        </div>
      </TableCell>

      {/* Required */}
      <TableCell className="py-0 text-center">
        {task.is_required && <Check className="h-3.5 w-3.5 text-muted-foreground mx-auto" />}
      </TableCell>

      {/* Type */}
      <TableCell className="py-0 text-center">
        <CalcTypeBadge type={getTaskCalcType(task.task_name)} />
      </TableCell>

      {/* Variable label */}
      <TableCell className="py-0 text-center whitespace-nowrap">
        {hasVariable ? (
          <span className="text-sm">{task.variable_label}</span>
        ) : (
          <span className="text-sm">-</span>
        )}
      </TableCell>

      {/* Variable qty */}
      <TableCell className="py-0 text-center">
        {hasVariable && !formulaDriven ? (
          <Input
            type="number"
            value={task.variable_qty ?? 1}
            onChange={e => onVariableQtyChange(task.id, parseInt(e.target.value) || 1)}
            className="w-12 text-center h-6 text-sm mx-auto"
            min={1}
          />
        ) : hasVariable ? (
          <span className="text-sm">{task.variable_qty ?? '-'}</span>
        ) : (
          <span className="text-sm">-</span>
        )}
      </TableCell>

      {/* Hrs/Person */}
      <TableCell className="py-0 text-center">
        {!formulaDriven ? (
          <Input
            type="number"
            value={task.hours_per_person ?? task.hours}
            onChange={e => onHoursPerPersonChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-6 text-sm mx-auto"
            min={0}
            step={0.5}
          />
        ) : (
          <span className="text-sm">{Number(task.hours_per_person ?? task.hours).toFixed(1)}</span>
        )}
      </TableCell>

      {/* Total */}
      <TableCell className="py-0 text-center">
        {(roleCount > 1 || hasVariable || formulaDriven) ? (
          <span className="text-sm">{Number(task.hours).toFixed(1)}</span>
        ) : (
          <Input
            type="number"
            value={task.hours}
            onChange={e => onHoursChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-6 text-sm mx-auto"
            min={0}
            step={0.5}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
