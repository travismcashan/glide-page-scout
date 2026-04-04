import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Tabs handled by parent page
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive, ArchiveRestore, Trash2, GitMerge, Loader2, Search, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  type CompanyRecord,
  normalizeCompanyName,
  stripArchivePrefix,
  computeSimilarity,
} from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  onRefetch: () => void;
  initialTab?: 'archive' | 'delete' | 'merge';
};

// ── Archive signals ──

type ArchiveSignal = 'freshdesk_archived' | 'qb_stale' | 'no_systems' | 'no_activity' | 'harvest_inactive';

type ArchiveCandidate = CompanyRecord & {
  signals: ArchiveSignal[];
  signalReasons: Record<string, string>;
  signalCount: number;
  lastQbDate: string | null;
  freshdeskArchived: boolean;
  harvestActive: boolean | null;
};

function detectArchiveSignals(c: CompanyRecord, harvestActiveMap: Map<string, boolean>): { signals: ArchiveSignal[]; signalReasons: Record<string, string>; lastQbDate: string | null; freshdeskArchived: boolean; harvestActive: boolean | null } {
  const signals: ArchiveSignal[] = [];
  const signalReasons: Record<string, string> = {};

  // Harvest inactive
  const harvestActive = c.harvest_client_id ? (harvestActiveMap.get(c.harvest_client_id) ?? null) : null;
  if (harvestActive === false) {
    signals.push('harvest_inactive');
    signalReasons.harvest_inactive = `HV: ${c.harvest_client_name || c.harvest_client_id}`;
  }

  // Freshdesk archived prefix
  const freshdeskArchived = !!(c.freshdesk_company_name && /^z[_ ]?archive/i.test(c.freshdesk_company_name));
  if (freshdeskArchived) {
    signals.push('freshdesk_archived');
    signalReasons.freshdesk_archived = `FD: ${c.freshdesk_company_name}`;
  }

  // QB last transaction > 24 months
  const lastQbDate = c.quickbooks_invoice_summary?.lastDate || null;
  if (lastQbDate) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 24);
    if (new Date(lastQbDate) < cutoff) {
      signals.push('qb_stale');
      signalReasons.qb_stale = `Last QB: ${lastQbDate}`;
    }
  }

  // No system connections at all (no HubSpot, Harvest, Freshdesk, QB)
  if (!c.hubspot_company_id && !c.harvest_client_id && !c.freshdesk_company_id && !c.quickbooks_client_name) {
    signals.push('no_systems');
    signalReasons.no_systems = 'No HS, HV, FD, or QB';
  }

  // No recent activity: no QB data AND no enrichment AND no active links
  if (!c.quickbooks_client_name && !c.harvest_client_id && (!c.enrichment_data || Object.keys(c.enrichment_data).length === 0)) {
    signals.push('no_activity');
    signalReasons.no_activity = 'No QB, no HV, no enrichment';
  }

  return { signals, signalReasons, lastQbDate, freshdeskArchived, harvestActive };
}

// ── Delete candidates ──

type DeleteCandidate = CompanyRecord & {
  reason: string;
};

function isTestOrPlaceholder(c: CompanyRecord): string | null {
  const name = c.name.toLowerCase().trim();

  // Common test/placeholder patterns
  const testPatterns = [
    /^test\b/i, /\btest$/i, /^testing\b/i, /\btest\s*company/i, /\btest\s*account/i,
    /^demo\b/i, /\bdemo\s*company/i, /\bdemo\s*account/i,
    /^sample\b/i, /^example\b/i, /^placeholder\b/i, /^temp\b/i, /^tmp\b/i,
    /^fake\b/i, /^dummy\b/i, /^xxx+/i, /^asdf/i, /^qwer/i,
    /^unknown\s*(company)?$/i, /^n\/?a$/i, /^none$/i, /^tbd$/i,
    /^-+$/, /^\?+$/, /^\.+$/,
  ];

  for (const pattern of testPatterns) {
    if (pattern.test(name)) return 'Test/placeholder name pattern';
  }

  // Very short names (1-2 chars) with no system links
  if (name.length <= 2 && !c.hubspot_company_id && !c.harvest_client_id && !c.quickbooks_client_name) {
    return 'Single/double character name with no links';
  }

  return null;
}

