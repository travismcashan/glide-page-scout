import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

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
}

interface Props {
  task: EstimateTask;
  onToggle: (id: string, checked: boolean) => void;
  onHoursChange: (id: string, hours: number) => void;
}

export function EstimateTaskRow({ task, onToggle, onHoursChange }: Props) {
  return (
    <div className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
      task.is_selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
    }`}>
      <Checkbox
        checked={task.is_selected}
        onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${!task.is_selected && 'text-muted-foreground'}`}>
          {task.task_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {task.team_role_abbreviation} • {task.phase_name}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={task.hours}
          onChange={(e) => onHoursChange(task.id, parseFloat(e.target.value) || 0)}
          className="w-20 text-center h-8 text-sm"
          min={0}
          step={0.5}
        />
        <span className="text-xs text-muted-foreground w-6">hrs</span>
      </div>
    </div>
  );
}
