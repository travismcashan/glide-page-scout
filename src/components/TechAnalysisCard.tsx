import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, TrendingUp, Server, Wrench, ChevronRight, ChevronDown } from 'lucide-react';
import { CardTabs } from '@/components/CardTabs';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Findings = {
  platform: { name: string; type: string; modernScore: number };
  highlights: string[];
  risks: string[];
  stackAge: string;
  complexity: string;
};

type ScopeItem = { name: string; role?: string; purpose?: string; type?: string; reason?: string; effort?: string; note?: string };

type Scope = {
  platforms: ScopeItem[];
  plugins: ScopeItem[];
  tagManagement: { manager: string; coveredTags: string[] } | null;
  thirdPartyIntegrations: ScopeItem[];
  specialSetup: ScopeItem[];
};

type Analysis = {
  findings: Findings;
  scope: Scope;
};

export type TechTier = 'S' | 'M' | 'L';

export type TechTierCounts = {
  tier: TechTier;
  plugins: number;
  thirdParty: number;
  specialSetup: number;
  totalIncluded: number;
};

type Props = {
  data: {
    analysis: Analysis;
    techCount: number;
    sourceCount: number;
    sources: string[];
  } | null;
  isLoading: boolean;
  mode?: 'analysis' | 'estimate';
  onTierChange?: (counts: TechTierCounts) => void;
};

const ageColors: Record<string, string> = {
  modern: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  aging: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  legacy: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const complexityColors: Record<string, string> = {
  simple: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  moderate: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  complex: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  enterprise: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

const effortColors: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  high: 'bg-red-500/10 text-red-600 border-red-500/30',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 7 ? 'bg-emerald-500' : score >= 4 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{score}/10</span>
    </div>
  );
}

