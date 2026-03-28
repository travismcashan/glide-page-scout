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

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
      task.is_selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 opacity-60'
    }`}>
      <Checkbox
        checked={task.is_selected}
        onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${!task.is_selected && 'text-muted-foreground'}`}>
          {task.task_name}
        </p>
        {!compact && roleList.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {roleList.map(role => (
              <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {role}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Variable qty input */}
      {task.variable_label && onVariableQtyChange && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={task.variable_qty ?? 1}
            onChange={(e) => onVariableQtyChange(task.id, parseInt(e.target.value) || 1)}
            className="w-14 text-center h-7 text-xs"
            min={1}
          />
          <span className="text-[10px] text-muted-foreground w-12 truncate">{task.variable_label}</span>
        </div>
      )}

      {/* Hours per person */}
      {onHoursPerPersonChange && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={task.hours_per_person ?? task.hours}
            onChange={(e) => onHoursPerPersonChange(task.id, parseFloat(e.target.value) || 0)}
            className="w-16 text-center h-7 text-xs"
            min={0}
            step={0.5}
          />
          <span className="text-[10px] text-muted-foreground w-8">h/p</span>
        </div>
      )}

      {/* Total hours (read-only when multi-role, editable otherwise) */}
      <div className="flex items-center gap-1">
        {roleCount > 1 || task.variable_label ? (
          <span className="text-sm font-medium w-16 text-center">{Number(task.hours).toFixed(1)}</span>
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
        <span className="text-[10px] text-muted-foreground w-6">hrs</span>
      </div>
    </div>
  );
}
