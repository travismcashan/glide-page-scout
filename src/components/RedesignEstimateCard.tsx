import { useMemo, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, Sparkles } from 'lucide-react';
import { CardTabs } from '@/components/CardTabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PageTagsMap } from '@/lib/pageTags';
import { normalizeTagKey, getTemplateCategory } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

const TIER_KEYS = ['S', 'M', 'L', 'All'] as const;
type TierKey = (typeof TIER_KEYS)[number];

const baseTypeColors: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

const baseTypePriority: Record<string, number> = {
  Page: 0, Archive: 1, CPT: 2, Post: 3, Search: 4,
};

interface NavItem {
  label: string;
  url?: string | null;
  children?: NavItem[];
}

interface Props {
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
  navStructure: { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[] } | null;
  domain?: string;
}

function collectNavUrls(items: NavItem[] | undefined): Set<string> {
  const urls = new Set<string>();
  if (!items) return urls;
  for (const item of items) {
    if (item.url) urls.add(normalizeTagKey(item.url));
    if (item.children) {
      for (const u of collectNavUrls(item.children)) urls.add(u);
    }
  }
  return urls;
}

function TableSection({ title, columns, colAligns, rows }: {
  title: string;
  columns: string[];
  colAligns?: ('left' | 'center' | 'right')[];
  rows: { cells: React.ReactNode[] }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-muted/50 text-left">
              {columns.map((col, i) => {
                const align = colAligns?.[i] || (i > 0 ? 'right' : 'left');
                return (
                  <th key={col} className={`px-3 py-2 font-medium text-muted-foreground ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>{col}</th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                {row.cells.map((cell, j) => {
                  const align = colAligns?.[j] || (j > 0 ? 'right' : 'left');
                  return (
                    <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>{cell}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface AiTiers {
  S: string[];
  M: string[];
  L: string[];
  reasoning: string;
}

export function RedesignEstimateCard({ pageTags, contentTypesData, navStructure, domain }: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [activeTier, setActiveTier] = useState<TierKey | null>(null);
  const [aiTiers, setAiTiers] = useState<AiTiers | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { baseTypeCounts, templates, contentTypes, totalTemplates } = useMemo(() => {
    const counts: Record<string, number> = { Page: 0, Post: 0, CPT: 0, Archive: 0, Search: 0 };
    const templateMap: Record<string, { count: number; baseType?: string; urls: string[] }> = {};

    if (pageTags) {
      for (const [url, tag] of Object.entries(pageTags)) {
        const bt = tag.baseType || 'Page';
        counts[bt] = (counts[bt] || 0) + 1;
        const tmpl = tag.template || 'Unknown';
        if (!templateMap[tmpl]) {
          templateMap[tmpl] = { count: 0, baseType: bt, urls: [] };
        }
        templateMap[tmpl].count++;
        templateMap[tmpl].urls.push(url);
      }
    }

    const primaryNavUrls = collectNavUrls(navStructure?.primary);
    const secondaryNavUrls = collectNavUrls(navStructure?.secondary);
    const footerNavUrls = collectNavUrls(navStructure?.footer);

    const getNavSection = (urls: string[]): 'Primary' | 'Secondary' | 'Footer' | null => {
      for (const u of urls) { if (primaryNavUrls.has(normalizeTagKey(u))) return 'Primary'; }
      for (const u of urls) { if (secondaryNavUrls.has(normalizeTagKey(u))) return 'Secondary'; }
      for (const u of urls) { if (footerNavUrls.has(normalizeTagKey(u))) return 'Footer'; }
      return null;
    };

    const navPriority: Record<string, number> = { Primary: 0, Secondary: 1, Footer: 2 };

    const sortedTemplates = Object.entries(templateMap)
      .map(([name, data]) => ({
        name,
        ...data,
        navSection: getNavSection(data.urls),
      }))
      .sort((a, b) => {
        if (a.name === 'Homepage') return -1;
        if (b.name === 'Homepage') return 1;
        const pa = baseTypePriority[a.baseType || 'Page'] ?? 5;
        const pb = baseTypePriority[b.baseType || 'Page'] ?? 5;
        if (pa !== pb) return pa - pb;
        const na = a.navSection ? navPriority[a.navSection] ?? 3 : 4;
        const nb = b.navSection ? navPriority[b.navSection] ?? 3 : 4;
        if (na !== nb) return na - nb;
        return b.count - a.count;
      });

    const ctList: { type: string; count: number; baseType?: string }[] = [];
    if (contentTypesData?.summary) {
      for (const s of contentTypesData.summary) {
        if (s.baseType === 'Post' || s.baseType === 'CPT') {
          ctList.push({ type: s.type, count: s.count, baseType: s.baseType });
        }
      }
    }

    return {
      baseTypeCounts: Object.entries(counts).filter(([, c]) => c > 0),
      templates: sortedTemplates,
      contentTypes: ctList,
      totalTemplates: sortedTemplates.length,
    };
  }, [pageTags, contentTypesData, navStructure]);

  // Auto-seed excluded set from toolkit templates on first data load
  if (!seeded && templates.length > 0) {
    const toolkitNames = new Set(
      templates.filter(t => getTemplateCategory(t.name) === 'toolkit').map(t => t.name)
    );
    if (toolkitNames.size > 0) setExcluded(toolkitNames);
    setSeeded(true);
  }

  const fetchAiRecommendations = useCallback(async () => {
    if (aiTiers || aiLoading || templates.length === 0) return;
    setAiLoading(true);
    try {
      const payload = {
        domain: domain || 'unknown',
        templates: templates.map(t => ({
          name: t.name,
          baseType: t.baseType || 'Page',
          urlCount: t.count,
          navSection: t.navSection,
        })),
      };

      const { data, error } = await supabase.functions.invoke('recommend-templates', { body: payload });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'AI analysis failed');

      const tiers = data.tiers as AiTiers;
      setAiTiers(tiers);
      toast.success('AI recommendations ready');
    } catch (err) {
      console.error('AI recommend error:', err);
      toast.error('Failed to get AI recommendations');
    } finally {
      setAiLoading(false);
    }
  }, [aiTiers, aiLoading, templates, domain]);

  const toggleExcluded = (name: string) => {
    setActiveTier(null);
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const applyTier = (tier: TierKey) => {
    if (activeTier === tier) {
      setActiveTier(null);
      return;
    }
    setActiveTier(tier);

    if (tier === 'All') {
      setExcluded(new Set());
      return;
    }

    // If we have AI tiers, use them
    if (aiTiers) {
      const included = new Set(aiTiers[tier as 'S' | 'M' | 'L']);
      const newExcluded = new Set<string>();
      for (const t of templates) {
        if (!included.has(t.name)) newExcluded.add(t.name);
      }
      setExcluded(newExcluded);
      return;
    }

    // Fallback: fetch AI recommendations first
    fetchAiRecommendations();
  };

  // When AI tiers arrive and a tier is active, apply it
  const applyPendingTier = useCallback(() => {
    if (aiTiers && activeTier && activeTier !== 'All') {
      const included = new Set(aiTiers[activeTier as 'S' | 'M' | 'L']);
      const newExcluded = new Set<string>();
      for (const t of templates) {
        if (!included.has(t.name)) newExcluded.add(t.name);
      }
      setExcluded(newExcluded);
    }
  }, [aiTiers, activeTier, templates]);

  // Apply pending tier when aiTiers arrives
  useMemo(() => {
    applyPendingTier();
  }, [applyPendingTier]);

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet. Run URL Discovery and Content Types first.</p>;
  }

  const totalPages = Object.keys(pageTags).length;
  const designCount = templates.filter(t => !excluded.has(t.name)).length;
  const blockBuiltCount = totalTemplates - designCount;

  const tierLabel = (tier: TierKey) => {
    if (tier === 'All') return 'All';
    if (aiTiers) return `${tier} (${aiTiers[tier as 'S' | 'M' | 'L'].length})`;
    return tier === 'S' ? 'S (~5)' : tier === 'M' ? 'M (~10)' : 'L (~15)';
  };

  const level1Content = (
    <TableSection
      title=""
      columns={['Type', 'In Nav', 'URLs']}
      colAligns={['left', 'center', 'right']}
      rows={baseTypeCounts.map(([type, count]) => ({
        cells: [type, '', count],
      }))}
    />
  );

  const level2Content = (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {aiLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {!aiTiers && !aiLoading && (
          <button
            onClick={fetchAiRecommendations}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            AI Recommend
          </button>
        )}
        {aiTiers && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            AI
          </span>
        )}
        <ToggleGroup type="single" value={activeTier ?? ''} onValueChange={(v) => v && applyTier(v as TierKey)} size="sm" variant="outline">
          {TIER_KEYS.map(tier => (
            <ToggleGroupItem key={tier} value={tier} className="text-xs px-2.5 h-7" disabled={aiLoading && tier !== 'All'}>
              {tierLabel(tier)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {aiTiers?.reasoning && activeTier && activeTier !== 'All' && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
          {aiTiers.reasoning}
        </p>
      )}

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium text-muted-foreground w-10 text-center">Design</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-left">Template</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-center">Type</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-center">Nav</th>
              <th className="px-3 py-2 font-medium text-muted-foreground text-right">URLs</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t, i) => {
              const isExcluded = excluded.has(t.name);
              return (
                <tr key={i} className={`border-t border-border transition-colors ${isExcluded ? 'opacity-50' : 'hover:bg-muted/30'}`}>
                  <td className="px-3 py-1.5 text-center">
                    <Checkbox
                      checked={!isExcluded}
                      onCheckedChange={() => toggleExcluded(t.name)}
                      className="mx-auto"
                    />
                  </td>
                  <td className={`px-3 py-1.5 font-medium text-foreground ${isExcluded ? 'line-through' : ''}`}>{t.name}</td>
                  <td className="px-3 py-1.5 text-center text-muted-foreground">
                    {t.baseType ? <Badge variant="outline" className={`${baseTypeColors[t.baseType] || ''} text-[10px] px-1.5 py-0`}>{t.baseType}</Badge> : null}
                  </td>
                  <td className="px-3 py-1.5 text-center text-muted-foreground">
                    {t.navSection ? <span className="text-xs">{t.navSection}</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{t.count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const level3Content = contentTypes.length > 0 ? (
    <TableSection
      title=""
      columns={['Content Type', 'Type', 'In Nav', 'URLs']}
      colAligns={['left', 'center', 'center', 'right']}
      rows={contentTypes.map((ct) => ({
        cells: [
          ct.type,
          ct.baseType ? <Badge variant="outline" className={`${baseTypeColors[ct.baseType] || ''} text-[10px] px-1.5 py-0`}>{ct.baseType}</Badge> : null,
          '',
          ct.count,
        ],
      }))}
    />
  ) : (
    <p className="text-sm text-muted-foreground">No repeating content types detected.</p>
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold text-foreground">{totalTemplates}</span>
        <span className="text-sm text-muted-foreground">unique templates</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-2xl font-bold text-foreground">{designCount}</span>
        <span className="text-sm text-muted-foreground">custom design</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-lg font-semibold text-muted-foreground">{blockBuiltCount}</span>
        <span className="text-sm text-muted-foreground">block-built</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-2xl font-bold text-foreground">{totalPages}</span>
        <span className="text-sm text-muted-foreground">URLs</span>
      </div>

      <CardTabs
        defaultValue="templates"
        tabs={[
          { value: 'types', label: `Base Types (${baseTypeCounts.length})`, content: level1Content },
          { value: 'templates', label: `Templates (${totalTemplates})`, content: level2Content },
          { value: 'repeating', label: `Repeating Content (${contentTypes.length})`, content: level3Content },
        ]}
      />
    </div>
  );
}
