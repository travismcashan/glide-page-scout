import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { PROJECT_STATUS_COLORS } from '@/config/badge-styles';

interface HarvestProject {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_billable: boolean;
  budget: number | null;
  budget_by: string | null;
  hourly_rate: number | null;
  fee: number | null;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
}

interface AsanaMapping {
  asana_project_gid: string;
  harvest_project_id: number | null;
  harvest_project_name: string | null;
}

interface AsanaProject {
  asana_project_gid: string;
  name: string;
  status_color: string | null;
  status_text: string | null;
  num_completed_tasks: number | null;
  num_incomplete_tasks: number | null;
}

interface CompanyProjectsSectionProps {
  projects: HarvestProject[];
  asanaMappings?: AsanaMapping[];
  asanaProjects?: AsanaProject[];
  loading?: boolean;
}

export function CompanyProjectsSection({
  projects,
  asanaMappings = [],
  asanaProjects = [],
  loading,
}: CompanyProjectsSectionProps) {
  if (loading) return null;
  if (projects.length === 0) return null;

  // Build a harvest_project_id -> asana project lookup
  const asanaByHarvestId = new Map<string, AsanaProject>();
  for (const mapping of asanaMappings) {
    if (!mapping.harvest_project_id) continue;
    const asana = asanaProjects.find(
      (a) => a.asana_project_gid === mapping.asana_project_gid
    );
    if (asana) asanaByHarvestId.set(String(mapping.harvest_project_id), asana);
  }

  const active = projects.filter((p) => p.is_active);
  const archived = projects.filter((p) => !p.is_active);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Projects</p>
          <p className="text-2xl font-bold">{projects.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold">{active.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Archived</p>
          <p className="text-2xl font-bold">{archived.length}</p>
        </div>
      </div>

      {/* Project list */}
      {projects.map((p) => {
        const linked = asanaByHarvestId.get(p.id);
        return (
          <div
            key={p.id}
            className="flex items-start gap-4 p-4 rounded-lg border border-border/50 bg-card"
          >
            <FolderOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{p.name}</span>
                {p.code && (
                  <span className="text-sm text-muted-foreground">{p.code}</span>
                )}
                <Badge
                  variant="outline"
                  className={
                    PROJECT_STATUS_COLORS[p.is_active ? 'active' : 'archived']
                  }
                >
                  {p.is_active ? 'Active' : 'Archived'}
                </Badge>
                {p.is_billable && (
                  <Badge variant="secondary" className="text-xs">
                    Billable
                  </Badge>
                )}
                {linked && (
                  <Badge variant="outline" className="text-xs gap-1 text-blue-400 border-blue-400/30">
                    <Link2 className="h-3 w-3" /> Asana
                    {linked.status_text && ` · ${linked.status_text}`}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {p.budget != null && (
                  <span>
                    Budget: {p.budget.toLocaleString()}{' '}
                    {p.budget_by === 'project' ? 'hrs' : ''}
                  </span>
                )}
                {p.hourly_rate != null && <span>Rate: ${p.hourly_rate}/hr</span>}
                {p.fee != null && <span>Fee: ${p.fee.toLocaleString()}</span>}
                {p.starts_on && (
                  <span>Start: {format(new Date(p.starts_on), 'MMM d, yyyy')}</span>
                )}
                {p.ends_on && (
                  <span>End: {format(new Date(p.ends_on), 'MMM d, yyyy')}</span>
                )}
              </div>
              {linked &&
                (linked.num_completed_tasks != null ||
                  linked.num_incomplete_tasks != null) && (
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    {linked.num_completed_tasks != null && (
                      <span className="text-green-400">
                        {linked.num_completed_tasks} completed
                      </span>
                    )}
                    {linked.num_incomplete_tasks != null && (
                      <span>
                        {linked.num_incomplete_tasks} remaining
                      </span>
                    )}
                  </div>
                )}
              {p.notes && (
                <p className="text-sm text-muted-foreground/60 mt-1 line-clamp-2">
                  {p.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
