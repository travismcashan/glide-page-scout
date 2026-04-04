import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrandLoader } from '@/components/BrandLoader';
import {
  ArrowLeft,
  Search,
  Zap,
  Lock,
  Unlock,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Circle,
  Link2,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────

interface ProjectMapping {
  id: string;
  asana_project_gid: string;
  asana_project_name: string;
  harvest_project_id: number | null;
  harvest_project_name: string | null;
  client_display_name: string | null;
  is_auto_matched: boolean;
  match_confidence: number | null;
  notes: string | null;
  updated_at: string;
}

interface HarvestProject {
  id: number;
  name: string;
  clientName: string | null;
}

// ── Page ──────────────────────────────────────────────────────────

export default function ProjectMappingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [mappings, setMappings] = useState<ProjectMapping[]>([]);
  const [harvestProjects, setHarvestProjects] = useState<HarvestProject[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'manual'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHarvestId, setEditHarvestId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch mappings from DB and Harvest projects for the dropdown
      const [mappingRes, harvestRes] = await Promise.all([
        supabase.from('project_mappings').select('*').order('asana_project_name'),
        supabase.functions.invoke('harvest-project-hours', { body: {} }),
      ]);

      if (mappingRes.error) throw new Error(mappingRes.error.message);
      setMappings(mappingRes.data || []);

      // Build harvest project list from budget data (has project names + client names)
      const budgets = harvestRes.data?.project_hours || [];
      const seen = new Set<number>();
      const projects: HarvestProject[] = [];
      for (const b of budgets) {
        if (!seen.has(b.harvest_project_id)) {
          seen.add(b.harvest_project_id);
          projects.push({
            id: b.harvest_project_id,
            name: b.project_name,
            clientName: b.client_name,
          });
        }
      }
      projects.sort((a, b) => a.name.localeCompare(b.name));
      setHarvestProjects(projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  // Filter + search
  const filtered = useMemo(() => {
    let result = mappings;

    if (filter === 'matched') result = result.filter(m => m.harvest_project_id != null);
    else if (filter === 'unmatched') result = result.filter(m => m.harvest_project_id == null);
    else if (filter === 'manual') result = result.filter(m => !m.is_auto_matched && m.harvest_project_id != null);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.asana_project_name.toLowerCase().includes(q) ||
        (m.harvest_project_name || '').toLowerCase().includes(q) ||
        (m.client_display_name || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [mappings, filter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: mappings.length,
    matched: mappings.filter(m => m.harvest_project_id != null).length,
    unmatched: mappings.filter(m => m.harvest_project_id == null).length,
    manual: mappings.filter(m => !m.is_auto_matched && m.harvest_project_id != null).length,
    highConfidence: mappings.filter(m => (m.match_confidence || 0) >= 90).length,
  }), [mappings]);

  // Save a manual mapping override
  async function saveMapping(asanaGid: string, harvestId: number | null) {
    const harvestProject = harvestId ? harvestProjects.find(p => p.id === harvestId) : null;

    const { error } = await supabase.functions.invoke('project-mapping', {
      body: {
        action: 'save-mapping',
        asanaProjectGid: asanaGid,
        harvestProjectId: harvestId,
        harvestProjectName: harvestProject?.name || null,
      },
    });

    if (error) {
      toast.error('Failed to save mapping');
      return;
    }

    // Update local state
    setMappings(prev => prev.map(m => {
      if (m.asana_project_gid === asanaGid) {
        return {
          ...m,
          harvest_project_id: harvestId,
          harvest_project_name: harvestProject?.name || null,
          is_auto_matched: false,
          match_confidence: harvestId ? 100 : null,
        };
      }
      return m;
    }));

    setEditingId(null);
    toast.success('Mapping saved');
  }

  // Run AI auto-match (unmatched only)
  async function runAutoMatch() {
    setMatchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('project-mapping', {
        body: { action: 'auto-match' },
      });
      if (error) throw error;

      toast.success(`Matched ${data?.summary?.matched || 0} of ${data?.summary?.total || 0} projects`);
      await fetchData(); // Reload from DB
    } catch (e) {
      toast.error('Auto-match failed');
      console.error(e);
    } finally {
      setMatchLoading(false);
    }
  }

  // Clear a mapping (unlink)
  async function clearMapping(asanaGid: string) {
    await saveMapping(asanaGid, null);
  }

  function confidenceBadge(confidence: number | null, isAuto: boolean) {
    if (!isAuto) return <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" /> Manual</Badge>;
    if (confidence == null) return null;
    if (confidence >= 90) return <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/30">{confidence}%</Badge>;
    if (confidence >= 70) return <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">{confidence}%</Badge>;
    return <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30">{confidence}%</Badge>;
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-center py-20">
          <BrandLoader size={48} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="text-center py-20">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col px-4 sm:px-6 py-6 w-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 pb-4 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Project Mapping</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Link Asana projects to Harvest projects for unified budget tracking.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runAutoMatch}
            disabled={matchLoading}
          >
            <Zap className={`h-3.5 w-3.5 mr-1.5 ${matchLoading ? 'animate-pulse' : ''}`} />
            {matchLoading ? 'Matching...' : 'Run AI Match'}
          </Button>
        </div>

        {/* Stats + filters row */}
        <div className="flex items-center justify-between pb-3 shrink-0 gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{stats.total} total</span>
            <button
              onClick={() => setFilter(filter === 'matched' ? 'all' : 'matched')}
              className={`${filter === 'matched' ? 'text-green-500 font-medium' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
            >
              <Link2 className="h-3 w-3 inline mr-1" />{stats.matched} matched
            </button>
            <button
              onClick={() => setFilter(filter === 'unmatched' ? 'all' : 'unmatched')}
              className={`${filter === 'unmatched' ? 'text-red-500 font-medium' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
            >
              <Unlink className="h-3 w-3 inline mr-1" />{stats.unmatched} unmatched
            </button>
            <button
              onClick={() => setFilter(filter === 'manual' ? 'all' : 'manual')}
              className={`${filter === 'manual' ? 'text-blue-500 font-medium' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
            >
              <Lock className="h-3 w-3 inline mr-1" />{stats.manual} locked
            </button>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border/50">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Asana Project</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[40%]">Harvest Project</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">Confidence</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const isEditing = editingId === m.asana_project_gid;
                const isMatched = m.harvest_project_id != null;

                return (
                  <tr key={m.asana_project_gid} className="border-b border-border/20 last:border-0 hover:bg-accent/5">
                    {/* Asana project */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Circle className={`h-2 w-2 shrink-0 fill-current ${isMatched ? 'text-green-500' : 'text-muted-foreground/30'}`} />
                        <div>
                          <span className="font-medium">{m.asana_project_name}</span>
                          {m.client_display_name && (
                            <span className="text-xs text-muted-foreground ml-2">{m.client_display_name}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Harvest project (editable) */}
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={editHarvestId}
                            onValueChange={setEditHarvestId}
                          >
                            <SelectTrigger className="h-8 text-sm flex-1">
                              <SelectValue placeholder="Select Harvest project..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="none">-- No match --</SelectItem>
                              {harvestProjects.map(hp => (
                                <SelectItem key={hp.id} value={String(hp.id)}>
                                  {hp.name}
                                  {hp.clientName && <span className="text-muted-foreground ml-1">({hp.clientName})</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => saveMapping(m.asana_project_gid, editHarvestId === 'none' ? null : Number(editHarvestId))}
                          >
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`cursor-pointer hover:underline ${isMatched ? '' : 'text-muted-foreground/40 italic'}`}
                          onClick={() => {
                            setEditingId(m.asana_project_gid);
                            setEditHarvestId(m.harvest_project_id ? String(m.harvest_project_id) : 'none');
                          }}
                        >
                          {isMatched ? m.harvest_project_name : 'Click to assign...'}
                        </span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="px-3 py-2.5 text-center">
                      {confidenceBadge(m.match_confidence, m.is_auto_matched)}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isMatched && !isEditing && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit mapping"
                              onClick={() => {
                                setEditingId(m.asana_project_gid);
                                setEditHarvestId(String(m.harvest_project_id));
                              }}
                            >
                              <Search className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Clear mapping"
                              onClick={() => clearMapping(m.asana_project_gid)}
                            >
                              <Unlink className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                        {!isMatched && !isEditing && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Assign mapping"
                            onClick={() => {
                              setEditingId(m.asana_project_gid);
                              setEditHarvestId('none');
                            }}
                          >
                            <Link2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
