import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Search, Link2, Loader2, Filter, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCompanyName, computeSimilarity, type CompanyRecord } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

type SourceKey = 'hubspot' | 'harvest' | 'freshdesk' | 'quickbooks';

type FilterMode = 'all' | 'has_suggestions' | 'needs_review' | 'fully_mapped' | 'single_source' | 'no_sources';

const STORAGE_KEY = 'phase0map_settings';

function sourceCount(c: CompanyRecord): number {
  return (
    (c.hubspot_company_id ? 1 : 0) +
    (c.harvest_client_id ? 1 : 0) +
    (c.freshdesk_company_id ? 1 : 0) +
    (c.quickbooks_client_name ? 1 : 0)
  );
}

function getSourceKey(c: CompanyRecord): SourceKey | null {
  if (c.hubspot_company_id) return 'hubspot';
  if (c.harvest_client_id) return 'harvest';
  if (c.freshdesk_company_id) return 'freshdesk';
  if (c.quickbooks_client_name) return 'quickbooks';
  return null;
}

function sourceLabel(c: CompanyRecord): string {
  return [
    c.hubspot_company_id ? 'HS' : null,
    c.harvest_client_id ? 'HV' : null,
    c.freshdesk_company_id ? 'FD' : null,
    c.quickbooks_client_name ? 'QB' : null,
  ].filter(Boolean).join('+');
}

