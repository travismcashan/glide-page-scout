import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface FormEntry {
  fingerprint: string;
  formType: string;
  description: string;
  platform: string | null;
  isGlobal: boolean;
  pages: string[];
  pageCount: number;
  fieldCount: number;
  fieldTypes: string[];
  fieldNames: string[];
  hasFileUpload: boolean;
  hasCaptcha: boolean;
  method: string;
  action: string;
}

interface FormsSummary {
  totalFormsFound: number;
  uniqueForms: number;
  globalForms: number;
  pagesWithForms: number;
  pagesScraped: number;
  platforms: Record<string, number>;
  formTypes: Record<string, number>;
}

interface FormsData {
  forms: FormEntry[];
  summary: FormsSummary;
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

const TIER_KEYS = ['S', 'M', 'L', 'All'] as const;
type TierKey = (typeof TIER_KEYS)[number];

interface Props {
  data: FormsData;
  domain?: string;
  savedTiers?: AiTiers | null;
  onTiersChange?: (tiers: AiTiers) => void;
  onRerunRequest?: (rerunFn: () => void) => void;
  onFormTierChange?: (counts: { s: number; m: number; l: number; total: number }) => void;
  mode?: 'analysis' | 'estimate';
}

const platformColors: Record<string, string> = {
  HubSpot: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'Gravity Forms': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  Typeform: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  WPForms: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'Contact Form 7': 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  Mailchimp: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  Calendly: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Pardot: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  Marketo: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Jotform: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Native: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

const LOADING_MESSAGES = [
  'Inspecting form fields…',
  'Counting submit buttons…',
  'Measuring conversion potential…',
  'Analyzing form complexity…',
  'Sorting forms by importance…',
  'Consulting the UX oracle…',
  'Evaluating user journeys…',
  'Rating form aesthetics…',
];

export function FormsCard({ data, domain, savedTiers, onTiersChange, onRerunRequest, onFormTierChange, mode = 'analysis' }: Props) {
  const [expandedForms, setExpandedForms] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [activeTier, setActiveTier] = useState<TierKey | null>(null);
  const [aiTiers, setAiTiers] = useState<AiTiers | null>(savedTiers || null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRunRef = useRef(false);
  const { forms, summary } = data;

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

  const fetchAiRecommendations = useCallback(async () => {
    if (aiTiers || aiLoading || forms.length === 0) return;
    setAiLoading(true);
    try {
      const payload = {
        domain: domain || 'unknown',
        forms: forms.map(f => ({
          formType: f.formType,
          platform: f.platform,
          isGlobal: f.isGlobal,
          pageCount: f.pageCount,
          fieldCount: f.fieldCount,
          hasFileUpload: f.hasFileUpload,
          hasCaptcha: f.hasCaptcha,
          description: f.description,
        })),
      };
      const { data: respData, error } = await supabase.functions.invoke('recommend-forms', { body: payload });
      if (error) throw error;
      if (!respData?.success) throw new Error(respData?.error || 'AI analysis failed');
      const tiers = respData.tiers as AiTiers;
      setAiTiers(tiers);
      onTiersChange?.(tiers);
      toast.success('Form recommendations ready');
    } catch (err) {
      console.error('AI recommend-forms error:', err);
      toast.error('Failed to get form recommendations');
    } finally {
      setAiLoading(false);
    }
  }, [aiTiers, aiLoading, forms, domain]);

  // Auto-run AI recommendations
  useEffect(() => {
    if (mode === 'estimate' && !autoRunRef.current && !aiTiers && !aiLoading && forms.length > 0) {
      autoRunRef.current = true;
      fetchAiRecommendations();
    }
  }, [forms, aiTiers, aiLoading, fetchAiRecommendations, mode]);

  const toggleExcluded = (formType: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(formType)) next.delete(formType); else next.add(formType);
      return next;
    });
  };

  const applyTier = (tier: TierKey) => {
    if (activeTier === tier) { setActiveTier(null); setExcluded(new Set()); return; }
    setActiveTier(tier);
    if (tier === 'All') { setExcluded(new Set()); return; }
    if (aiTiers) {
      const included = new Set(aiTiers[tier as 'S' | 'M' | 'L']);
      const newExcluded = new Set<string>();
      for (const f of forms) { if (!included.has(f.formType)) newExcluded.add(f.formType); }
      setExcluded(newExcluded);
    }
  };

  // Re-apply tier when aiTiers arrive
  useEffect(() => {
    if (aiTiers && activeTier && activeTier !== 'All') {
      const included = new Set(aiTiers[activeTier as 'S' | 'M' | 'L']);
      const newExcluded = new Set<string>();
      for (const f of forms) { if (!included.has(f.formType)) newExcluded.add(f.formType); }
      setExcluded(newExcluded);
    }
  }, [aiTiers, activeTier, forms]);

