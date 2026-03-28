import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, Sparkles, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PageTagsMap } from '@/lib/pageTags';
import { normalizeTagKey, getTemplateCategory } from '@/lib/pageTags';
import ReactMarkdown from 'react-markdown';

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
  navStructure: { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[] } | null;
  domain?: string;
  savedTiers?: AiTiers | null;
  onTiersChange?: (tiers: AiTiers) => void;
  onRerunRequest?: (rerunFn: () => void) => void;
  isRerunning?: boolean;
  mode?: 'analysis' | 'estimate';
  onSelectionChange?: (includedCount: number) => void;
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

interface AiTiers {
  S: string[];
  M: string[];
  L: string[];
  reasoning: string;
  reasoning_S?: string;
  reasoning_M?: string;
  reasoning_L?: string;
}

function TemplateRow({ t, isExcluded, toggleExcluded, isManuallyAdded, showCheckbox = true }: { t: { name: string; count: number; baseType?: string; navSection: string | null }; isExcluded: boolean; toggleExcluded: (name: string) => void; isManuallyAdded?: boolean; showCheckbox?: boolean }) {
  return (
    <tr className={`border-t border-border/50 transition-colors ${isExcluded ? 'opacity-50' : 'hover:bg-muted/20'}`}>
      <td className="px-3 py-1 text-center align-middle">
        {showCheckbox ? (
          <Checkbox checked={!isExcluded} onCheckedChange={() => toggleExcluded(t.name)} className="mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">{t.count}</span>
        )}
      </td>
      <td className={`px-3 py-1 text-xs font-mono leading-5 text-foreground ${isExcluded ? 'line-through' : ''}`}>
        {t.name}
        {isManuallyAdded && <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20">added</Badge>}
      </td>
      <td className="px-3 py-1 text-center">
        {t.baseType ? <Badge variant="outline" className={`${baseTypeColors[t.baseType] || ''} text-[10px] px-1.5 py-0`}>{t.baseType}</Badge> : null}
      </td>
      <td className="px-3 py-1 text-center text-muted-foreground">
        {t.navSection ? <span className="text-xs">{t.navSection}</span> : null}
      </td>
      <td className="px-3 py-1 text-right text-xs text-muted-foreground">{t.count}</td>
    </tr>
  );
}

const LOADING_MESSAGES = [
  'Dispatching design pigeons…',
  'Garden gnomes are analyzing layouts…',
  'Measuring whitespace with tiny rulers…',
  'Consulting the font gods…',
  'Debating hero section strategies…',
  'Sorting templates by vibes…',
  'Pixel-peeping every page…',
  'Asking the AI which pages spark joy…',
  'Running templates through the taste machine…',
  'Counting unique layouts with abacuses…',
];

export function TemplatesCard({ pageTags, navStructure, domain, savedTiers, onTiersChange, onRerunRequest, mode = 'analysis', onSelectionChange }: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [activeTier, setActiveTier] = useState<TierKey | null>(null);
  const [aiTiers, setAiTiers] = useState<AiTiers | null>(savedTiers || null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [collapsedTableSections, setCollapsedTableSections] = useState<Set<string>>(new Set(['not-included']));
  const [expandedTableSections, setExpandedTableSections] = useState<Set<string>>(new Set());
  const autoRunRef = useRef(false);

  // Expose rerun function to parent
  useEffect(() => {
    if (onRerunRequest) {
      onRerunRequest(() => {
        setAiTiers(null);
        setAutoSelected(false);
        setActiveTier(null);
        autoRunRef.current = false;
      });
    }
  }, [onRerunRequest]);

  // Rotate loading messages
  useEffect(() => {
    if (aiLoading) {
      let idx = Math.floor(Math.random() * LOADING_MESSAGES.length);
      setLoadingMsg(LOADING_MESSAGES[idx]);
      loadingInterval.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[idx]);
      }, 3000);
    } else if (loadingInterval.current) {
      clearInterval(loadingInterval.current);
      loadingInterval.current = null;
    }
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current); };
  }, [aiLoading]);


  const { templates, totalTemplates } = useMemo(() => {
    const templateMap: Record<string, { count: number; baseType?: string; urls: string[] }> = {};

    if (pageTags) {
      for (const [url, tag] of Object.entries(pageTags)) {
        const bt = tag.baseType || 'Page';
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

    return {
      templates: sortedTemplates,
      totalTemplates: sortedTemplates.length,
    };
  }, [pageTags, navStructure]);

  // Auto-seed excluded set from toolkit templates
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
      onTiersChange?.(tiers);
      toast.success('AI recommendations ready');
    } catch (err) {
      console.error('AI recommend error:', err);
      toast.error('Failed to get AI recommendations');
    } finally {
      setAiLoading(false);
    }
  }, [aiTiers, aiLoading, templates, domain]);

  // Auto-run AI recommendations when templates are available and no saved tiers exist
  useEffect(() => {
    if (mode === 'estimate' && !autoRunRef.current && !aiTiers && !aiLoading && templates.length > 0) {
      autoRunRef.current = true;
      fetchAiRecommendations();
    }
  }, [templates, aiTiers, aiLoading, fetchAiRecommendations, mode]);

  const toggleExcluded = (name: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const applyTier = (tier: TierKey) => {
    if (activeTier === tier) { setActiveTier(null); return; }
    setActiveTier(tier);
    if (tier === 'All') { setExcluded(new Set()); return; }
    if (aiTiers) {
      const included = new Set(aiTiers[tier as 'S' | 'M' | 'L']);
      const newExcluded = new Set<string>();
      for (const t of templates) { if (!included.has(t.name)) newExcluded.add(t.name); }
      setExcluded(newExcluded);
      return;
    }
    fetchAiRecommendations();
  };

  const applyPendingTier = useCallback(() => {
    if (aiTiers && activeTier && activeTier !== 'All') {
      const included = new Set(aiTiers[activeTier as 'S' | 'M' | 'L']);
      const newExcluded = new Set<string>();
      for (const t of templates) { if (!included.has(t.name)) newExcluded.add(t.name); }
      setExcluded(newExcluded);
    }
  }, [aiTiers, activeTier, templates]);

  useMemo(() => { applyPendingTier(); }, [applyPendingTier]);

  // Auto-select the best tier based on template count
  useEffect(() => {
    if (aiTiers && !autoSelected && !activeTier) {
      const designTemplates = templates.filter(t => getTemplateCategory(t.name) !== 'toolkit');
      const count = designTemplates.length;
      let bestTier: 'S' | 'M' | 'L';
      if (count <= 8) bestTier = 'S';
      else if (count <= 18) bestTier = 'M';
      else bestTier = 'L';
      setAutoSelected(true);
      applyTier(bestTier);
    }
  }, [aiTiers, autoSelected, activeTier, templates]);

  const designCount = templates.filter(t => !excluded.has(t.name)).length;
  const blockBuiltCount = totalTemplates - designCount;

  // Notify parent whenever the included count changes
  useEffect(() => {
    if (mode === 'estimate' && onSelectionChange) {
      onSelectionChange(designCount);
    }
  }, [designCount, mode, onSelectionChange]);

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet.</p>;
  }

  const isEstimate = mode === 'estimate';

  const hasTierSelection = isEstimate && activeTier && activeTier !== 'All' && aiTiers;
  const aiIncludedSet = hasTierSelection ? new Set(aiTiers[activeTier as 'S' | 'M' | 'L']) : new Set<string>();
  const toggleTableSection = (key: string) => {
    setCollapsedTableSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const recommendedTemplates = hasTierSelection ? templates.filter(t => !excluded.has(t.name)) : [];
  const notIncludedTemplates = hasTierSelection ? templates.filter(t => excluded.has(t.name)) : [];

  const tierLabel = (tier: TierKey) => {
    if (tier === 'All') return 'All';
    const labels = { S: 'Small', M: 'Medium', L: 'Large' };
    const label = labels[tier as 'S' | 'M' | 'L'];
    const count = aiTiers ? aiTiers[tier as 'S' | 'M' | 'L'].length : '…';
    return `${label} · ${count} layouts`;
  };

  return (
    <div className="space-y-4">
      {/* Summary + Controls on same row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <MetaStat value={totalTemplates} label="Detected Templates" />
          <MetaStatDivider />
          <MetaStat value={designCount} label="Selected Templates" />
        </div>
        {isEstimate && (
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={activeTier ?? ''} onValueChange={(v) => v && applyTier(v as TierKey)} size="sm" variant="outline">
              {TIER_KEYS.filter(tier => tier !== 'All').map(tier => (
                <ToggleGroupItem key={tier} value={tier} className="text-xs px-2.5 h-7" disabled={aiLoading}>
                  {tierLabel(tier)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* AI Loading indicator */}
      {isEstimate && aiLoading && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-border animate-in fade-in">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span className="text-xs text-muted-foreground">{loadingMsg}</span>
        </div>
      )}

      {/* Templates table — sectioned when a tier is active */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-left">
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground w-10 text-center">{isEstimate ? 'Design' : '#'}</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-left">Template</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-center">Type</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-center">Nav</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-right">URLs</th>
            </tr>
          </thead>
          <tbody>
            {hasTierSelection ? (
              <>
                {/* Recommended section */}
                <tr>
                  <td colSpan={5} className="p-0">
                    <button
                      onClick={() => toggleTableSection('recommended')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                    >
                      {collapsedTableSections.has('recommended')
                        ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      }
                      <span className="text-xs font-semibold text-foreground">Recommended Layouts</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{recommendedTemplates.length}</Badge>
                    </button>
                  </td>
                </tr>
                {!collapsedTableSections.has('recommended') && (() => {
                  const LIMIT = 5;
                  const isExpanded = expandedTableSections.has('recommended');
                  const hasMore = recommendedTemplates.length > LIMIT;
                  const visible = isExpanded ? recommendedTemplates : recommendedTemplates.slice(0, LIMIT);
                  return (
                    <>
                      {visible.map((t, i) => (
                        <TemplateRow key={`rec-${i}`} t={t} isExcluded={false} toggleExcluded={toggleExcluded} isManuallyAdded={!aiIncludedSet.has(t.name)} />
                      ))}
                      {hasMore && (
                        <tr>
                          <td colSpan={5} className="p-0 relative">
                            {!isExpanded && (
                              <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                            )}
                            <button
                              onClick={() => setExpandedTableSections(prev => {
                                const next = new Set(prev);
                                if (next.has('recommended')) next.delete('recommended'); else next.add('recommended');
                                return next;
                              })}
                              className="w-full flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronsUpDown className="h-3 w-3" />
                              {isExpanded ? 'Show less' : `Show all ${recommendedTemplates.length}`}
                            </button>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}

                {/* Not included section */}
                <tr>
                  <td colSpan={5} className="p-0">
                    <button
                      onClick={() => toggleTableSection('not-included')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
                    >
                      {collapsedTableSections.has('not-included')
                        ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      }
                      <span className="text-xs font-semibold text-foreground">Layouts Not Included</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{notIncludedTemplates.length}</Badge>
                    </button>
                  </td>
                </tr>
                {!collapsedTableSections.has('not-included') && (() => {
                  const LIMIT = 5;
                  const isExpanded = expandedTableSections.has('not-included');
                  const hasMore = notIncludedTemplates.length > LIMIT;
                  const visible = isExpanded ? notIncludedTemplates : notIncludedTemplates.slice(0, LIMIT);
                  return (
                    <>
                      {visible.map((t, i) => (
                        <TemplateRow key={`exc-${i}`} t={t} isExcluded={true} toggleExcluded={toggleExcluded} />
                      ))}
                      {hasMore && (
                        <tr>
                          <td colSpan={5} className="p-0 relative">
                            {!isExpanded && (
                              <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                            )}
                            <button
                              onClick={() => setExpandedTableSections(prev => {
                                const next = new Set(prev);
                                if (next.has('not-included')) next.delete('not-included'); else next.add('not-included');
                                return next;
                              })}
                              className="w-full flex items-center justify-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronsUpDown className="h-3 w-3" />
                              {isExpanded ? 'Show less' : `Show all ${notIncludedTemplates.length}`}
                            </button>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              templates.map((t, i) => (
                <TemplateRow key={i} t={t} isExcluded={excluded.has(t.name)} toggleExcluded={toggleExcluded} showCheckbox={isEstimate} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* AI reasoning footer — per-tier (estimate mode only) */}
      {isEstimate && aiTiers && activeTier && activeTier !== 'All' && (() => {
        // Build cumulative reasoning: S shows S, M shows S+M, L shows S+M+L
        const sections: { label: string; content: string }[] = [];
        if (aiTiers.reasoning_S) sections.push({ label: 'Small', content: aiTiers.reasoning_S });
        if (activeTier !== 'S' && aiTiers.reasoning_M) sections.push({ label: 'Medium', content: aiTiers.reasoning_M });
        if (activeTier === 'L' && aiTiers.reasoning_L) sections.push({ label: 'Large', content: aiTiers.reasoning_L });
        if (sections.length === 0 && aiTiers.reasoning) sections.push({ label: 'Strategy', content: aiTiers.reasoning });
        if (sections.length === 0) return null;
        return (
          <div className="space-y-3 border-l-2 border-primary/30 pl-3">
            {aiTiers.reasoning && (
              <p className="text-xs text-muted-foreground font-medium">{aiTiers.reasoning}</p>
            )}
            {sections.map((s, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <div className="text-xs text-muted-foreground prose prose-xs max-w-none [&_strong]:text-foreground [&_p]:my-1">
                  <ReactMarkdown>{s.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
