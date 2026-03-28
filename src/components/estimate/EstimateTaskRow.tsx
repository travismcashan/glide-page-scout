import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface EstimateTask {
  id: string;
  task_name: string;
  phase_name: string | null;
  team_role_name: string | null;
  team_role_abbreviation: string | null;
  hours: number;
  hourly_rate: number;
  is_selected: boolean;
  display_order: number;
  base_hours?: number | null;
  roles?: string | null;
  hours_per_person?: number | null;
  variable_label?: string | null;
  variable_qty?: number | null;
}

interface Props {
  task: EstimateTask;
  onToggle: (id: string, checked: boolean) => void;
  onHoursChange: (id: string, hours: number) => void;
  onHoursPerPersonChange?: (id: string, hpp: number) => void;
  onVariableQtyChange?: (id: string, qty: number) => void;
  compact?: boolean;
}

function getRoleList(roles: string | null | undefined): string[] {
  if (!roles) return [];
  return roles.split(',').map(r => r.trim()).filter(Boolean);
}

export function EstimateTaskRow({ task, onToggle, onHoursChange, onHoursPerPersonChange, onVariableQtyChange, compact }: Props) {
  const roleList = getRoleList(task.roles);
  const roleCount = roleList.length || 1;
  const hasVariable = !!task.variable_label && task.variable_label !== '-';

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
      task.is_selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 opacity-60'
    }`}>
      <Checkbox
        checked={task.is_selected}
        onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
      />

      {/* Task name */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight truncate ${!task.is_selected && 'text-muted-foreground'}`}>
          {task.task_name}
        </p>
      </div>

      {/* Roles */}
      <div className="w-24 shrink-0 flex flex-wrap gap-0.5 justify-end">
        {!compact && roleList.map(role => (
          <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {role}
          </Badge>
        ))}
      </div>

      {/* Variable column */}
      <div className="w-16 text-center shrink-0">
        {hasVariable ? (
          <span className="text-xs font-medium text-foreground">{task.variable_label}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>

      {/* # column */}
      <div className="w-12 shrink-0">
        {hasVariable && onVariableQtyChange ? (
          <Input
            type="number"
            value={task.variable_qty ?? 1}
            onChange={(e) => onVariableQtyChange(task.id, parseInt(e.target.value) || 1)}
            className="w-12 text-center h-7 text-xs"
            min={1}
          />
        ) : hasVariable ? (
          <span className="text-xs font-medium block text-center">{task.variable_qty ?? '-'}</span>
        ) : (
          <span className="text-xs text-muted-foreground block text-center">-</span>
        )}
      </div>

      {/* Hours per person */}
      <div className="w-[5.5rem] shrink-0 flex items-center justify-center">
        {onHoursPerPersonChange ? (
          <Input
            type="number"
            value={task.hours_per_person ?? task.hours}
            onChange={(e) => onHoursPerPersonChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-7 text-xs"
            min={0}
            step={0.5}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{Number(task.hours_per_person ?? task.hours).toFixed(1)}</span>
        )}
      </div>

      {/* Total hours */}
      <div className="w-[5.5rem] shrink-0 flex items-center justify-center">
        {roleCount > 1 || hasVariable ? (
          <span className="text-sm font-medium">{Number(task.hours).toFixed(1)}</span>
        ) : (
          <Input
            type="number"
            value={task.hours}
            onChange={(e) => onHoursChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-7 text-xs"
            min={0}
            step={0.5}
          />
        )}
      </div>
    </div>
  );
}
