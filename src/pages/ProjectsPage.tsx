import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompanies } from '@/hooks/useCompanies';
import { useProjects, type LocalAsanaProject, type LocalProjectMapping, type LocalProjectBudget } from '@/hooks/useProjects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandLoader } from '@/components/BrandLoader';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronRight,
  Circle,
  RefreshCw,
  AlertTriangle,
  Building2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────

// Merged: Asana project + Harvest budget, grouped by client
interface UnifiedProject {
  id: string;
  asanaName: string;
  clientName: string;
  serviceType: string;
  statusColor: string;
  owner: string | null;
  numCompletedTasks?: number;
  numTasks?: number;
  budget?: number | null;
  budgetSpent?: number | null;
  budgetBy?: string;
  portfolioName?: string;
  harvestClientId?: number;
}

// Client group: all projects for one client
interface ClientGroup {
  clientName: string;
  projects: UnifiedProject[];
  worstStatus: string; // green, yellow, red, none
  totalBudget: number;
  totalSpent: number;
  companyId: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────

const statusDotColors: Record<string, string> = {
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
  blue: 'text-blue-500',
  none: 'text-muted-foreground/30',
};

const statusLabels: Record<string, string> = {
  green: 'On Track',
  yellow: 'At Risk',
  red: 'Off Track',
  blue: 'On Hold',
  none: '--',
};

const statusRank: Record<string, number> = { red: 3, yellow: 2, blue: 1, green: 0, none: -1 };

/** Extract service type from Asana project name: "Austex - CI (30 hrs)" → "CI" */
function extractServiceType(name: string): string {
  const dashMatch = name.match(/\s*[-–—]\s*(CI|SEO|PPC|Web|Design|Dev|Development|Maintenance|Support|Content|Full Project|Audit)(?:\s|$|\()/i);
  if (dashMatch) return dashMatch[1].toUpperCase();
  const suffixMatch = name.match(/\b(CI|SEO|PPC|Audit)\b/i);
  if (suffixMatch) return suffixMatch[1].toUpperCase();
  return 'Project';
}

/** Extract clean client name from mapping or Asana project name */
function extractCleanClientName(mapping: LocalProjectMapping | undefined, asanaName: string): string {
  if (mapping?.client_display_name) {
    return mapping.client_display_name
      .replace(/\s*[-–—]\s*(CI|SEO|PPC|Web|Dev|Design).*$/i, '')
      .trim();
  }
  return asanaName
    .replace(/\s*[-–—]\s*(CI|SEO|PPC|Web|Design|Dev|Development|Maintenance|Support|Retainer|Full Project|Audit).*$/i, '')
    .replace(/\s*\(.*\)$/, '')
    .trim();
}

function BudgetBar({ spent, total, by }: { spent: number; total: number; by: string }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const isOverBudget = spent > total;
  const color = isOverBudget ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500';
  const label = by === 'project_cost'
    ? `$${Math.round(spent).toLocaleString()} / $${Math.round(total).toLocaleString()}`
    : `${spent.toFixed(1)} / ${total} hrs`;

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

function TaskProgress({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {completed}/{total} <span className="text-muted-foreground/50">({pct}%)</span>
    </span>
  );
}

// ── Page Component ────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { companies } = useCompanies();
  const { projects, mappings, budgets, loading, error, refetch } = useProjects();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Company lookup maps for linking projects → companies
  const { companyByHarvestId, companyByName } = useMemo(() => {
    const byHarvestId = new Map<string, { id: string; name: string }>();
    const byName = new Map<string, { id: string; name: string }>();
    for (const c of companies) {
      if (c.harvest_client_id) byHarvestId.set(String(c.harvest_client_id), { id: c.id, name: c.name });
      byName.set(c.name.toLowerCase().trim(), { id: c.id, name: c.name });
    }
    return { companyByHarvestId: byHarvestId, companyByName: byName };
  }, [companies]);

  // Build lookup maps from local data
  const mappingByAsanaGid = useMemo(() => {
    const map = new Map<string, LocalProjectMapping>();
    for (const m of mappings) map.set(m.asana_project_gid, m);
    return map;
  }, [mappings]);

  const budgetByHarvestId = useMemo(() => {
    const map = new Map<string, LocalProjectBudget>();
    for (const b of budgets) map.set(String(b.harvest_project_id), b);
    return map;
  }, [budgets]);

  // Build company-centric view: group by client
  const clientGroups = useMemo(() => {
    const clientMap = new Map<string, UnifiedProject[]>();

    for (const p of projects) {
      const mapping = mappingByAsanaGid.get(p.asana_project_gid);
      const budget = mapping?.harvest_project_id
        ? budgetByHarvestId.get(String(mapping.harvest_project_id))
        : undefined;

      const clientName = extractCleanClientName(mapping, p.name);
      const serviceType = extractServiceType(p.name);

      const unified: UnifiedProject = {
        id: p.asana_project_gid,
        asanaName: p.name,
        clientName,
        serviceType,
        statusColor: p.status_color || 'none',
        owner: p.owner,
        numCompletedTasks: p.num_completed_tasks ?? undefined,
        numTasks: p.num_tasks ?? undefined,
        budget: budget?.budget,
        budgetSpent: budget?.budget_spent,
        budgetBy: budget?.budget_by ?? undefined,
        portfolioName: p.portfolio_name ?? undefined,
      };

      const existing = clientMap.get(clientName) || [];
      existing.push(unified);
      clientMap.set(clientName, existing);
    }

    // Build client groups with aggregate stats
    const groups: ClientGroup[] = [];
    for (const [clientName, clientProjects] of clientMap) {
      let worstStatus = 'none';
      let totalBudget = 0;
      let totalSpent = 0;

      for (const proj of clientProjects) {
        if (statusRank[proj.statusColor] > statusRank[worstStatus]) {
          worstStatus = proj.statusColor;
        }
        if (proj.budget != null) totalBudget += proj.budget;
        if (proj.budgetSpent != null) totalSpent += proj.budgetSpent;
      }

      // Resolve company ID: asana_projects.company_id first, then mapping, then name match
      let companyId: string | null = null;
      const projectWithCompany = projects.find(
        (ap) => clientProjects.some((cp) => cp.id === ap.asana_project_gid) && ap.company_id
      );
      if (projectWithCompany) {
        companyId = projectWithCompany.company_id;
      }
      if (!companyId) {
        companyId = companyByName.get(clientName.toLowerCase().trim())?.id || null;
      }

      groups.push({ clientName, projects: clientProjects, worstStatus, totalBudget, totalSpent, companyId });
    }

    // Sort: problems first (red > yellow > blue > green > none), then alphabetical
    groups.sort((a, b) => {
      const rankDiff = (statusRank[b.worstStatus] ?? -1) - (statusRank[a.worstStatus] ?? -1);
      if (rankDiff !== 0) return rankDiff;
      return a.clientName.localeCompare(b.clientName);
    });

    return groups;
  }, [projects, mappingByAsanaGid, budgetByHarvestId, companyByName]);

  // Filtered groups
  const filteredGroups = useMemo(() => {
    if (statusFilter === 'all') return clientGroups;
    if (statusFilter === 'attention') {
      return clientGroups.filter(g => g.worstStatus === 'red' || g.worstStatus === 'yellow');
    }
    return clientGroups.filter(g => g.worstStatus === statusFilter);
  }, [clientGroups, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    let total = 0, onTrack = 0, atRisk = 0, offTrack = 0, budgetAtRisk = 0;
    for (const g of clientGroups) {
      for (const p of g.projects) {
        total++;
        if (p.statusColor === 'green') onTrack++;
        else if (p.statusColor === 'yellow') atRisk++;
        else if (p.statusColor === 'red') offTrack++;
        if (p.budget && p.budgetSpent && p.budgetSpent / p.budget > 0.8) budgetAtRisk++;
      }
    }
    return { total, onTrack, atRisk, offTrack, budgetAtRisk, clients: clientGroups.length };
  }, [clientGroups]);

  // Expand multi-project clients by default on first load
  useEffect(() => {
    if (clientGroups.length > 0 && expandedClients.size === 0) {
      const toExpand = new Set(
        clientGroups.filter(g => g.projects.length > 1).map(g => g.clientName)
      );
      setExpandedClients(toExpand);
    }
  }, [clientGroups]);

  function toggleClient(name: string) {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <BrandLoader size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col px-4 sm:px-6 py-6 w-full overflow-hidden">

        {/* Header row */}
        <div className="flex items-center justify-between pb-4 shrink-0">
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <div className="flex items-center gap-3">
            {/* Inline stats */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{stats.clients} clients</span>
              <span className="text-muted-foreground">{stats.total} projects</span>
              {stats.atRisk > 0 && (
                <span className="text-yellow-500 font-medium">{stats.atRisk} at risk</span>
              )}
              {stats.offTrack > 0 && (
                <span className="text-red-500 font-medium">{stats.offTrack} off track</span>
              )}
              {stats.budgetAtRisk > 0 && (
                <span className="text-orange-500 font-medium">{stats.budgetAtRisk} over budget</span>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="attention">Needs Attention</SelectItem>
                <SelectItem value="red">Off Track</SelectItem>
                <SelectItem value="yellow">At Risk</SelectItem>
                <SelectItem value="green">On Track</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Client-grouped project list */}
        <div className="flex-1 overflow-y-auto space-y-1 pb-8">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No projects match this filter.
            </div>
          ) : (
            filteredGroups.map(group => {
              const isExpanded = expandedClients.has(group.clientName);
              const hasMultiple = group.projects.length > 1;

              // Single-project clients render inline (no expand)
              if (!hasMultiple) {
                const p = group.projects[0];
                return (
                  <div
                    key={group.clientName}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/5 transition-colors ${group.companyId ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (group.companyId) navigate(`/companies/${group.companyId}`);
                    }}
                  >
                    <Circle className={`h-2.5 w-2.5 shrink-0 fill-current ${statusDotColors[p.statusColor]}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{group.clientName}</span>
                      <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 font-normal">{p.serviceType}</Badge>
                      {!group.companyId && <span className="text-xs text-muted-foreground/40 ml-1">(unlinked)</span>}
                    </div>
                    <div className="hidden sm:block w-20 text-right">
                      {p.numTasks != null && p.numCompletedTasks != null && (
                        <TaskProgress completed={p.numCompletedTasks} total={p.numTasks} />
                      )}
                    </div>
                    <div className="hidden sm:block text-xs text-muted-foreground w-16 text-right truncate">
                      {p.owner ? p.owner.split(' ')[0] : ''}
                    </div>
                    <div className="hidden md:block w-48">
                      {p.budget != null && p.budgetSpent != null ? (
                        <BudgetBar spent={p.budgetSpent} total={p.budget} by={p.budgetBy || 'project'} />
                      ) : null}
                    </div>
                  </div>
                );
              }

              // Multi-project clients get collapsible
              return (
                <Collapsible key={group.clientName} open={isExpanded} onOpenChange={() => toggleClient(group.clientName)}>
                  <CollapsibleTrigger className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent/5 transition-colors">
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <Circle className={`h-2.5 w-2.5 shrink-0 fill-current ${statusDotColors[group.worstStatus]}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{group.clientName}</span>
                      <span className="text-xs text-muted-foreground ml-2">{group.projects.length} projects</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5">
                      {group.projects.map(p => (
                        <Badge key={p.id} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{p.serviceType}</Badge>
                      ))}
                    </div>
                    {group.companyId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/companies/${group.companyId}`);
                        }}
                      >
                        <Building2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!group.companyId && (
                      <span className="text-xs text-muted-foreground/40">(unlinked)</span>
                    )}
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="ml-9 mt-1 mb-2 space-y-0.5">
                      {group.projects.map(p => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/5 transition-colors ${group.companyId ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (group.companyId) navigate(`/companies/${group.companyId}`);
                          }}
                        >
                          <Circle className={`h-2 w-2 shrink-0 fill-current ${statusDotColors[p.statusColor]}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm">{p.serviceType}</span>
                            <span className="text-xs text-muted-foreground/50 ml-2">{statusLabels[p.statusColor]}</span>
                          </div>
                          <div className="hidden sm:block w-20 text-right">
                            {p.numTasks != null && p.numCompletedTasks != null && (
                              <TaskProgress completed={p.numCompletedTasks} total={p.numTasks} />
                            )}
                          </div>
                          <div className="hidden sm:block text-xs text-muted-foreground w-16 text-right truncate">
                            {p.owner ? p.owner.split(' ')[0] : ''}
                          </div>
                          <div className="hidden md:block w-48">
                            {p.budget != null && p.budgetSpent != null ? (
                              <BudgetBar spent={p.budgetSpent} total={p.budget} by={p.budgetBy || 'project'} />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
