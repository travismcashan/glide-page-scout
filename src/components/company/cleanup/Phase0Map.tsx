import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Search, Link2, Loader2, Filter } from 'lucide-react';
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

function sourceCount(c: CompanyRecord): number {
  return (
    (c.hubspot_company_id ? 1 : 0) +
    (c.harvest_client_id ? 1 : 0) +
    (c.freshdesk_company_id ? 1 : 0) +
    (c.quickbooks_client_name ? 1 : 0)
  );
}

function sourceBadge(has: boolean, label: string, color: string) {
  return has ? (
    <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${color}`}>{label}</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground/40 border-dashed">—</Badge>
  );
}

type FilterMode = 'all' | 'needs_review' | 'fully_mapped' | 'single_source' | 'no_sources';

export default function Phase0Map({ companies, onComplete, onSkip, onRefetch }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('needs_review');
  const [saving, setSaving] = useState<string | null>(null);
  const [pendingLinks, setPendingLinks] = useState<Map<string, { source: SourceKey; targetId: string }>>(new Map());
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  // Compute suggestions: for each single-source company, find potential matches in other companies
  const suggestions = useMemo(() => {
    const map = new Map<string, { source: SourceKey; candidates: { id: string; name: string; score: number; sourceLabel: string }[] }>();

    // Build lookup of companies with only 1 source
    const singleSource = companies.filter(c => sourceCount(c) === 1);
    const multiSource = companies.filter(c => sourceCount(c) >= 2);

    for (const single of singleSource) {
      const normName = normalizeCompanyName(single.name);
      if (!normName) continue;

      // Determine which source this single company has
      let singleSourceKey: SourceKey | null = null;
      if (single.hubspot_company_id) singleSourceKey = 'hubspot';
      else if (single.harvest_client_id) singleSourceKey = 'harvest';
      else if (single.freshdesk_company_id) singleSourceKey = 'freshdesk';
      else if (single.quickbooks_client_name) singleSourceKey = 'quickbooks';
      if (!singleSourceKey) continue;

      const candidates: { id: string; name: string; score: number; sourceLabel: string }[] = [];

      // Check against multi-source companies that DON'T have this source
      for (const multi of multiSource) {
        // Skip if the multi already has this source
        if (singleSourceKey === 'hubspot' && multi.hubspot_company_id) continue;
        if (singleSourceKey === 'harvest' && multi.harvest_client_id) continue;
        if (singleSourceKey === 'freshdesk' && multi.freshdesk_company_id) continue;
        if (singleSourceKey === 'quickbooks' && multi.quickbooks_client_name) continue;

        const score = computeSimilarity(normName, normalizeCompanyName(multi.name));
        if (score >= 0.8) {
          const sources = [
            multi.hubspot_company_id ? 'HS' : null,
            multi.harvest_client_id ? 'HV' : null,
            multi.freshdesk_company_id ? 'FD' : null,
            multi.quickbooks_client_name ? 'QB' : null,
          ].filter(Boolean).join('+');
          candidates.push({ id: multi.id, name: multi.name, score, sourceLabel: sources });
        }
      }

      // Also check other single-source companies (potential merges)
      for (const other of singleSource) {
        if (other.id === single.id) continue;
        // Skip if same source type
        if (singleSourceKey === 'hubspot' && other.hubspot_company_id) continue;
        if (singleSourceKey === 'harvest' && other.harvest_client_id) continue;
        if (singleSourceKey === 'freshdesk' && other.freshdesk_company_id) continue;
        if (singleSourceKey === 'quickbooks' && other.quickbooks_client_name) continue;

        const score = computeSimilarity(normName, normalizeCompanyName(other.name));
        if (score >= 0.85) {
          let otherSource = '';
          if (other.hubspot_company_id) otherSource = 'HS';
          else if (other.harvest_client_id) otherSource = 'HV';
          else if (other.freshdesk_company_id) otherSource = 'FD';
          else if (other.quickbooks_client_name) otherSource = 'QB';
          candidates.push({ id: other.id, name: other.name, score, sourceLabel: otherSource });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        map.set(single.id, { source: singleSourceKey, candidates: candidates.slice(0, 3) });
      }
    }

    return map;
  }, [companies]);

  // Filter and search
  const filtered = useMemo(() => {
    let result = [...companies];

    // Apply filter
    if (filter === 'needs_review') {
      result = result.filter(c => sourceCount(c) <= 1 || suggestions.has(c.id));
    } else if (filter === 'fully_mapped') {
      result = result.filter(c => sourceCount(c) >= 3);
    } else if (filter === 'single_source') {
      result = result.filter(c => sourceCount(c) === 1);
    } else if (filter === 'no_sources') {
      result = result.filter(c => sourceCount(c) === 0);
    }

    // Apply search
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

    // Sort: needs review first (1 source), then by name
    result.sort((a, b) => {
      const aCount = sourceCount(a);
      const bCount = sourceCount(b);
      if (aCount !== bCount) return aCount - bCount;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [companies, filter, search, suggestions]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Stats
  const stats = useMemo(() => ({
    total: companies.length,
    all4: companies.filter(c => sourceCount(c) === 4).length,
    atLeast3: companies.filter(c => sourceCount(c) >= 3).length,
    exactly2: companies.filter(c => sourceCount(c) === 2).length,
    exactly1: companies.filter(c => sourceCount(c) === 1).length,
    noSources: companies.filter(c => sourceCount(c) === 0).length,
    withSuggestions: suggestions.size,
  }), [companies, suggestions]);

  // Link a single-source company's data into a target company
  const linkCompany = async (sourceId: string, targetId: string, sourceKey: SourceKey) => {
    setSaving(sourceId);
    try {
      const sourceCompany = companies.find(c => c.id === sourceId);
      if (!sourceCompany) throw new Error('Source company not found');

      // Copy the source's integration ID to the target
      const updates: any = {};
      if (sourceKey === 'hubspot') {
        updates.hubspot_company_id = sourceCompany.hubspot_company_id;
      } else if (sourceKey === 'harvest') {
        updates.harvest_client_id = sourceCompany.harvest_client_id;
        updates.harvest_client_name = sourceCompany.harvest_client_name;
      } else if (sourceKey === 'freshdesk') {
        updates.freshdesk_company_id = sourceCompany.freshdesk_company_id;
        updates.freshdesk_company_name = sourceCompany.freshdesk_company_name;
      } else if (sourceKey === 'quickbooks') {
        updates.quickbooks_client_name = sourceCompany.quickbooks_client_name;
        updates.quickbooks_invoice_summary = (sourceCompany as any).quickbooks_invoice_summary;
      }

      // Update target with source's ID
      const { error: updateErr } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', targetId);
      if (updateErr) throw updateErr;

      // Delete the now-redundant source company
      const { error: deleteErr } = await supabase
        .from('companies')
        .delete()
        .eq('id', sourceId);
      if (deleteErr) throw deleteErr;

      toast.success(`Linked ${sourceCompany.name} → target company`);
      onRefetch();
    } catch (err: any) {
      toast.error(`Link failed: ${err.message}`);
    } finally {
      setSaving(null);
    }
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
        <span className="text-muted-foreground">
          All 4: <span className="text-green-600 font-medium">{stats.all4}</span>
        </span>
        <span className="text-muted-foreground">
          3+: <span className="text-blue-500 font-medium">{stats.atLeast3}</span>
        </span>
        <span className="text-muted-foreground">
          2: <span className="text-amber-500 font-medium">{stats.exactly2}</span>
        </span>
        <span className="text-muted-foreground">
          1: <span className="text-orange-500 font-medium">{stats.exactly1}</span>
        </span>
        <span className="text-muted-foreground">
          None: <span className="text-red-500 font-medium">{stats.noSources}</span>
        </span>
        <div className="h-4 w-px bg-border" />
        <span className="text-muted-foreground">
          Suggested links: <span className="text-primary font-medium">{stats.withSuggestions}</span>
        </span>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filter} onValueChange={(v: FilterMode) => { setFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48 h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({stats.total})</SelectItem>
            <SelectItem value="needs_review">Needs Review ({stats.exactly1 + stats.noSources})</SelectItem>
            <SelectItem value="fully_mapped">Fully Mapped ({stats.atLeast3})</SelectItem>
            <SelectItem value="single_source">Single Source ({stats.exactly1})</SelectItem>
            <SelectItem value="no_sources">No Sources ({stats.noSources})</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} companies
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[22%]">Company</TableHead>
              <TableHead className="text-xs text-center w-[10%]">HubSpot</TableHead>
              <TableHead className="text-xs text-center w-[10%]">Harvest</TableHead>
              <TableHead className="text-xs text-center w-[10%]">Freshdesk</TableHead>
              <TableHead className="text-xs text-center w-[10%]">QuickBooks</TableHead>
              <TableHead className="text-xs w-[8%] text-center">Sources</TableHead>
              <TableHead className="text-xs w-[30%]">Suggested Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map(c => {
              const count = sourceCount(c);
              const suggestion = suggestions.get(c.id);

              return (
                <TableRow key={c.id} className={count === 0 ? 'bg-red-500/5' : count === 1 ? 'bg-amber-500/5' : ''}>
                  <TableCell className="py-2">
                    <div className="text-sm font-medium truncate max-w-[240px]">{c.name}</div>
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
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 ${
                        count >= 3 ? 'text-green-600 border-green-500/30' :
                        count === 2 ? 'text-blue-500 border-blue-500/30' :
                        count === 1 ? 'text-amber-500 border-amber-500/30' :
                        'text-red-500 border-red-500/30'
                      }`}
                    >
                      {count}/4
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    {suggestion ? (
                      <div className="flex items-center gap-2">
                        <Select
                          defaultValue={suggestion.candidates[0]?.id}
                          onValueChange={(targetId) => {
                            setPendingLinks(prev => {
                              const next = new Map(prev);
                              next.set(c.id, { source: suggestion.source, targetId });
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {suggestion.candidates.map(cand => (
                              <SelectItem key={cand.id} value={cand.id}>
                                <span className="truncate">{cand.name}</span>
                                <span className="text-muted-foreground ml-1">({cand.sourceLabel}) {Math.round(cand.score * 100)}%</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 shrink-0"
                          disabled={saving === c.id}
                          onClick={() => {
                            const pending = pendingLinks.get(c.id);
                            const targetId = pending?.targetId || suggestion.candidates[0]?.id;
                            if (targetId) linkCompany(c.id, targetId, suggestion.source);
                          }}
                        >
                          {saving === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                          Link
                        </Button>
                      </div>
                    ) : count >= 3 ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Well mapped
                      </span>
                    ) : count >= 2 ? (
                      <span className="text-xs text-muted-foreground">No close matches found</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