  // Fire form tier counts to parent when selection changes
  useEffect(() => {
    if (!onFormTierChange || !aiTiers) return;
    const includedForms = forms.filter(f => !excluded.has(f.formType));
    const sSet = new Set(aiTiers.S);
    const mSet = new Set(aiTiers.M);
    const lNames = (aiTiers.L || []).filter(n => !sSet.has(n) && !mSet.has(n));
    const mOnly = (aiTiers.M || []).filter(n => !sSet.has(n));
    let sCount = 0, mCount = 0, lCount = 0;
    for (const f of includedForms) {
      if (sSet.has(f.formType)) sCount++;
      else if (mSet.has(f.formType)) mCount++;
      else lCount++;
    }
    onFormTierChange({ s: sCount, m: mCount, l: lCount, total: includedForms.length });
  }, [excluded, aiTiers, forms, onFormTierChange]);

  // Auto-select best tier
  useEffect(() => {
    if (aiTiers && !autoSelected && !activeTier) {
      const count = forms.length;
      let bestTier: 'S' | 'M' | 'L';
      if (count <= 4) bestTier = 'S';
      else if (count <= 8) bestTier = 'M';
      else bestTier = 'L';
      setAutoSelected(true);
      applyTier(bestTier);
    }
  }, [aiTiers, autoSelected, activeTier, forms]);

  const tierLabel = (tier: TierKey) => {
    if (tier === 'All') return 'All';
    const labels = { S: 'Small', M: 'Medium', L: 'Large' };
    const label = labels[tier as 'S' | 'M' | 'L'];
    if (!aiTiers) return `${label} · … forms`;
    const includedTypes = new Set(aiTiers[tier as 'S' | 'M' | 'L']);
    const count = forms.filter(f => includedTypes.has(f.formType)).length;
    return `${label} · ${count} forms`;
  };