// ── Merge candidates ──

type MergeGroup = {
  key: string;
  parentName: string;
  companies: CompanyRecord[];
  similarity: number;
};

function findMergeGroups(companies: CompanyRecord[]): MergeGroup[] {
  // Find companies with similar names that might be related (parent/subsidiary)
  const groups: MergeGroup[] = [];
  const used = new Set<string>();
  const active = companies.filter(c => c.status !== 'archived');

  for (let i = 0; i < active.length; i++) {
    if (used.has(active[i].id)) continue;
    const cluster: CompanyRecord[] = [active[i]];
    const normI = normalizeCompanyName(active[i].name);

    for (let j = i + 1; j < active.length; j++) {
      if (used.has(active[j].id)) continue;
      const normJ = normalizeCompanyName(active[j].name);

      // Check if one name contains the other (parent/subsidiary pattern)
      const sim = computeSimilarity(active[i].name, active[j].name);
      const containsEither = normI.includes(normJ) || normJ.includes(normI);

      if (sim >= 0.80 || (containsEither && sim >= 0.65)) {
        cluster.push(active[j]);
      }
    }

    if (cluster.length >= 2) {
      for (const c of cluster) used.add(c.id);
      // Pick the shortest clean name as parent suggestion
      const sorted = [...cluster].sort((a, b) => a.name.length - b.name.length);
      const avgSim = cluster.length > 1
        ? cluster.slice(1).reduce((sum, c) => sum + computeSimilarity(cluster[0].name, c.name), 0) / (cluster.length - 1)
        : 1;
      groups.push({
        key: cluster.map(c => c.id).sort().join('|'),
        parentName: sorted[0].name,
        companies: cluster,
        similarity: avgSim,
      });
    }
  }

  return groups.sort((a, b) => b.companies.length - a.companies.length);
}

// ── Component ──