function FindingsTab({ findings, techCount, sources }: { findings: Findings; techCount: number; sources: string[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MetaStat value={findings.platform.modernScore} label="Modern Score" />
        <MetaStatDivider />
        <MetaStat value={techCount} label="Technologies" />
        <MetaStatDivider />
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">{findings.platform.type}</Badge>
          <Badge variant="outline" className={`text-[10px] ${ageColors[findings.stackAge] || ''}`}>{findings.stackAge}</Badge>
          <Badge variant="outline" className={`text-[10px] ${complexityColors[findings.complexity] || ''}`}>{findings.complexity}</Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header — matches all other tables */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Platform</span>
          <span className="w-24 text-center text-xs font-medium text-muted-foreground">Score</span>
        </div>

        <div className="flex items-center px-3 py-1 border-b border-border/50 hover:bg-muted/20 transition-colors">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs leading-5 truncate">{findings.platform.name}</span>
          </div>
          <div className="w-24">
            <ScoreBar score={findings.platform.modernScore} />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Based on {techCount} technologies from {sources.join(', ')}
      </p>

      {findings.highlights?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Key Findings</p>
          </div>
          <ul className="space-y-1">
            {findings.highlights.map((h, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-foreground/40">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.risks?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-medium">Technical Risks</p>
          </div>
          <ul className="space-y-1">
            {findings.risks.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-amber-500/60">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type ScopeSection = {
  key: string;
  title: string;
  items: ScopeItem[];
  showEffort: boolean;
};

function ScopeTab({ scope, mode = 'analysis', tierSelector, selectedTpaCount }: { scope: Scope; mode?: 'analysis' | 'estimate'; tierSelector?: React.ReactNode; selectedTpaCount?: number }) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const isEstimate = mode === 'estimate';
  const sections: ScopeSection[] = [];
  if (!isEstimate && scope.platforms?.length > 0) sections.push({ key: 'platforms', title: 'Platforms', items: scope.platforms, showEffort: false });
  if (scope.plugins?.length > 0) sections.push({ key: 'plugins', title: 'Plugins', items: scope.plugins, showEffort: true });
  if (scope.thirdPartyIntegrations?.length > 0) sections.push({ key: 'thirdParty', title: 'Third-Party Integrations', items: scope.thirdPartyIntegrations, showEffort: true });
  if (scope.specialSetup?.length > 0) sections.push({ key: 'specialSetup', title: 'Special Setup', items: scope.specialSetup, showEffort: true });

  if (!isEstimate) {
    const tagItems: ScopeItem[] = [];
    if (scope.tagManagement?.manager) {
      tagItems.push({ name: scope.tagManagement.manager, role: 'Tag Manager', note: scope.tagManagement.coveredTags?.length ? `Covers: ${scope.tagManagement.coveredTags.join(', ')}` : undefined });
    }
    if (tagItems.length > 0) sections.push({ key: 'tagManagement', title: 'Tag Management', items: tagItems, showEffort: false });
  }

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MetaStat value={totalItems} label={isEstimate ? 'Detected TPAs' : 'Scope Items'} />
        {isEstimate && selectedTpaCount != null ? (
          <>
            <MetaStatDivider />
            <MetaStat value={selectedTpaCount} label="Selected TPAs" />
          </>
        ) : (
          sections.map((s) => (
            <span key={s.key} className="contents">
              <MetaStatDivider />
              <MetaStat value={s.items.length} label={s.title} />
            </span>
          ))
        )}
        {tierSelector}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header — matches all other tables */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Technology</span>
          <span className="w-[180px] text-xs font-medium text-muted-foreground">Description</span>
          <span className="w-[70px] text-center text-xs font-medium text-muted-foreground">Effort</span>
        </div>

        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.key);

          return (
            <div key={section.key}>
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
              >
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
                <span className="text-xs font-semibold text-foreground">{section.title}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{section.items.length}</Badge>
              </button>

              {!isCollapsed && section.items.map((item, idx) => (
                <div key={idx} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                  <span className="flex-1 text-xs leading-5 truncate min-w-0">{item.name}</span>
                  <span className="w-[180px] text-xs leading-5 text-muted-foreground truncate">
                    {item.role || item.purpose || item.type || item.reason || '—'}
                  </span>
                  <span className="w-[70px] text-center">
                    {section.showEffort && item.effort ? (
                      <Badge variant="outline" className={`text-[10px] ${effortColors[item.effort] || ''}`}>
                        {item.effort}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TechAnalysisCard({ data, isLoading, mode = 'analysis', onTierChange }: Props) {
  const scope: Scope | undefined = data?.analysis ? (data.analysis as any).scope : undefined;
  const pluginCount = Array.isArray(scope?.plugins) ? scope!.plugins.length : 0;
  const thirdPartyCount = Array.isArray(scope?.thirdPartyIntegrations) ? scope!.thirdPartyIntegrations.length : 0;
  const specialSetupCount = Array.isArray(scope?.specialSetup) ? scope!.specialSetup.length : 0;

  // Auto-suggest tier based on data
  const suggestedTier: TechTier = specialSetupCount > 0 ? 'L' : thirdPartyCount > 0 ? 'M' : 'S';
  const [tier, setTier] = useState<TechTier>(suggestedTier);

  const isEstimate = mode === 'estimate';

  // Compute counts for current tier
  const getTierCounts = (t: TechTier): TechTierCounts => {
    const total = t === 'S' ? pluginCount : t === 'M' ? pluginCount + thirdPartyCount : pluginCount + thirdPartyCount + specialSetupCount;
    return { tier: t, plugins: pluginCount, thirdParty: thirdPartyCount, specialSetup: specialSetupCount, totalIncluded: total };
  };

  // Fire callback on tier change or initial mount
  useEffect(() => {
    if (isEstimate && onTierChange && scope) {
      onTierChange(getTierCounts(tier));
    }
  }, [tier, isEstimate, pluginCount, thirdPartyCount, specialSetupCount]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Brain className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Analyzing technology stack across all sources...</span>
      </div>
    );
  }

  if (!data?.analysis) return null;

  const { analysis, techCount, sources } = data;
  const findings: Findings = (analysis as any).findings || {
    platform: (analysis as any).platform,
    highlights: (analysis as any).highlights,
    risks: (analysis as any).risks,
    stackAge: (analysis as any).stackAge,
    complexity: (analysis as any).complexity,
  };

  const tierSelector = isEstimate && scope ? (
    <div className="flex items-center gap-2 ml-auto">
      <ToggleGroup type="single" value={tier} onValueChange={(v) => v && setTier(v as TechTier)} size="sm" variant="outline">
        <ToggleGroupItem value="S" className="text-xs px-2.5 h-7">
          Small • {pluginCount} TPAs
        </ToggleGroupItem>
        <ToggleGroupItem value="M" className="text-xs px-2.5 h-7">
          Medium • {pluginCount + thirdPartyCount} TPAs
        </ToggleGroupItem>
        <ToggleGroupItem value="L" className="text-xs px-2.5 h-7">
          Large • {pluginCount + thirdPartyCount + specialSetupCount} TPAs
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  ) : null;

  // In estimate mode: no tabs, just the filtered scope view directly
  if (isEstimate) {
    const selectedCount = tier === 'S' ? pluginCount : tier === 'M' ? pluginCount + thirdPartyCount : pluginCount + thirdPartyCount + specialSetupCount;
    return (
      <div className="space-y-4">
        {scope ? <ScopeTab scope={scope} mode="estimate" tierSelector={tierSelector} selectedTpaCount={selectedCount} /> : <p className="text-sm text-muted-foreground">Scope data not available. Re-run the analysis to generate scope data.</p>}
        
        {/* Tier reasoning */}
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          {tier === 'S' && (
            <>
              <div className="text-xs font-semibold text-foreground">Small Scope</div>
              <div className="prose prose-xs dark:prose-invert max-w-none text-xs text-muted-foreground leading-relaxed">
                <ReactMarkdown>{`Covers **Plugins only** — ${pluginCount} detected items. These are typically CMS plugins, widgets, and extensions that require configuration during the build phase. Third-party integrations and special setup items are excluded and would need to be handled separately or deferred to a post-launch phase.`}</ReactMarkdown>
              </div>
            </>
          )}
          {tier === 'M' && (
            <>
              <div className="text-xs font-semibold text-foreground">Medium Scope</div>
              <div className="prose prose-xs dark:prose-invert max-w-none text-xs text-muted-foreground leading-relaxed">
                <ReactMarkdown>{`Includes **Plugins and Third-Party Integrations** — ${pluginCount + thirdPartyCount} items total. Beyond CMS plugins, this adds the ${thirdPartyCount} external service connections (analytics, CRMs, marketing tools, etc.) that require API configuration or embed setup. Special setup items with complex implementation needs are excluded.`}</ReactMarkdown>
              </div>
            </>
          )}
          {tier === 'L' && (
            <>
              <div className="text-xs font-semibold text-foreground">Large Scope</div>
              <div className="prose prose-xs dark:prose-invert max-w-none text-xs text-muted-foreground leading-relaxed">
                <ReactMarkdown>{`**Comprehensive integration coverage** — all ${pluginCount + thirdPartyCount + specialSetupCount} items including Plugins, Third-Party Integrations, and ${specialSetupCount} Special Setup items. Special setup items typically require custom development, complex API integrations, or significant configuration effort beyond standard plugin installation.`}</ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <CardTabs
      tabs={[
        {
          value: 'scope',
          label: 'Estimated Scope',
          icon: <Wrench className="h-3.5 w-3.5" />,
          content: scope ? <ScopeTab scope={scope} /> : <p className="text-sm text-muted-foreground">Scope data not available. Re-run the analysis to generate scope data.</p>,
        },
        {
          value: 'findings',
          label: 'Tech Analysis Findings',
          icon: <TrendingUp className="h-3.5 w-3.5" />,
          content: <FindingsTab findings={findings} techCount={techCount} sources={sources} />,
        },
      ]}
    />
  );
}
