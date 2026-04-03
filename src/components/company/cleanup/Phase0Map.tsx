import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Search, Lock, LockOpen, Loader2, Filter, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCompanyName, computeSimilarity, type CompanyRecord } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

type SourceRecord = { id: string; name: string; domain?: string | null };
type SourceData = {
  hubspot: SourceRecord[];
  harvest: SourceRecord[];
  freshdesk: SourceRecord[];
};

type MatchCandidate = { id: string; name: string; score: number; domain?: string | null };
type CompanyMatches = {
  hubspot: MatchCandidate[];
  harvest: MatchCandidate[];
  freshdesk: MatchCandidate[];
};

type FilterMode = 'all' | 'needs_mapping' | 'fully_mapped' | 'partially_mapped';

const STORAGE_KEY = 'phase0map_settings';

function confidenceBadge(score: number) {
  if (score >= 0.95) return <Badge variant="outline" className="text-[9px] py-0 px-1 text-green-600 border-green-500/30 bg-green-500/10">High</Badge>;
  if (score >= 0.85) return <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-500 border-amber-500/30 bg-amber-500/10">Med</Badge>;
  return <Badge variant="outline" className="text-[9px] py-0 px-1 text-orange-500 border-orange-500/30 bg-orange-500/10">Low</Badge>;
}

function mappedCount(c: CompanyRecord): number {
  return (c.hubspot_company_id ? 1 : 0) + (c.harvest_client_id ? 1 : 0) + (c.freshdesk_company_id ? 1 : 0);
}