function sourceBadge(has: boolean, label: string, color: string) {
  return has ? (
    <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${color}`}>{label}</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground/40 border-dashed">—</Badge>
  );
}

function confidenceLabel(score: number): { text: string; color: string } {
  if (score >= 0.95) return { text: 'High', color: 'text-green-600 border-green-500/30 bg-green-500/10' };
  if (score >= 0.85) return { text: 'Med', color: 'text-amber-500 border-amber-500/30 bg-amber-500/10' };
  return { text: 'Low', color: 'text-orange-500 border-orange-500/30 bg-orange-500/10' };
}

export default function Phase0Map({ companies, onComplete, onSkip, onRefetch }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').filter || 'has_suggestions'; } catch { return 'has_suggestions'; }
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').pageSize || 25; } catch { return 25; }
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [manualSearch, setManualSearch] = useState<Map<string, string>>(new Map());
  const [page, setPage] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Persist filter + pageSize to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ filter, pageSize }));
  }, [filter, pageSize]);

  // Compute suggestions
  const suggestions = useMemo(() => {
    const map = new Map<string, { source: SourceKey; candidates: { id: string; name: string; score: number; sourceLabel: string }[] }>();
    const singleSource = companies.filter(c => sourceCount(c) === 1);
    const multiSource = companies.filter(c => sourceCount(c) >= 2);

    for (const single of singleSource) {
      const normName = normalizeCompanyName(single.name);
      if (!normName) continue;
      const singleSourceKey = getSourceKey(single);
      if (!singleSourceKey) continue;

      const candidates: { id: string; name: string; score: number; sourceLabel: string }[] = [];

      for (const multi of multiSource) {
        if (singleSourceKey === 'hubspot' && multi.hubspot_company_id) continue;
        if (singleSourceKey === 'harvest' && multi.harvest_client_id) continue;
        if (singleSourceKey === 'freshdesk' && multi.freshdesk_company_id) continue;
        if (singleSourceKey === 'quickbooks' && multi.quickbooks_client_name) continue;

        const score = computeSimilarity(normName, normalizeCompanyName(multi.name));
        if (score >= 0.8) {
          candidates.push({ id: multi.id, name: multi.name, score, sourceLabel: sourceLabel(multi) });
        }
      }

      for (const other of singleSource) {
        if (other.id === single.id) continue;
        if (singleSourceKey === 'hubspot' && other.hubspot_company_id) continue;
        if (singleSourceKey === 'harvest' && other.harvest_client_id) continue;
        if (singleSourceKey === 'freshdesk' && other.freshdesk_company_id) continue;
        if (singleSourceKey === 'quickbooks' && other.quickbooks_client_name) continue;

        const score = computeSimilarity(normName, normalizeCompanyName(other.name));
        if (score >= 0.85) {
          candidates.push({ id: other.id, name: other.name, score, sourceLabel: sourceLabel(other) });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        map.set(single.id, { source: singleSourceKey, candidates: candidates.slice(0, 5) });
      }
    }
    return map;
  }, [companies]);

  // Manual search results for a company
  const getManualResults = (companyId: string): { id: string; name: string; score: number; sourceLabel: string }[] => {
    const q = manualSearch.get(companyId);
    if (!q || q.length < 2) return [];
    const qLower = q.toLowerCase();
    const company = companies.find(c => c.id === companyId);
    if (!company) return [];

    return companies
      .filter(c => c.id !== companyId && c.name.toLowerCase().includes(qLower))
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        name: c.name,
        score: computeSimilarity(normalizeCompanyName(company.name), normalizeCompanyName(c.name)),
        sourceLabel: sourceLabel(c),
      }));
  };

  // Filter and search
  const filtered = useMemo(() => {
    let result = [...companies];

    if (filter === 'has_suggestions') {
      result = result.filter(c => suggestions.has(c.id) && !dismissed.has(c.id));
    } else if (filter === 'needs_review') {
      result = result.filter(c => sourceCount(c) <= 1);
    } else if (filter === 'fully_mapped') {
      result = result.filter(c => sourceCount(c) >= 3);
    } else if (filter === 'single_source') {
      result = result.filter(c => sourceCount(c) === 1);
    } else if (filter === 'no_sources') {
      result = result.filter(c => sourceCount(c) === 0);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.harvest_client_name?.toLowerCase().includes(q) ||
        c.freshdesk_company_name?.toLowerCase().includes(q) ||
        c.quickbooks_client_name?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aHasSug = suggestions.has(a.id) && !dismissed.has(a.id) ? 1 : 0;
      const bHasSug = suggestions.has(b.id) && !dismissed.has(b.id) ? 1 : 0;
      if (aHasSug !== bHasSug) return bHasSug - aHasSug;
      const aCount = sourceCount(a);
      const bCount = sourceCount(b);
      if (aCount !== bCount) return aCount - bCount;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [companies, filter, search, suggestions, dismissed]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const stats = useMemo(() => ({
    total: companies.length,
    all4: companies.filter(c => sourceCount(c) === 4).length,
    atLeast3: companies.filter(c => sourceCount(c) >= 3).length,
    exactly2: companies.filter(c => sourceCount(c) === 2).length,
    exactly1: companies.filter(c => sourceCount(c) === 1).length,
    noSources: companies.filter(c => sourceCount(c) === 0).length,
    withSuggestions: suggestions.size,
  }), [companies, suggestions]);

  // Link action
  const linkCompany = async (sourceId: string, targetId: string, sourceKey: SourceKey) => {
    setSaving(sourceId);
    try {
      const sourceCompany = companies.find(c => c.id === sourceId);
      if (!sourceCompany) throw new Error('Source not found');

      const updates: any = {};
      if (sourceKey === 'hubspot') updates.hubspot_company_id = sourceCompany.hubspot_company_id;
      else if (sourceKey === 'harvest') {
        updates.harvest_client_id = sourceCompany.harvest_client_id;
        updates.harvest_client_name = sourceCompany.harvest_client_name;
      } else if (sourceKey === 'freshdesk') {
        updates.freshdesk_company_id = sourceCompany.freshdesk_company_id;
        updates.freshdesk_company_name = sourceCompany.freshdesk_company_name;
      } else if (sourceKey === 'quickbooks') {
        updates.quickbooks_client_name = sourceCompany.quickbooks_client_name;
        updates.quickbooks_invoice_summary = (sourceCompany as any).quickbooks_invoice_summary;
      }

      await supabase.from('companies').update(updates).eq('id', targetId);
      await supabase.from('companies').delete().eq('id', sourceId);
      toast.success(`Linked "${sourceCompany.name}" → target`);
      onRefetch();
    } catch (err: any) {
      toast.error(`Link failed: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Bulk delete
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        await supabase.from('companies').delete().eq('id', id);
      }
      toast.success(`Deleted ${ids.length} companies`);
      setSelected(new Set());
      onRefetch();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id));
  const togglePageSelect = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paged.forEach(c => next.delete(c.id));
      } else {
        paged.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Company Source Mapping</h2>
          <p className="text-sm text-muted-foreground">
            Link companies across HubSpot, Harvest, Freshdesk, and QuickBooks. Mappings are permanent.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>Skip</Button>
          <Button onClick={onComplete}>Done</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm mb-4 flex-wrap">
        <span className="text-muted-foreground">All 4: <span className="text-green-600 font-medium">{stats.all4}</span></span>
        <span className="text-muted-foreground">3+: <span className="text-blue-500 font-medium">{stats.atLeast3}</span></span>
        <span className="text-muted-foreground">2: <span className="text-amber-500 font-medium">{stats.exactly2}</span></span>
        <span className="text-muted-foreground">1: <span className="text-orange-500 font-medium">{stats.exactly1}</span></span>
        <span className="text-muted-foreground">None: <span className="text-red-500 font-medium">{stats.noSources}</span></span>
        <div className="h-4 w-px bg-border" />
        <span className="text-muted-foreground">Suggested: <span className="text-primary font-medium">{stats.withSuggestions}</span></span>
      </div>

      {/* Search + Filter + Page Size */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
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
            <SelectItem value="has_suggestions">Has Suggestions ({stats.withSuggestions})</SelectItem>
            <SelectItem value="needs_review">Needs Review ({stats.exactly1 + stats.noSources})</SelectItem>
            <SelectItem value="single_source">Single Source ({stats.exactly1})</SelectItem>
            <SelectItem value="no_sources">No Sources ({stats.noSources})</SelectItem>
            <SelectItem value="fully_mapped">Fully Mapped ({stats.atLeast3})</SelectItem>
            <SelectItem value="all">All ({stats.total})</SelectItem>
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
            Delete Selected
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border mb-4">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
            <TableRow>
              <TableHead className="text-xs w-8">
                <Checkbox checked={allPageSelected} onCheckedChange={togglePageSelect} />
              </TableHead>
              <TableHead className="text-xs w-[20%]">Company</TableHead>
              <TableHead className="text-xs text-center w-[8%]">HS</TableHead>
              <TableHead className="text-xs text-center w-[8%]">HV</TableHead>
              <TableHead className="text-xs text-center w-[8%]">FD</TableHead>
              <TableHead className="text-xs text-center w-[8%]">QB</TableHead>
              <TableHead className="text-xs w-[6%] text-center">#</TableHead>
              <TableHead className="text-xs w-[34%]">Link To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map(c => {
              const count = sourceCount(c);
              const suggestion = !dismissed.has(c.id) ? suggestions.get(c.id) : undefined;
              const sKey = getSourceKey(c);
              const manualQ = manualSearch.get(c.id) || '';
              const manualResults = manualQ.length >= 2 ? getManualResults(c.id) : [];

              return (
                <TableRow key={c.id} className={selected.has(c.id) ? 'bg-primary/5' : count === 0 ? 'bg-red-500/5' : count === 1 && suggestion ? 'bg-amber-500/5' : ''}>
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
                    <div className="text-sm font-medium truncate max-w-[220px]">{c.name}</div>
                    {c.domain && <div className="text-[11px] text-muted-foreground">{c.domain}</div>}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    {sourceBadge(!!c.hubspot_company_id, 'HS', 'text-orange-600 border-orange-600/30')}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    {sourceBadge(!!c.harvest_client_id, 'HV', 'text-orange-500 border-orange-500/30')}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    {sourceBadge(!!c.freshdesk_company_id, 'FD', 'text-green-600 border-green-600/30')}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    {sourceBadge(!!c.quickbooks_client_name, 'QB', 'text-emerald-600 border-emerald-600/30')}
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <Badge variant="outline" className={`text-[10px] py-0 ${
                      count >= 3 ? 'text-green-600 border-green-500/30' :
                      count === 2 ? 'text-blue-500 border-blue-500/30' :
                      count === 1 ? 'text-amber-500 border-amber-500/30' :
                      'text-red-500 border-red-500/30'
                    }`}>
                      {count}/4
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    {/* Auto-suggestion with confidence */}
                    {suggestion && suggestion.candidates.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Select
                          defaultValue={suggestion.candidates[0]?.id}
                          onValueChange={(targetId) => {
                            setManualSearch(prev => { const n = new Map(prev); n.delete(c.id); return n; });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {suggestion.candidates.map(cand => {
                              const conf = confidenceLabel(cand.score);
                              return (
                                <SelectItem key={cand.id} value={cand.id}>
                                  <span className="truncate">{cand.name}</span>
                                  <Badge variant="outline" className={`ml-1.5 text-[9px] py-0 px-1 ${conf.color}`}>{conf.text}</Badge>
                                  <span className="text-muted-foreground ml-1 text-[10px]">({cand.sourceLabel})</span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
                          disabled={saving === c.id}
                          onClick={() => {
                            const targetId = suggestion.candidates[0]?.id;
                            if (targetId && sKey) linkCompany(c.id, targetId, sKey);
                          }}
                        >
                          {saving === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                          Link
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Dismiss suggestion"
                          onClick={() => setDismissed(prev => new Set(prev).add(c.id))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : count >= 3 ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Well mapped
                      </span>
                    ) : count <= 1 ? (
                      /* Manual search for single/no source companies */
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <Input
                            placeholder="Search to link..."
                            value={manualQ}
                            onChange={e => setManualSearch(prev => new Map(prev).set(c.id, e.target.value))}
                            className="h-7 text-xs pr-2"
                          />
                          {manualResults.length > 0 && (
                            <div className="absolute z-50 top-8 left-0 right-0 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {manualResults.map(r => {
                                const conf = confidenceLabel(r.score);
                                return (
                                  <button
                                    key={r.id}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
                                    onClick={() => {
                                      if (sKey) {
                                        linkCompany(c.id, r.id, sKey);
                                      } else {
                                        // No source key — just merge by deleting this empty company
                                        // (no source ID to transfer)
                                        toast.info('No source ID to transfer. Consider deleting this company instead.');
                                      }
                                      setManualSearch(prev => { const n = new Map(prev); n.delete(c.id); return n; });
                                    }}
                                  >
                                    <span className="truncate">{r.name}</span>
                                    <Badge variant="outline" className={`text-[9px] py-0 px-1 shrink-0 ${conf.color}`}>{Math.round(r.score * 100)}%</Badge>
                                    <span className="text-muted-foreground text-[10px] shrink-0">({r.sourceLabel || 'none'})</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
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
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(0)}>
            First
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Prev
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {page + 1} / {totalPages || 1}
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
            Last
          </Button>
        </div>
      </div>
    </Card>
  );
}
