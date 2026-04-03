import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Search, Lock, Loader2, Filter, Trash2, RefreshCw } from 'lucide-react';
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
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confidenceMin, setConfidenceMin] = useState<number>(0);
  // Track user overrides: companyId -> { hubspot?: id, harvest?: id, freshdesk?: id }
  const [overrides, setOverrides] = useState<Map<string, Record<string, string>>>(new Map());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ filter, pageSize }));
  }, [filter, pageSize]);

  // Fetch source data from APIs via global-sync preview
  const fetchSources = async () => {
    setLoadingSources(true);
    try {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/global-sync`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'preview' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch sources');

      // Extract source records with IDs from sync details
      const hubspot: SourceRecord[] = [];
      const harvest: SourceRecord[] = [];
      const freshdesk: SourceRecord[] = [];
      const seenHS = new Set<string>();
      const seenHV = new Set<string>();
      const seenFD = new Set<string>();

      for (const d of (data.summary?.details || [])) {
        if (d.hubspotId && !seenHS.has(d.hubspotId)) {
          seenHS.add(d.hubspotId);
          hubspot.push({ id: d.hubspotId, name: d.hubspotName || d.name, domain: d.domain });
        }
        if (d.harvestId && !seenHV.has(d.harvestId)) {
          seenHV.add(d.harvestId);
          harvest.push({ id: d.harvestId, name: d.harvestName || d.name, domain: d.domain });
        }
        if (d.freshdeskId && !seenFD.has(d.freshdeskId)) {
          seenFD.add(d.freshdeskId);
          freshdesk.push({ id: d.freshdeskId, name: d.freshdeskName || d.name, domain: d.domain });
        }
      }

      setSourceData({ hubspot, harvest, freshdesk });
      toast.success(`Loaded ${hubspot.length} HubSpot, ${harvest.length} Harvest, ${freshdesk.length} Freshdesk records`);
    } catch (err: any) {
      toast.error(`Failed to load sources: ${err.message}`);
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

  // Lock a mapping: save source IDs to company record
  const lockMapping = async (companyId: string) => {
    setSaving(companyId);
    try {
      const matches = allMatches.get(companyId);
      const override = overrides.get(companyId) || {};
      const updates: any = {};

      // HubSpot
      const hsMatch = override.hubspot
        ? matches?.hubspot.find(m => m.id === override.hubspot) || matches?.hubspot[0]
        : matches?.hubspot[0];
      if (hsMatch && hsMatch.score >= 0.75) {
        updates.hubspot_company_id = hsMatch.id;
      }

      // Harvest
      const hvMatch = override.harvest
        ? matches?.harvest.find(m => m.id === override.harvest) || matches?.harvest[0]
        : matches?.harvest[0];
      if (hvMatch && hvMatch.score >= 0.75) {
        updates.harvest_client_id = hvMatch.id;
        updates.harvest_client_name = hvMatch.name;
      }

      // Freshdesk
      const fdMatch = override.freshdesk
        ? matches?.freshdesk.find(m => m.id === override.freshdesk) || matches?.freshdesk[0]
        : matches?.freshdesk[0];
      if (fdMatch && fdMatch.score >= 0.75) {
        updates.freshdesk_company_id = fdMatch.id;
        updates.freshdesk_company_name = fdMatch.name;
      }

      // Also save domain if any match has one
      const domain = hsMatch?.domain || fdMatch?.domain;
      if (domain) updates.domain = domain;

      if (Object.keys(updates).length === 0) {
        toast.info('No matches to lock');
        setSaving(null);
        return;
      }

      updates.last_synced_at = new Date().toISOString();
      await supabase.from('companies').update(updates).eq('id', companyId);
      toast.success('Mapping locked');
      onRefetch();
    } catch (err: any) {
      toast.error(`Lock failed: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Bulk delete
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const id of selected) {
        await supabase.from('companies').delete().eq('id', id);
      }
      toast.success(`Deleted ${selected.size} companies`);
      setSelected(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id));

  // Render a source cell: either locked (already mapped) or dropdown with matches
  const renderSourceCell = (company: CompanyRecord, source: 'hubspot' | 'harvest' | 'freshdesk', lockedId: string | null, lockedName: string | null) => {
    if (lockedId) {
      return (
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-green-600 shrink-0" />
          <span className="text-xs text-green-700 truncate max-w-[140px]" title={lockedName || lockedId}>{lockedName || lockedId}</span>
        </div>
      );
    }

    const matches = allMatches.get(company.id);
    const candidates = matches?.[source] || [];
    if (candidates.length === 0) {
      return <span className="text-xs text-muted-foreground/40">—</span>;
    }

    const override = overrides.get(company.id)?.[source];
    const selectedId = override || candidates[0]?.id;

    return (
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
        <SelectTrigger className="h-7 text-xs w-full max-w-[200px] truncate">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">No match</span>
          </SelectItem>
          {candidates.map(c => (
            <SelectItem key={c.id} value={c.id}>
              <span className="truncate">{c.name}</span>
              {confidenceBadge(c.score)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
          <Button variant="outline" onClick={onSkip}>Skip</Button>
          <Button onClick={onComplete}>Done</Button>
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
            {loadingSources ? 'Loading sources...' : 'Load HubSpot, Harvest & Freshdesk'}
          </Button>
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
          <span className="text-xs text-muted-foreground">{filtered.length} companies</span>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" disabled={bulkDeleting} onClick={bulkDelete}>
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border mb-4">
          <Table className="table-fixed">
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
                <TableHead className="text-xs" style={{ width: '25%', minWidth: 160 }}>QuickBooks Client</TableHead>
                <TableHead className="text-xs" style={{ width: '22%', minWidth: 120 }}>HubSpot Match</TableHead>
                <TableHead className="text-xs" style={{ width: '22%', minWidth: 120 }}>Harvest Match</TableHead>
                <TableHead className="text-xs" style={{ width: '22%', minWidth: 120 }}>Freshdesk Match</TableHead>
                <TableHead className="text-xs w-[6%] text-center">Map</TableHead>
                <TableHead className="text-xs w-[6%] text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(c => {
                const count = mappedCount(c);
                const hasAnyMatch = allMatches.get(c.id);
                const bestScore = hasAnyMatch ? Math.max(
                  hasAnyMatch.hubspot[0]?.score || 0,
                  hasAnyMatch.harvest[0]?.score || 0,
                  hasAnyMatch.freshdesk[0]?.score || 0,
                ) : 0;

                return (
                  <TableRow key={c.id} className={selected.has(c.id) ? 'bg-primary/5' : count === 3 ? 'bg-green-500/5' : bestScore >= 0.9 ? 'bg-amber-500/5' : ''}>
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
                      {c.domain && <div className="text-[11px] text-muted-foreground">{c.domain}</div>}
                      {c.quickbooks_invoice_summary && (
                        <div className="text-[10px] text-muted-foreground">
                          {(c.quickbooks_invoice_summary as any)?.count || 0} txns
                          {(c.quickbooks_invoice_summary as any)?.total ? ` · $${Math.round((c.quickbooks_invoice_summary as any).total).toLocaleString()}` : ''}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      {renderSourceCell(c, 'hubspot', c.hubspot_company_id, c.hubspot_company_id)}
                    </TableCell>
                    <TableCell className="py-2">
                      {renderSourceCell(c, 'harvest', c.harvest_client_id, c.harvest_client_name)}
                    </TableCell>
                    <TableCell className="py-2">
                      {renderSourceCell(c, 'freshdesk', c.freshdesk_company_id, c.freshdesk_company_name)}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <Badge variant="outline" className={`text-[10px] py-0 ${
                        count === 3 ? 'text-green-600 border-green-500/30' :
                        count > 0 ? 'text-amber-500 border-amber-500/30' :
                        bestScore > 0 ? 'text-blue-500 border-blue-500/30' :
                        'text-muted-foreground/40'
                      }`}>
                        {count}/3
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {count < 3 && bestScore >= 0.75 && (
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs gap-1"
                          disabled={saving === c.id}
                          onClick={() => lockMapping(c.id)}
                        >
                          {saving === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
                          Lock
                        </Button>
                      )}
                      {count === 3 && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                      )}
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