export default function PhaseCleanup({ companies, onRefetch, initialTab = 'archive' }: Props) {
  const activeTab = initialTab;

  // ── Harvest active status (fetched once from global-sync) ──
  const [harvestActiveMap, setHarvestActiveMap] = useState<Map<string, boolean>>(new Map());
  const [harvestLoading, setHarvestLoading] = useState(false);
  const harvestFetched = useRef(false);

  useEffect(() => {
    if (activeTab !== 'archive' || harvestFetched.current) return;
    harvestFetched.current = true;
    setHarvestLoading(true);
    supabase.functions.invoke('global-sync', {
      body: { source: 'harvest', mode: 'preview' },
    }).then(res => {
      const data = res.data;
      if (data?.success) {
        const map = new Map<string, boolean>();
        for (const d of (data.summary?.details || [])) {
          if (d.harvestId) {
            map.set(d.harvestId, d.harvestIsActive === true);
          }
        }
        setHarvestActiveMap(map);
      }
    }).catch(err => {
      console.error('Failed to fetch Harvest status:', err);
    }).finally(() => {
      setHarvestLoading(false);
    });
  }, [activeTab]);

  // ── Archive tab state ──
  const archiveCandidates = useMemo<ArchiveCandidate[]>(() => {
    return companies
      .map(c => {
        const { signals, signalReasons, lastQbDate, freshdeskArchived, harvestActive } = detectArchiveSignals(c, harvestActiveMap);
        return { ...c, signals, signalReasons, signalCount: signals.length, lastQbDate, freshdeskArchived, harvestActive };
      })
      .filter(c => c.signals.length > 0 || c.status === 'archived')
      .sort((a, b) => b.signalCount - a.signalCount || a.name.localeCompare(b.name));
  }, [companies, harvestActiveMap]);

  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'all' | ArchiveSignal>('all');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<'not_archived' | 'archived' | 'all'>('not_archived');
  const [hideHarvestActive, setHideHarvestActive] = useState(true);
  const [archiveSelected, setArchiveSelected] = useState<Set<string>>(() => {
    // Auto-select companies with 2+ signals
    return new Set(archiveCandidates.filter(c => c.signalCount >= 2).map(c => c.id));
  });
  const [archiving, setArchiving] = useState(false);
  const [archivePage, setArchivePage] = useState(0);
  const archivePageSize = 50;
  type ArchiveSortKey = 'name' | 'signals' | 'lastQb' | 'revenue';
  const [archiveSortKey, setArchiveSortKey] = useState<ArchiveSortKey>('signals');
  const [archiveSortDir, setArchiveSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleArchiveSort = (key: ArchiveSortKey) => {
    if (archiveSortKey === key) {
      setArchiveSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setArchiveSortKey(key);
      setArchiveSortDir(key === 'name' ? 'asc' : 'desc');
    }
    setArchivePage(0);
  };

  const filteredArchive = useMemo(() => {
    let result = [...archiveCandidates];
    if (archiveStatusFilter === 'not_archived') {
      result = result.filter(c => c.status !== 'archived');
    } else if (archiveStatusFilter === 'archived') {
      result = result.filter(c => c.status === 'archived');
    }
    if (hideHarvestActive && harvestActiveMap.size > 0) {
      result = result.filter(c => c.harvestActive !== true);
    }
    if (archiveFilter !== 'all') {
      result = result.filter(c => c.signals.includes(archiveFilter));
    }
    if (archiveSearch.trim()) {
      const q = archiveSearch.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }
    const dir = archiveSortDir === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      let cmp = 0;
      if (archiveSortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (archiveSortKey === 'signals') {
        cmp = a.signalCount - b.signalCount;
      } else if (archiveSortKey === 'lastQb') {
        const aD = a.lastQbDate || '';
        const bD = b.lastQbDate || '';
        cmp = aD < bD ? -1 : aD > bD ? 1 : 0;
      } else if (archiveSortKey === 'revenue') {
        cmp = (a.quickbooks_invoice_summary?.total || 0) - (b.quickbooks_invoice_summary?.total || 0);
      }
      return cmp === 0 ? a.name.localeCompare(b.name) * dir : cmp * dir;
    });
    return result;
  }, [archiveCandidates, archiveFilter, archiveSearch, archiveStatusFilter, hideHarvestActive, harvestActiveMap, archiveSortKey, archiveSortDir]);

  const archivePaged = filteredArchive.slice(archivePage * archivePageSize, (archivePage + 1) * archivePageSize);
  const archiveTotalPages = Math.ceil(filteredArchive.length / archivePageSize);

  const signalCounts = useMemo(() => ({
    harvest_inactive: archiveCandidates.filter(c => c.signals.includes('harvest_inactive')).length,
    freshdesk_archived: archiveCandidates.filter(c => c.signals.includes('freshdesk_archived')).length,
    qb_stale: archiveCandidates.filter(c => c.signals.includes('qb_stale')).length,
    no_systems: archiveCandidates.filter(c => c.signals.includes('no_systems')).length,
    no_activity: archiveCandidates.filter(c => c.signals.includes('no_activity')).length,
    not_archived: archiveCandidates.filter(c => c.status !== 'archived').length,
    archived: archiveCandidates.filter(c => c.status === 'archived').length,
  }), [archiveCandidates]);

  const archiveSelectedCompanies = async () => {
    if (archiveSelected.size === 0) return;
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ids = [...archiveSelected];
      const { error } = await supabase
        .from('companies')
        .update({ status: 'archived' })
        .in('id', ids);

      if (error) throw error;

      await supabase.from('company_cleanup_log').insert({
        user_id: user.id,
        phase: 'cleanup',
        action: 'bulk_archive',
        details: { count: ids.length, ids },
      });

      toast.success(`Archived ${ids.length} companies`);
      setArchiveSelected(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Archive failed: ${err.message}`);
    } finally {
      setArchiving(false);
    }
  };

  const [unarchiving, setUnarchiving] = useState(false);
  const unarchiveSelectedCompanies = async () => {
    if (archiveSelected.size === 0) return;
    setUnarchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ids = [...archiveSelected];
      const { error } = await supabase
        .from('companies')
        .update({ status: 'prospect' })
        .in('id', ids);

      if (error) throw error;

      await supabase.from('company_cleanup_log').insert({
        user_id: user.id,
        phase: 'cleanup',
        action: 'bulk_unarchive',
        details: { count: ids.length, ids },
      });

      toast.success(`Unarchived ${ids.length} companies`);
      setArchiveSelected(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Unarchive failed: ${err.message}`);
    } finally {
      setUnarchiving(false);
    }
  };

  // ── Delete tab state ──
  const deleteCandidates = useMemo<DeleteCandidate[]>(() => {
    return companies
      .map(c => {
        const reason = isTestOrPlaceholder(c);
        return reason ? { ...c, reason } : null;
      })
      .filter((c): c is DeleteCandidate => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [companies]);

  const [deleteSearch, setDeleteSearch] = useState('');
  const [deleteSelected, setDeleteSelected] = useState<Set<string>>(() => new Set(deleteCandidates.map(c => c.id)));
  const [deleting, setDeleting] = useState(false);

  const filteredDelete = useMemo(() => {
    if (!deleteSearch.trim()) return deleteCandidates;
    const q = deleteSearch.toLowerCase();
    return deleteCandidates.filter(c => c.name.toLowerCase().includes(q));
  }, [deleteCandidates, deleteSearch]);

  const deleteSelectedCompanies = async () => {
    if (deleteSelected.size === 0) return;
    const confirmed = window.confirm(`Permanently delete ${deleteSelected.size} companies? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ids = [...deleteSelected];

      // Delete related records first
      for (const table of ['contacts', 'deals', 'engagements'] as const) {
        await supabase.from(table).delete().in('company_id', ids);
      }

      const { error } = await supabase.from('companies').delete().in('id', ids);
      if (error) throw error;

      await supabase.from('company_cleanup_log').insert({
        user_id: user.id,
        phase: 'cleanup',
        action: 'bulk_delete',
        details: { count: ids.length, ids, names: ids.map(id => companies.find(c => c.id === id)?.name) },
      });

      toast.success(`Deleted ${ids.length} test/placeholder companies`);
      setDeleteSelected(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  // ── Merge tab state ──
  const mergeGroups = useMemo(() => findMergeGroups(companies), [companies]);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeNames, setMergeNames] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const g of mergeGroups) m.set(g.key, g.parentName);
    return m;
  });
  const [mergeKeepers, setMergeKeepers] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const g of mergeGroups) {
      // Default keeper: most system IDs, then most QB revenue
      const sorted = [...g.companies].sort((a, b) => {
        const aIds = [a.hubspot_company_id, a.harvest_client_id, a.freshdesk_company_id, a.quickbooks_client_name].filter(Boolean).length;
        const bIds = [b.hubspot_company_id, b.harvest_client_id, b.freshdesk_company_id, b.quickbooks_client_name].filter(Boolean).length;
        if (aIds !== bIds) return bIds - aIds;
        const aRev = a.quickbooks_invoice_summary?.total || 0;
        const bRev = b.quickbooks_invoice_summary?.total || 0;
        return bRev - aRev;
      });
      m.set(g.key, sorted[0].id);
    }
    return m;
  });
  const [merging, setMerging] = useState(false);

  const mergeSelectedGroups = async () => {
    if (mergeSelected.size === 0) return;
    const confirmed = window.confirm(`Merge ${mergeSelected.size} groups? Children will be deleted after merging their IDs into the keeper.`);
    if (!confirmed) return;

    setMerging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let merged = 0;
      for (const group of mergeGroups) {
        if (!mergeSelected.has(group.key)) continue;
        const keeperId = mergeKeepers.get(group.key) || group.companies[0].id;
        const keeper = group.companies.find(c => c.id === keeperId)!;
        const removes = group.companies.filter(c => c.id !== keeperId);
        const newName = mergeNames.get(group.key) || keeper.name;

        // Merge all cross-system IDs from children into keeper
        const updates: any = { name: newName };
        for (const child of removes) {
          if (!keeper.hubspot_company_id && child.hubspot_company_id) updates.hubspot_company_id = child.hubspot_company_id;
          if (!keeper.harvest_client_id && child.harvest_client_id) {
            updates.harvest_client_id = child.harvest_client_id;
            updates.harvest_client_name = child.harvest_client_name;
          }
          if (!keeper.freshdesk_company_id && child.freshdesk_company_id) {
            updates.freshdesk_company_id = child.freshdesk_company_id;
            updates.freshdesk_company_name = child.freshdesk_company_name;
          }
          if (!keeper.quickbooks_client_name && child.quickbooks_client_name) {
            updates.quickbooks_client_name = child.quickbooks_client_name;
            updates.quickbooks_invoice_summary = child.quickbooks_invoice_summary;
          }
          if (!keeper.domain && child.domain) updates.domain = child.domain;
          if (!keeper.industry && child.industry) updates.industry = child.industry;
        }

        await supabase.from('companies').update(updates).eq('id', keeperId);

        // Move FK references to keeper
        for (const child of removes) {
          for (const table of ['contacts', 'deals', 'engagements'] as const) {
            await supabase.from(table).update({ company_id: keeperId }).eq('company_id', child.id);
          }
          await supabase.from('companies').delete().eq('id', child.id);
        }

        await supabase.from('company_cleanup_log').insert({
          user_id: user.id,
          phase: 'cleanup',
          action: 'merge',
          source_id: removes.map(r => r.id).join(','),
          target_id: keeperId,
          details: {
            parentName: newName,
            keeperId,
            removedIds: removes.map(r => r.id),
            removedNames: removes.map(r => r.name),
          },
        });
        merged++;
      }

      toast.success(`Merged ${merged} groups`);
      setMergeSelected(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Merge failed: ${err.message}`);
    } finally {
      setMerging(false);
    }
  };

  // ── Stats ──
  const alreadyArchived = companies.filter(c => c.status === 'archived').length;

  // ── Helpers ──
  function systemBadges(c: CompanyRecord) {
    const badges: { label: string; color: string }[] = [];
    if (c.hubspot_company_id) badges.push({ label: 'HS', color: 'text-orange-600 border-orange-500/30 bg-orange-500/10' });
    if (c.harvest_client_id) badges.push({ label: 'HV', color: 'text-orange-500 border-orange-400/30 bg-orange-400/10' });
    if (c.freshdesk_company_id) badges.push({ label: 'FD', color: 'text-green-600 border-green-500/30 bg-green-500/10' });
    if (c.quickbooks_client_name) badges.push({ label: 'QB', color: 'text-blue-600 border-blue-500/30 bg-blue-500/10' });
    return badges;
  }

  const signalLabel: Record<ArchiveSignal, string> = {
    harvest_inactive: 'HV Inactive',
    freshdesk_archived: 'FD Archived',
    qb_stale: 'QB > 24mo',
    no_systems: 'No Links',
    no_activity: 'No Activity',
  };

  const signalColor: Record<ArchiveSignal, string> = {
    harvest_inactive: 'text-orange-600 border-orange-500/30 bg-orange-500/10',
    freshdesk_archived: 'text-amber-600 border-amber-500/30 bg-amber-500/10',
    qb_stale: 'text-red-600 border-red-500/30 bg-red-500/10',
    no_systems: 'text-gray-600 border-gray-500/30 bg-gray-500/10',
    no_activity: 'text-purple-600 border-purple-500/30 bg-purple-500/10',
  };

  return (
    <div className="space-y-4">
      {activeTab === 'archive' && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Archive Candidates</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Companies flagged by: Freshdesk z_archive prefix, QB last transaction &gt; 24 months, no system links, or no activity.
                </p>
              </div>
              <div className="flex gap-2">
                {archiveStatusFilter !== 'archived' && (
                  <Button
                    onClick={archiveSelectedCompanies}
                    disabled={archiving || archiveSelected.size === 0}
                    size="sm"
                    className="gap-1.5"
                  >
                    {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    Archive {archiveSelected.size} Selected
                  </Button>
                )}
                {archiveStatusFilter !== 'not_archived' && (
                  <Button
                    onClick={unarchiveSelectedCompanies}
                    disabled={unarchiving || archiveSelected.size === 0}
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                  >
                    {unarchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                    Unarchive {archiveSelected.size} Selected
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="h-9 pl-8 text-xs"
                  value={archiveSearch}
                  onChange={e => { setArchiveSearch(e.target.value); setArchivePage(0); }}
                />
              </div>
              <Select value={archiveStatusFilter} onValueChange={(v) => { setArchiveStatusFilter(v as any); setArchivePage(0); }}>
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_archived">Not Archived ({signalCounts.not_archived})</SelectItem>
                  <SelectItem value="archived">Archived ({signalCounts.archived})</SelectItem>
                  <SelectItem value="all">All ({archiveCandidates.length})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={archiveFilter} onValueChange={(v) => { setArchiveFilter(v as any); setArchivePage(0); }}>
                <SelectTrigger className="h-9 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Signals ({archiveCandidates.length})</SelectItem>
                  <SelectItem value="harvest_inactive">HV Inactive ({signalCounts.harvest_inactive})</SelectItem>
                  <SelectItem value="freshdesk_archived">FD Archived ({signalCounts.freshdesk_archived})</SelectItem>
                  <SelectItem value="qb_stale">QB &gt; 24mo ({signalCounts.qb_stale})</SelectItem>
                  <SelectItem value="no_systems">No Links ({signalCounts.no_systems})</SelectItem>
                  <SelectItem value="no_activity">No Activity ({signalCounts.no_activity})</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setArchiveSelected(new Set(filteredArchive.map(c => c.id)))}
              >
                Select All ({filteredArchive.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => setArchiveSelected(new Set())}
              >
                Clear
              </Button>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={hideHarvestActive}
                  onCheckedChange={(checked) => { setHideHarvestActive(!!checked); setArchivePage(0); }}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Hide active clients</span>
              </label>
              {harvestLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">{filteredArchive.length} shown</span>
            </div>

            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={archivePaged.length > 0 && archivePaged.every(c => archiveSelected.has(c.id))} onCheckedChange={(checked) => {
                      setArchiveSelected(prev => {
                        const next = new Set(prev);
                        archivePaged.forEach(c => checked ? next.add(c.id) : next.delete(c.id));
                        return next;
                      });
                    }} /></TableHead>
                    <TableHead className="text-xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleArchiveSort('name')}>
                      <span className="inline-flex items-center gap-1">Company {archiveSortKey === 'name' && (archiveSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
                    </TableHead>
                    <TableHead className="text-xs">Systems</TableHead>
                    <TableHead className="text-xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleArchiveSort('signals')}>
                      <span className="inline-flex items-center gap-1">Signals {archiveSortKey === 'signals' && (archiveSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
                    </TableHead>
                    <TableHead className="text-xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleArchiveSort('lastQb')}>
                      <span className="inline-flex items-center gap-1">Last QB {archiveSortKey === 'lastQb' && (archiveSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
                    </TableHead>
                    <TableHead className="text-xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleArchiveSort('revenue')}>
                      <span className="inline-flex items-center gap-1">Revenue {archiveSortKey === 'revenue' && (archiveSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivePaged.map(c => (
                    <TableRow key={c.id} className={archiveSelected.has(c.id) ? 'bg-amber-500/5' : ''}>
                      <TableCell className="py-1.5">
                        <Checkbox
                          checked={archiveSelected.has(c.id)}
                          onCheckedChange={() => setArchiveSelected(prev => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          })}
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="text-sm font-medium">{c.name}</div>
                        {c.domain && <div className="text-xs text-muted-foreground">{c.domain}</div>}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex gap-1 flex-wrap">
                          {systemBadges(c).map(b => (
                            <Badge key={b.label} variant="outline" className={`text-[9px] py-0 ${b.color}`}>{b.label}</Badge>
                          ))}
                          {systemBadges(c).length === 0 && <span className="text-xs text-muted-foreground/50">none</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="flex flex-col gap-0.5">
                          {c.signals.map(s => (
                            <div key={s} className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-[9px] py-0 shrink-0 ${signalColor[s]}`}>{signalLabel[s]}</Badge>
                              {c.signalReasons[s] && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={c.signalReasons[s]}>{c.signalReasons[s]}</span>}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {c.lastQbDate || '-'}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {c.quickbooks_invoice_summary?.total
                          ? `$${Math.round(c.quickbooks_invoice_summary.total).toLocaleString()}`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {archivePaged.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No archive candidates found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {archiveTotalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">Page {archivePage + 1} of {archiveTotalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={archivePage === 0} onClick={() => setArchivePage(0)}><ChevronsLeft className="h-3 w-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={archivePage === 0} onClick={() => setArchivePage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={archivePage >= archiveTotalPages - 1} onClick={() => setArchivePage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={archivePage >= archiveTotalPages - 1} onClick={() => setArchivePage(archiveTotalPages - 1)}><ChevronsRight className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </Card>
      )}

      {activeTab === 'delete' && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Test & Placeholder Companies</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Companies detected as test, demo, sample, placeholder, or junk entries. <span className="text-red-500 font-medium">Deletion is permanent.</span>
                </p>
              </div>
              <Button
                onClick={deleteSelectedCompanies}
                disabled={deleting || deleteSelected.size === 0}
                size="sm"
                variant="destructive"
                className="gap-1.5"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete {deleteSelected.size} Selected
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="h-9 pl-8 text-xs"
                  value={deleteSearch}
                  onChange={e => setDeleteSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setDeleteSelected(new Set(filteredDelete.map(c => c.id)))}>
                Select All ({filteredDelete.length})
              </Button>
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setDeleteSelected(new Set())}>
                Clear
              </Button>
            </div>

            {filteredDelete.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                No test or placeholder companies detected
              </div>
            ) : (
              <div className="border rounded-lg overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={filteredDelete.length > 0 && filteredDelete.every(c => deleteSelected.has(c.id))} onCheckedChange={(checked) => {
                        setDeleteSelected(checked ? new Set(filteredDelete.map(c => c.id)) : new Set());
                      }} /></TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Reason</TableHead>
                      <TableHead className="text-xs">Systems</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDelete.map(c => (
                      <TableRow key={c.id} className={deleteSelected.has(c.id) ? 'bg-red-500/5' : ''}>
                        <TableCell className="py-1.5">
                          <Checkbox
                            checked={deleteSelected.has(c.id)}
                            onCheckedChange={() => setDeleteSelected(prev => {
                              const next = new Set(prev);
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                              return next;
                            })}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <div className="text-sm font-medium">{c.name}</div>
                          {c.domain && <div className="text-xs text-muted-foreground">{c.domain}</div>}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">{c.reason}</TableCell>
                        <TableCell className="py-1.5">
                          <div className="flex gap-1 flex-wrap">
                            {systemBadges(c).map(b => (
                              <Badge key={b.label} variant="outline" className={`text-[9px] py-0 ${b.color}`}>{b.label}</Badge>
                            ))}
                            {systemBadges(c).length === 0 && <span className="text-xs text-muted-foreground/50">none</span>}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className="text-[9px] py-0">{c.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
      )}

      {activeTab === 'merge' && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Merge Similar Companies</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Groups of companies with similar names that may be related (parent/subsidiary). Edit the parent name, pick the keeper, then merge.
                </p>
              </div>
              <Button
                onClick={mergeSelectedGroups}
                disabled={merging || mergeSelected.size === 0}
                size="sm"
                className="gap-1.5"
              >
                {merging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitMerge className="h-3.5 w-3.5" />}
                Merge {mergeSelected.size} Groups
              </Button>
            </div>

            {mergeGroups.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                No merge candidates found
              </div>
            ) : (
              <div className="space-y-3">
                {mergeGroups.map(group => {
                  const keeperId = mergeKeepers.get(group.key) || group.companies[0].id;
                  const parentName = mergeNames.get(group.key) || group.parentName;

                  return (
                    <Card key={group.key} className={`p-3 ${mergeSelected.has(group.key) ? 'ring-2 ring-blue-500/30 bg-blue-500/5' : ''}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={mergeSelected.has(group.key)}
                          onCheckedChange={() => setMergeSelected(prev => {
                            const next = new Set(prev);
                            next.has(group.key) ? next.delete(group.key) : next.add(group.key);
                            return next;
                          })}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">Parent name:</span>
                            <Input
                              value={parentName}
                              onChange={e => setMergeNames(prev => new Map(prev).set(group.key, e.target.value))}
                              className="h-7 text-sm font-medium max-w-sm"
                            />
                            <Badge variant="outline" className="text-[9px] py-0 shrink-0">
                              {group.companies.length} companies · {Math.round(group.similarity * 100)}% similar
                            </Badge>
                          </div>
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs w-16">Keeper</TableHead>
                                  <TableHead className="text-xs">Name</TableHead>
                                  <TableHead className="text-xs">Domain</TableHead>
                                  <TableHead className="text-xs">Systems</TableHead>
                                  <TableHead className="text-xs">Revenue</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.companies.map(c => (
                                  <TableRow key={c.id} className={c.id === keeperId ? 'bg-green-500/5' : 'bg-red-500/5 opacity-70'}>
                                    <TableCell className="py-1">
                                      <input
                                        type="radio"
                                        name={`keeper-${group.key}`}
                                        checked={c.id === keeperId}
                                        onChange={() => setMergeKeepers(prev => new Map(prev).set(group.key, c.id))}
                                        className="h-3.5 w-3.5"
                                      />
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <span className="text-sm">{c.name}</span>
                                      {c.id === keeperId && <Badge variant="outline" className="text-[9px] py-0 ml-1.5 text-green-600 border-green-500/30">keep</Badge>}
                                      {c.id !== keeperId && <Badge variant="outline" className="text-[9px] py-0 ml-1.5 text-red-500 border-red-500/30">remove</Badge>}
                                    </TableCell>
                                    <TableCell className="py-1 text-xs text-muted-foreground">{c.domain || '-'}</TableCell>
                                    <TableCell className="py-1">
                                      <div className="flex gap-1">
                                        {systemBadges(c).map(b => (
                                          <Badge key={b.label} variant="outline" className={`text-[9px] py-0 ${b.color}`}>{b.label}</Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1 text-xs tabular-nums">
                                      {c.quickbooks_invoice_summary?.total
                                        ? `$${Math.round(c.quickbooks_invoice_summary.total).toLocaleString()}`
                                        : '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
      )}
    </div>
  );
}