  const toggleForm = (idx: number) => {
    setExpandedForms(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };
  const isEstimate = mode === 'estimate';

  const hasTierSelection = isEstimate && activeTier && activeTier !== 'All' && aiTiers;
  const aiIncludedSet = hasTierSelection ? new Set(aiTiers[activeTier as 'S' | 'M' | 'L']) : new Set<string>();

  const recommendedForms = hasTierSelection ? forms.filter(f => !excluded.has(f.formType)) : [];
  const notIncludedForms = hasTierSelection ? forms.filter(f => excluded.has(f.formType)) : [];

  const globalForms = forms.filter(f => f.isGlobal);
  const pageForms = forms.filter(f => !f.isGlobal);


  return (
    <div className="space-y-4">
      {/* Meta stats + tier controls on one row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <MetaStat value={summary.uniqueForms} label="Detected Forms" />
          <MetaStatDivider />
          <MetaStat value={forms.filter(f => !excluded.has(f.formType)).length} label="Selected Forms" />
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

      {/* Forms table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          {hasTierSelection && <span className="w-10 text-center text-xs font-medium text-muted-foreground">Design</span>}
          <span className="flex-1 text-xs font-medium text-muted-foreground">Form</span>
          <span className="w-[120px] text-center text-xs font-medium text-muted-foreground">Platform</span>
          <span className="w-[45px] text-center text-xs font-medium text-muted-foreground">Fields</span>
          <span className="w-[50px] text-right text-xs font-medium text-muted-foreground">Pages</span>
        </div>

        {hasTierSelection ? (
          <>
            {/* Recommended section */}
            <button
              onClick={() => toggleGroup('recommended')}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              {collapsedGroups.has('recommended')
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              }
              <span className="text-xs font-semibold text-foreground">Recommended Forms</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{recommendedForms.length}</Badge>
            </button>
            {!collapsedGroups.has('recommended') && recommendedForms.map((form, i) => (
              <FormRow key={`rec-${i}`} form={form} index={i} isExpanded={expandedForms.has(i)} onToggle={() => toggleForm(i)} showCheckbox isExcluded={false} toggleExcluded={toggleExcluded} isManuallyAdded={!aiIncludedSet.has(form.formType)} />
            ))}

            {/* Not included section */}
            <button
              onClick={() => toggleGroup('not-included')}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
            >
              {collapsedGroups.has('not-included')
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              }
              <span className="text-xs font-semibold text-foreground">Forms Not Included</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{notIncludedForms.length}</Badge>
            </button>
            {!collapsedGroups.has('not-included') && notIncludedForms.map((form, i) => {
              const idx = recommendedForms.length + i;
              return <FormRow key={`exc-${i}`} form={form} index={idx} isExpanded={expandedForms.has(idx)} onToggle={() => toggleForm(idx)} showCheckbox isExcluded toggleExcluded={toggleExcluded} />;
            })}
          </>
        ) : (
          <>
            {/* Default: Global / Page-specific grouping */}
            {globalForms.length > 0 && (
              <>
                <button
                  onClick={() => toggleGroup('global')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border first:border-t-0"
                >
                  {collapsedGroups.has('global')
                    ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  }
                  <span className="text-xs font-semibold text-foreground">Global Forms</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{globalForms.length}</Badge>
                </button>
                {!collapsedGroups.has('global') && globalForms.map((form, i) => (
                  <FormRow key={`g-${i}`} form={form} index={i} isExpanded={expandedForms.has(i)} onToggle={() => toggleForm(i)} />
                ))}
              </>
            )}
            {pageForms.length > 0 && (
              <>
                <button
                  onClick={() => toggleGroup('page')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
                >
                  {collapsedGroups.has('page')
                    ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  }
                  <span className="text-xs font-semibold text-foreground">Page-Specific Forms</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{pageForms.length}</Badge>
                </button>
                {!collapsedGroups.has('page') && pageForms.map((form, i) => {
                  const idx = globalForms.length + i;
                  return <FormRow key={`p-${i}`} form={form} index={idx} isExpanded={expandedForms.has(idx)} onToggle={() => toggleForm(idx)} />;
                })}
              </>
            )}
          </>
        )}

        {forms.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-3 py-6 text-center">No forms detected on scanned pages.</p>
        )}
      </div>

      {/* AI reasoning footer */}
      {isEstimate && aiTiers && activeTier && activeTier !== 'All' && (() => {
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
            {sections.map(s => (
              <div key={s.label}>
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">{s.label}</span>
                <div className="text-xs text-muted-foreground prose prose-xs max-w-none dark:prose-invert mt-0.5">
                  <ReactMarkdown>{s.content}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Platform breakdown */}
      {Object.keys(summary.platforms).length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Platforms detected: {Object.entries(summary.platforms)
            .sort(([, a], [, b]) => b - a)
            .map(([platform, count]) => `${platform} (${count})`)
            .join(', ')}
        </p>
      )}
    </div>
  );
}

function FormRow({ form, index, isExpanded, onToggle, showCheckbox, isExcluded, toggleExcluded, isManuallyAdded }: {
  form: FormEntry; index: number; isExpanded: boolean; onToggle: () => void;
  showCheckbox?: boolean; isExcluded?: boolean; toggleExcluded?: (formType: string) => void; isManuallyAdded?: boolean;
}) {
  return (
    <div>
      <div
        className={`flex items-center px-3 py-1 hover:bg-muted/20 transition-colors cursor-pointer group border-t border-border/50 ${isExcluded ? 'opacity-50' : ''}`}
        onClick={onToggle}
      >
        {showCheckbox && toggleExcluded && (
          <span className="w-10 flex justify-center" onClick={e => { e.stopPropagation(); toggleExcluded(form.formType); }}>
            <Checkbox checked={!isExcluded} onCheckedChange={() => toggleExcluded(form.formType)} className="mx-auto" />
          </span>
        )}
        <div className="flex items-center flex-1 min-w-0 gap-2">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <span className={`text-xs font-mono leading-5 text-foreground truncate ${isExcluded ? 'line-through' : ''}`}>{form.formType}</span>
          {isManuallyAdded && <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20">added</Badge>}
          {form.hasFileUpload && <Badge variant="outline" className="text-[9px] px-1 py-0">📎 upload</Badge>}
          {form.hasCaptcha && <Badge variant="outline" className="text-[9px] px-1 py-0">🛡 captcha</Badge>}
        </div>
        <span className="w-[120px] flex justify-center">
          <Badge variant="outline" className={`${platformColors[form.platform || 'Native'] || platformColors.Native} text-[10px] px-1.5 py-0 whitespace-nowrap`}>
            {form.platform || 'Native'}
          </Badge>
        </span>
        <span className="w-[45px] text-center text-xs text-muted-foreground">{form.fieldCount}</span>
        <span className="w-[50px] text-right text-xs text-muted-foreground">{form.pageCount}</span>
      </div>

      {isExpanded && (
        <div className="bg-muted/10 px-3 py-2 ml-8 space-y-2 text-xs border-t border-border/30">
          {form.description && (
            <div>
              <span className="font-medium text-foreground">Description: </span>
              <span className="text-muted-foreground">{form.description}</span>
            </div>
          )}
          {form.fieldNames.length > 0 && (
            <div>
              <span className="font-medium text-foreground">Fields: </span>
              <span className="text-muted-foreground">{form.fieldNames.join(', ')}</span>
            </div>
          )}
          {form.action && form.method !== 'EMBED' && (
            <div>
              <span className="font-medium text-foreground">Action: </span>
              <span className="text-muted-foreground font-mono">{form.method} {form.action || '(self)'}</span>
            </div>
          )}
          <div>
            <span className="font-medium text-foreground">Found on: </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {form.pages.slice(0, 10).map((page, i) => {
                let path: string;
                try { path = new URL(page).pathname; } catch { path = page; }
                return (
                  <a key={i} href={page} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline font-mono inline-flex items-center gap-0.5">
                    {path}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                );
              })}
              {form.pages.length > 10 && <span className="text-muted-foreground text-[11px]">+{form.pages.length - 10} more</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
