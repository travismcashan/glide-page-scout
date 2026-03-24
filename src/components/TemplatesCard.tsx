import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PageTagsMap } from '@/lib/pageTags';
import { normalizeTagKey, getTemplateCategory } from '@/lib/pageTags';

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
}

function TemplateRow({ t, isExcluded, toggleExcluded }: { t: { name: string; count: number; baseType?: string; navSection: string | null }; isExcluded: boolean; toggleExcluded: (name: string) => void }) {
  return (
    <tr className={`border-t border-border/50 transition-colors ${isExcluded ? 'opacity-50' : 'hover:bg-muted/20'}`}>
      <td className="px-3 py-1 text-center">
        <Checkbox checked={!isExcluded} onCheckedChange={() => toggleExcluded(t.name)} className="mx-auto" />
      </td>
      <td className={`px-3 py-1 text-xs font-mono leading-5 text-foreground ${isExcluded ? 'line-through' : ''}`}>{t.name}</td>
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

export function TemplatesCard({ pageTags, navStructure, domain }: Props) {
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [seeded, setSeeded] = useState(false);
  const [activeTier, setActiveTier] = useState<TierKey | null>(null);
  const [aiTiers, setAiTiers] = useState<AiTiers | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [collapsedTableSections, setCollapsedTableSections] = useState<Set<string>>(new Set());

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
      setAiTiers(data.tiers as AiTiers);
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

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet.</p>;
  }

  const designCount = templates.filter(t => !excluded.has(t.name)).length;
  const blockBuiltCount = totalTemplates - designCount;

  const toggleTableSection = (key: string) => {
    setCollapsedTableSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const hasTierSelection = activeTier && activeTier !== 'All' && aiTiers;
  const recommendedTemplates = hasTierSelection ? templates.filter(t => !excluded.has(t.name)) : [];
  const notIncludedTemplates = hasTierSelection ? templates.filter(t => excluded.has(t.name)) : [];

  const tierLabel = (tier: TierKey) => {
    if (tier === 'All') return 'All';
    const labels = { S: 'Small', M: 'Medium', L: 'Large' };
    const defaults = { S: 5, M: 10, L: 15 };
    const label = labels[tier as 'S' | 'M' | 'L'];
    const count = aiTiers ? aiTiers[tier as 'S' | 'M' | 'L'].length : defaults[tier as 'S' | 'M' | 'L'];
    return `${label} · ${count} layouts`;
  };

  return (
    <div className="space-y-4">
      {/* Summary + Controls on same row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span><strong className="text-foreground text-sm">{totalTemplates}</strong> Unique Templates</span>
          <span>·</span>
          <span><strong className="text-foreground text-sm">{designCount}</strong> Custom Design</span>
          <span>·</span>
          <span><strong className="text-foreground text-sm">{blockBuiltCount}</strong> Block-Built</span>
        </div>
        <div className="flex items-center gap-2">
          {!aiTiers && !aiLoading && (
            <button onClick={fetchAiRecommendations} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <Sparkles className="h-3 w-3" /> AI Recommend
            </button>
          )}
          {aiTiers && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" /> AI
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
      </div>

      {/* AI Loading indicator */}
      {aiLoading && (
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
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground w-10 text-center">Design</th>
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
                {!collapsedTableSections.has('recommended') && recommendedTemplates.map((t, i) => (
                  <TemplateRow key={`rec-${i}`} t={t} isExcluded={false} toggleExcluded={toggleExcluded} />
                ))}

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
                {!collapsedTableSections.has('not-included') && notIncludedTemplates.map((t, i) => (
                  <TemplateRow key={`exc-${i}`} t={t} isExcluded={true} toggleExcluded={toggleExcluded} />
                ))}
              </>
            ) : (
              templates.map((t, i) => (
                <TemplateRow key={i} t={t} isExcluded={excluded.has(t.name)} toggleExcluded={toggleExcluded} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* AI reasoning footer */}
      {aiTiers?.reasoning && activeTier && activeTier !== 'All' && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
          {aiTiers.reasoning}
        </p>
      )}
    </div>
  );
}