export default function Phase0Map({ companies, onComplete, onSkip, onRefetch }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').filter || 'needs_mapping'; } catch { return 'needs_mapping'; }
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').pageSize || 25; } catch { return 25; }
  });
  const [page, setPage] = useState(0);
  const [wrapText, setWrapText] = useState(true);
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confidenceMin, setConfidenceMin] = useState<number>(0);
  // Track user overrides: companyId -> { hubspot?: id, harvest?: id, freshdesk?: id }
  const [overrides, setOverrides] = useState<Map<string, Record<string, string>>>(new Map());
  // Local lock state so we don't need to refetch after each lock
  const [localLocks, setLocalLocks] = useState<Map<string, { hubspot_company_id?: string; harvest_client_id?: string; harvest_client_name?: string; freshdesk_company_id?: string; freshdesk_company_name?: string; domain?: string }>>(new Map());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ filter, pageSize }));
  }, [filter, pageSize]);

  // Merge local locks into company data for display
  const getEffective = (c: CompanyRecord): CompanyRecord => {
    const lock = localLocks.get(c.id);
    if (!lock) return c;
    return { ...c, ...lock } as CompanyRecord;
  };

  // Fetch source data from APIs — one source at a time for progress visibility
  const apiHeaders = {
    'Content-Type': 'application/json',
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };

  const fetchOneSource = async (sourceKey: string, label: string): Promise<SourceRecord[]> => {
    setLoadingStatus(`Loading ${label}...`);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-sync`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ action: 'preview', sources: [sourceKey] }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`${label}: ${data.error || 'failed'}`);

    const records: SourceRecord[] = [];
    const seen = new Set<string>();
    const idKey = sourceKey === 'hubspot' ? 'hubspotId' : sourceKey === 'harvest' ? 'harvestId' : 'freshdeskId';
    const nameKey = sourceKey === 'hubspot' ? 'hubspotName' : sourceKey === 'harvest' ? 'harvestName' : 'freshdeskName';

    for (const d of (data.summary?.details || [])) {
      const id = d[idKey];
      if (id && !seen.has(id)) {
        seen.add(id);
        records.push({ id, name: d[nameKey] || d.name, domain: d.domain });
      }
    }
    return records;
  };

  const fetchSources = async () => {
    setLoadingSources(true);
    setLoadingStatus('Starting...');
    try {
      const hubspot = await fetchOneSource('hubspot', 'HubSpot');
      setLoadingStatus(`HubSpot: ${hubspot.length} loaded. Loading Harvest...`);

      const harvest = await fetchOneSource('harvest', 'Harvest');
      setLoadingStatus(`HubSpot: ${hubspot.length}, Harvest: ${harvest.length}. Loading Freshdesk...`);

      const freshdesk = await fetchOneSource('freshdesk', 'Freshdesk');
      setLoadingStatus('');

      setSourceData({ hubspot, harvest, freshdesk });
      toast.success(`Loaded ${hubspot.length} HS, ${harvest.length} HV, ${freshdesk.length} FD`);
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
      setLoadingStatus('');
    } finally {
      setLoadingSources(false);
    }
  };

  // Compute best matches for each company from each source
  const allMatches = useMemo(() => {
    if (!sourceData) return new Map<string, CompanyMatches>();
    const map = new Map<string, CompanyMatches>();

    for (const c of companies) {
      const normName = normalizeCompanyName(c.name);
      if (!normName) continue;

      const findMatches = (records: SourceRecord[]): MatchCandidate[] => {
        const candidates: MatchCandidate[] = [];
        for (const r of records) {
          const score = computeSimilarity(normName, normalizeCompanyName(r.name));
          if (score >= 0.75) {
            candidates.push({ id: r.id, name: r.name, score, domain: r.domain });
          }
        }
        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, 5);
      };

      map.set(c.id, {
        hubspot: c.hubspot_company_id ? [] : findMatches(sourceData.hubspot),
        harvest: c.harvest_client_id ? [] : findMatches(sourceData.harvest),
        freshdesk: c.freshdesk_company_id ? [] : findMatches(sourceData.freshdesk),
      });
    }
    return map;
  }, [companies, sourceData]);

  // Helper: best match score for a company
  const bestScore = (c: CompanyRecord): number => {
    const m = allMatches.get(c.id);
    if (!m) return 0;
    return Math.max(m.hubspot[0]?.score || 0, m.harvest[0]?.score || 0, m.freshdesk[0]?.score || 0);
  };

  // Filter
  const filtered = useMemo(() => {
    let result = [...companies];

    if (filter === 'needs_mapping') {
      result = result.filter(c => mappedCount(c) < 3);
    } else if (filter === 'fully_mapped') {
      result = result.filter(c => mappedCount(c) === 3);
    } else if (filter === 'partially_mapped') {
      result = result.filter(c => mappedCount(c) > 0 && mappedCount(c) < 3);
    }

    // Confidence threshold filter
    if (confidenceMin > 0) {
      const minScore = confidenceMin / 100;
      result = result.filter(c => mappedCount(c) === 3 || bestScore(c) >= minScore);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      const aScore = bestScore(a);
      const bScore = bestScore(b);
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [companies, filter, search, allMatches, confidenceMin]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const stats = useMemo(() => ({
    total: companies.length,
    fullyMapped: companies.filter(c => mappedCount(c) === 3).length,
    partial: companies.filter(c => mappedCount(c) > 0 && mappedCount(c) < 3).length,
    needsMapping: companies.filter(c => mappedCount(c) === 0).length,
  }), [companies]);

  // Build updates object for a company from its matches
  const buildUpdates = (companyId: string) => {
    const matches = allMatches.get(companyId);
    const override = overrides.get(companyId) || {};
    if (!matches) return {};
    const updates: any = {};
    const hsMatch = override.hubspot ? matches.hubspot.find(m => m.id === override.hubspot) : matches.hubspot[0];
    if (hsMatch && hsMatch.score >= 0.75) updates.hubspot_company_id = hsMatch.id;
    const hvMatch = override.harvest ? matches.harvest.find(m => m.id === override.harvest) : matches.harvest[0];
    if (hvMatch && hvMatch.score >= 0.75) { updates.harvest_client_id = hvMatch.id; updates.harvest_client_name = hvMatch.name; }
    const fdMatch = override.freshdesk ? matches.freshdesk.find(m => m.id === override.freshdesk) : matches.freshdesk[0];
    if (fdMatch && fdMatch.score >= 0.75) { updates.freshdesk_company_id = fdMatch.id; updates.freshdesk_company_name = fdMatch.name; }
    const domain = hsMatch?.domain || fdMatch?.domain;
    if (domain) updates.domain = domain;
    return updates;
  };

  // All actions are LOCAL until Save is clicked

  // Lock a single company's mappings (local)
  const lockMapping = (companyId: string) => {
    const updates = buildUpdates(companyId);
    if (Object.keys(updates).length === 0) return;
    setLocalLocks(prev => new Map(prev).set(companyId, { ...(prev.get(companyId) || {}), ...updates }));
  };

  // Unlock a specific source (local)
  const unlockSource = (companyId: string, source: 'hubspot' | 'harvest' | 'freshdesk') => {
    const nulls: any = {};
    if (source === 'hubspot') nulls.hubspot_company_id = null;
    else if (source === 'harvest') { nulls.harvest_client_id = null; nulls.harvest_client_name = null; }
    else if (source === 'freshdesk') { nulls.freshdesk_company_id = null; nulls.freshdesk_company_name = null; }
    setLocalLocks(prev => new Map(prev).set(companyId, { ...(prev.get(companyId) || {}), ...nulls }));
  };

  // Bulk lock selected (local)
  const bulkLock = () => {
    if (selected.size === 0) return;
    let locked = 0;
    setLocalLocks(prev => {
      const next = new Map(prev);
      for (const id of selected) {
        const updates = buildUpdates(id);
        if (Object.keys(updates).length === 0) continue;
        next.set(id, { ...(prev.get(id) || {}), ...updates });
        locked++;
      }
      return next;
    });
    toast.success(`Locked ${locked} companies. Click Save to commit.`);
    setSelected(new Set());
  };

  // Mark for deletion (local)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const bulkMarkDelete = () => {
    if (selected.size === 0) return;
    setPendingDeletes(prev => {
      const next = new Set(prev);
      selected.forEach(id => next.add(id));
      return next;
    });
    toast.success(`Marked ${selected.size} for deletion. Click Save to commit.`);
    setSelected(new Set());
  };

  // Count unsaved changes
  const [savingAll, setSavingAll] = useState(false);
  const unsavedCount = localLocks.size + pendingDeletes.size;

  // Save everything to the database at once
  const saveAll = async () => {
    if (unsavedCount === 0) return;
    setSavingAll(true);
    let saved = 0;
    let deleted = 0;
    try {
      for (const [companyId, updates] of localLocks) {
        if (pendingDeletes.has(companyId)) continue; // skip if also marked for delete
        const dbUpdates = { ...updates, last_synced_at: new Date().toISOString() };
        await supabase.from('companies').update(dbUpdates).eq('id', companyId);
        saved++;
      }
      for (const id of pendingDeletes) {
        await supabase.from('companies').delete().eq('id', id);
        deleted++;
      }
      const parts = [];
      if (saved) parts.push(`${saved} mapped`);
      if (deleted) parts.push(`${deleted} deleted`);
      toast.success(`Saved: ${parts.join(', ')}`);
      setLocalLocks(new Map());
      setPendingDeletes(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSavingAll(false);
    }
  };

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id));

  // Render a source cell: either locked (clickable to unlock) or dropdown with matches
  const renderSourceCell = (company: CompanyRecord, source: 'hubspot' | 'harvest' | 'freshdesk', lockedId: string | null, lockedName: string | null) => {
    if (lockedId) {
      return (
        <button
          className="flex flex-col items-start text-left group cursor-pointer hover:opacity-70 transition-opacity"
          onClick={() => unlockSource(company.id, source)}
          title="Click to unlock"
        >
          <div className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-green-600 shrink-0 group-hover:text-amber-500" />
            <span className="text-xs text-green-700 truncate max-w-full group-hover:text-amber-600">{lockedName || lockedId}</span>
          </div>
          <span className="text-xs text-muted-foreground/60 truncate max-w-full">ID: {lockedId}</span>
        </button>
      );
    }

    const matches = allMatches.get(company.id);
    const candidates = matches?.[source] || [];
    if (candidates.length === 0) {
      return <span className="text-xs text-muted-foreground/40">—</span>;
    }

    const override = overrides.get(company.id)?.[source];
    const selectedId = override || candidates[0]?.id;
    const activeCand = candidates.find(c => c.id === selectedId) || candidates[0];
    const pct = activeCand ? Math.round(activeCand.score * 100) : 0;
    const pctColor = pct >= 95 ? 'text-green-600' : pct >= 85 ? 'text-amber-500' : 'text-orange-500';

    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-xs font-bold ${pctColor} shrink-0 w-[32px] text-right`}>{pct}%</span>
        <Select
          value={selectedId}
          onValueChange={(v) => {
            setOverrides(prev => {
              const next = new Map(prev);
              const existing = next.get(company.id) || {};
              next.set(company.id, { ...existing, [source]: v });
              return next;
            });
          }}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground">No match</span>
            </SelectItem>
            {candidates.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <span className="truncate">{c.name}</span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Company Source Mapping</h2>
          <p className="text-sm text-muted-foreground">
            QuickBooks is the source of truth. Map each company to its HubSpot, Harvest, and Freshdesk records.
          </p>
        </div>
        <div className="flex gap-2">
          {unsavedCount > 0 && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-xs">
              {unsavedCount} unsaved
            </Badge>
          )}
          <Button variant="outline" onClick={() => {
            if (unsavedCount > 0 && !confirm(`You have ${unsavedCount} unsaved changes. Discard and leave?`)) return;
            onSkip();
          }}>Cancel</Button>
          <Button onClick={saveAll} disabled={savingAll || unsavedCount === 0} className="gap-1.5">
            {savingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            Save {unsavedCount > 0 ? `(${unsavedCount})` : ''}
          </Button>
        </div>
      </div>

      {/* Step 1: Load sources */}
      {!sourceData ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">
            {companies.length} QuickBooks companies loaded. Pull in HubSpot, Harvest, and Freshdesk records to start mapping.
          </p>
          <Button onClick={fetchSources} disabled={loadingSources} className="gap-2">
            {loadingSources ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loadingSources ? 'Loading...' : 'Load HubSpot, Harvest & Freshdesk'}
          </Button>
          {loadingStatus && (
            <p className="text-sm text-muted-foreground mt-3 animate-pulse">{loadingStatus}</p>
          )}
        </div>
      ) : (<>
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
          <span className="text-muted-foreground">QB Companies: <span className="font-medium">{stats.total}</span></span>
          <div className="h-4 w-px bg-border" />
          <span className="text-muted-foreground">Fully Mapped: <span className="text-green-600 font-medium">{stats.fullyMapped}</span></span>
          <span className="text-muted-foreground">Partial: <span className="text-amber-500 font-medium">{stats.partial}</span></span>
          <span className="text-muted-foreground">Unmapped: <span className="text-orange-500 font-medium">{stats.needsMapping}</span></span>
          <div className="h-4 w-px bg-border" />
          <span className="text-muted-foreground text-xs">
            Sources: {sourceData.hubspot.length} HS, {sourceData.harvest.length} HV, {sourceData.freshdesk.length} FD
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={fetchSources} disabled={loadingSources}>
            <RefreshCw className={`h-3 w-3 ${loadingSources ? 'animate-spin' : ''}`} /> Reload
          </Button>
        </div>

        {/* Search + Filter + Page Size */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search QB companies..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={filter} onValueChange={(v: FilterMode) => { setFilter(v); setPage(0); setSelected(new Set()); }}>
            <SelectTrigger className="w-52 h-9 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({stats.total})</SelectItem>
              <SelectItem value="needs_mapping">Needs Mapping ({stats.needsMapping})</SelectItem>
              <SelectItem value="partially_mapped">Partially Mapped ({stats.partial})</SelectItem>
              <SelectItem value="fully_mapped">Fully Mapped ({stats.fullyMapped})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(confidenceMin)} onValueChange={(v) => { setConfidenceMin(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any confidence</SelectItem>
              <SelectItem value="95">95%+ (High)</SelectItem>
              <SelectItem value="90">90%+ </SelectItem>
              <SelectItem value="85">85%+ (Med)</SelectItem>
              <SelectItem value="80">80%+</SelectItem>
              <SelectItem value="75">75%+ (Low)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-24 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / pg</SelectItem>
              <SelectItem value="25">25 / pg</SelectItem>
              <SelectItem value="50">50 / pg</SelectItem>
              <SelectItem value="100">100 / pg</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => setWrapText(w => !w)}>
            {wrapText ? 'Truncate' : 'Wrap'}
          </Button>
          <span className="text-xs text-muted-foreground">{filtered.length} companies</span>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={bulkLock}>
              <Lock className="h-3 w-3" />
              Lock Selected
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={bulkMarkDelete}>
              <Trash2 className="h-3 w-3" />
              Mark Delete
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border mb-4">
          <Table className={`table-fixed ${!wrapText ? '[&_td]:truncate [&_td]:overflow-hidden [&_td]:whitespace-nowrap' : ''}`}>
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
              <TableRow>
                <TableHead className="text-xs w-8">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={() => {
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (allPageSelected) paged.forEach(c => next.delete(c.id));
                        else paged.forEach(c => next.add(c.id));
                        return next;
                      });
                    }}
                  />
                </TableHead>
                <TableHead className="text-xs" style={{ width: '17%' }}>QuickBooks Client</TableHead>
                <TableHead className="text-xs" style={{ width: '9%' }}>Domain</TableHead>
                <TableHead className="text-xs" style={{ width: '16%' }}>HubSpot Match</TableHead>
                <TableHead className="text-xs" style={{ width: '16%' }}>Harvest Match</TableHead>
                <TableHead className="text-xs" style={{ width: '16%' }}>Freshdesk Match</TableHead>
                <TableHead className="text-xs" style={{ width: '6%' }}>Matches</TableHead>
                <TableHead className="text-xs" style={{ width: '10%' }}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(rawC => {
                const c = getEffective(rawC);
                const count = mappedCount(c);
                const hasAnyMatch = allMatches.get(c.id);
                const bestScore = hasAnyMatch ? Math.max(
                  hasAnyMatch.hubspot[0]?.score || 0,
                  hasAnyMatch.harvest[0]?.score || 0,
                  hasAnyMatch.freshdesk[0]?.score || 0,
                ) : 0;

                return (
                  <TableRow key={c.id} className={pendingDeletes.has(c.id) ? 'bg-red-500/10 opacity-50 line-through' : selected.has(c.id) ? 'bg-primary/5' : localLocks.has(c.id) ? 'bg-blue-500/5' : count === 3 ? 'bg-green-500/5' : bestScore >= 0.9 ? 'bg-amber-500/5' : ''}>
                    <TableCell className="py-2">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => setSelected(prev => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        })}
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="text-sm font-medium">{c.name}</div>
                      {c.quickbooks_invoice_summary && (
                        <div className="text-xs text-muted-foreground">
                          {(c.quickbooks_invoice_summary as any)?.count || 0} txns
                          {(c.quickbooks_invoice_summary as any)?.total ? ` · $${Math.round((c.quickbooks_invoice_summary as any).total).toLocaleString()}` : ''}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {c.domain ? (
                        <span className="text-xs text-muted-foreground">{c.domain}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {renderSourceCell(c, 'hubspot', c.hubspot_company_id, c.hubspot_company_id ? c.name : null)}
                    </TableCell>
                    <TableCell className="py-2">
                      {renderSourceCell(c, 'harvest', c.harvest_client_id, c.harvest_client_name)}
                    </TableCell>
                    <TableCell className="py-2">
                      {renderSourceCell(c, 'freshdesk', c.freshdesk_company_id, c.freshdesk_company_name)}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={`text-xs py-0 ${
                        count === 3 ? 'text-green-600 border-green-500/30' :
                        count > 0 ? 'text-amber-500 border-amber-500/30' :
                        bestScore > 0 ? 'text-blue-500 border-blue-500/30' :
                        'text-muted-foreground/40'
                      }`}>
                        {count}/3
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      {(() => {
                        const isLocked = localLocks.has(c.id);
                        const hasMatches = bestScore >= 0.75;
                        if (isLocked) {
                          return (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 text-xs gap-1 text-green-600 border-green-500/30 bg-green-500/10 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/30"
                              onClick={() => setLocalLocks(prev => { const next = new Map(prev); next.delete(c.id); return next; })}
                            >
                              <Lock className="h-3 w-3" />
                              Locked
                            </Button>
                          );
                        }
                        if (count === 3) {
                          return (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Saved
                            </span>
                          );
                        }
                        if (hasMatches) {
                          return (
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs gap-1 text-muted-foreground"
                              onClick={() => lockMapping(c.id)}
                            >
                              <LockOpen className="h-3 w-3" />
                              Unlocked
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {filtered.length > 0
              ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}`
              : 'No results'
            }
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(0)}>First</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages || 1}</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>Last</Button>
          </div>
        </div>
      </>)}
    </Card>
  );
}
