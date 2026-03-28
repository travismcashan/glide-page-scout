import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { isFormulaTask } from '@/lib/estimateFormulas';
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
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

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
            <TableRow className="bg-muted/50">
              <TableHead className="w-10" />
              {groupBy !== 'phase' && (
                <TableHead className="cursor-pointer select-none w-[180px] whitespace-nowrap" onClick={() => toggleSort('phase_name')}>
                  <span className="flex items-center text-xs">Phase<SortIcon field="phase_name" /></span>
                </TableHead>
              )}
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('task_name')}>
                <span className="flex items-center text-xs">Task<SortIcon field="task_name" /></span>
              </TableHead>
              <TableHead className="w-[100px] text-xs">Role(s)</TableHead>
              <TableHead className="w-[80px] text-xs text-center">Variable</TableHead>
              <TableHead className="w-[60px] text-xs text-center">#</TableHead>
              <TableHead className="w-[90px] cursor-pointer select-none text-right" onClick={() => toggleSort('hours_per_person')}>
                <span className="flex items-center justify-end text-xs">Hrs/Person<SortIcon field="hours_per_person" /></span>
              </TableHead>
              <TableHead className="w-[90px] cursor-pointer select-none text-right" onClick={() => toggleSort('hours')}>
                <span className="flex items-center justify-end text-xs">Total<SortIcon field="hours" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(grouped).map(([group, groupTasks]) => {
              const groupHours = groupTasks.filter(t => t.is_selected).reduce((s, t) => s + Number(t.hours), 0);
              return (
                <GroupRows
                  key={group}
                  group={group}
                  tasks={groupTasks}
                  groupHours={groupHours}
                  showGroup={groupBy !== 'none'}
                  showPhaseCol={groupBy !== 'phase'}
                  onToggle={onToggle}
                  onHoursChange={onHoursChange}
                  onHoursPerPersonChange={onHoursPerPersonChange}
                  onVariableQtyChange={onVariableQtyChange}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground px-1">
        {filtered.length} of {tasks.length} tasks · {filtered.filter(t => t.is_selected).reduce((s, t) => s + Number(t.hours), 0).toFixed(1)}h selected
      </div>
    </div>
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
  const colSpan = showPhaseCol ? 8 : 7;

  return (
    <>
      {showGroup && (
        <TableRow className="bg-muted/30 hover:bg-muted/40">
          <TableCell colSpan={colSpan} className="py-1.5">
            <span className="text-xs font-semibold flex items-center gap-2">
              {group}
              <Badge variant="secondary" className="text-[10px]">{groupHours.toFixed(1)}h</Badge>
              <Badge variant="outline" className="text-[10px]">{tasks.filter(t => t.is_selected).length}/{tasks.length}</Badge>
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
    <TableRow className={
      !task.is_selected ? 'opacity-50' : formulaDriven ? 'bg-muted/20' : ''
    }>
      {/* Checkbox */}
      <TableCell className="py-1.5 w-10">
        <Checkbox
          checked={task.is_selected}
          onCheckedChange={formulaDriven ? undefined : (checked) => onToggle(task.id, checked as boolean)}
          disabled={formulaDriven}
          className={formulaDriven ? 'cursor-not-allowed border-muted-foreground/40 data-[state=checked]:bg-muted-foreground/40 data-[state=checked]:border-muted-foreground/40' : ''}
        />
      </TableCell>

      {/* Task name */}
      <TableCell className={`py-1.5 text-sm truncate ${formulaDriven ? 'text-muted-foreground' : ''}`}>
        {task.task_name}
      </TableCell>

      {/* Phase */}
      {showPhaseCol && (
        <TableCell className="py-1.5 text-xs text-muted-foreground">{task.phase_name || '-'}</TableCell>
      )}

      {/* Roles */}
      <TableCell className="py-1.5">
        <div className="flex flex-wrap gap-0.5">
          {roleList.map(role => (
            <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{role}</Badge>
          ))}
        </div>
      </TableCell>

      {/* Variable label */}
      <TableCell className="py-1.5 text-center">
        {hasVariable ? (
          <span className={`text-xs font-medium ${formulaDriven ? 'text-muted-foreground' : ''}`}>{task.variable_label}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>

      {/* Variable qty */}
      <TableCell className="py-1.5 text-center">
        {hasVariable && !formulaDriven ? (
          <Input
            type="number"
            value={task.variable_qty ?? 1}
            onChange={e => onVariableQtyChange(task.id, parseInt(e.target.value) || 1)}
            className="w-12 text-center h-7 text-xs mx-auto"
            min={1}
          />
        ) : hasVariable ? (
          <span className="text-xs text-muted-foreground">{task.variable_qty ?? '-'}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>

      {/* Hrs/Person */}
      <TableCell className="py-1.5 text-right">
        {!formulaDriven ? (
          <Input
            type="number"
            value={task.hours_per_person ?? task.hours}
            onChange={e => onHoursPerPersonChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-7 text-xs ml-auto"
            min={0}
            step={0.5}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{Number(task.hours_per_person ?? task.hours).toFixed(1)}</span>
        )}
      </TableCell>

      {/* Total */}
      <TableCell className="py-1.5 text-right">
        {(roleCount > 1 || hasVariable || formulaDriven) ? (
          <span className={`text-sm font-medium ${formulaDriven ? 'text-muted-foreground' : ''}`}>{Number(task.hours).toFixed(1)}</span>
        ) : (
          <Input
            type="number"
            value={task.hours}
            onChange={e => onHoursChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-7 text-xs ml-auto"
            min={0}
            step={0.5}
          />
        )}
      </TableCell>
    </TableRow>
  );
}
