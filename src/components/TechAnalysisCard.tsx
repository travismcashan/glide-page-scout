import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, TrendingUp, Server, Plug, Tag, Wrench, Package } from 'lucide-react';
import { CardTabs } from '@/components/CardTabs';

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

type Props = {
  data: {
    analysis: Analysis;
    techCount: number;
    sourceCount: number;
    sources: string[];
  } | null;
  isLoading: boolean;
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

function ScopeRow({ item, showEffort = true }: { item: ScopeItem; showEffort?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <span className="text-xs font-medium">{item.name}</span>
        {(item.role || item.purpose || item.type || item.reason) && (
          <span className="text-xs text-muted-foreground ml-1.5">— {item.role || item.purpose || item.type || item.reason}</span>
        )}
        {item.note && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{item.note}</p>
        )}
      </div>
      {showEffort && item.effort && (
        <Badge variant="outline" className={`text-[10px] shrink-0 ${effortColors[item.effort] || ''}`}>
          {item.effort}
        </Badge>
      )}
    </div>
  );
}

function FindingsTab({ findings, techCount, sources }: { findings: Findings; techCount: number; sources: string[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{findings.platform.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{findings.platform.type}</Badge>
            <Badge variant="outline" className={`text-[10px] ${ageColors[findings.stackAge] || ''}`}>{findings.stackAge}</Badge>
            <Badge variant="outline" className={`text-[10px] ${complexityColors[findings.complexity] || ''}`}>{findings.complexity}</Badge>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground mb-0.5">Modern Score</p>
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

function ScopeTab({ scope }: { scope: Scope }) {
  const hasPlugins = scope.plugins?.length > 0;
  const hasThirdParty = scope.thirdPartyIntegrations?.length > 0;
  const hasSpecial = scope.specialSetup?.length > 0;
  const hasTags = scope.tagManagement?.manager;

  return (
    <div className="space-y-4">
      {/* Platforms */}
      {scope.platforms?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Platforms</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{scope.platforms.length}</Badge>
          </div>
          <div className="rounded-md border border-border px-3">
            {scope.platforms.map((p, i) => (
              <ScopeRow key={i} item={p} showEffort={false} />
            ))}
          </div>
        </div>
      )}

      {/* Plugins */}
      {hasPlugins && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Plugins</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{scope.plugins.length}</Badge>
          </div>
          <div className="rounded-md border border-border px-3">
            {scope.plugins.map((p, i) => (
              <ScopeRow key={i} item={p} />
            ))}
          </div>
        </div>
      )}

      {/* Tag Management */}
      {hasTags && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Tag Management</p>
          </div>
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{scope.tagManagement!.manager}</Badge>
              <span className="text-[10px] text-muted-foreground">manages all tags below — no separate integration needed</span>
            </div>
            {scope.tagManagement!.coveredTags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {scope.tagManagement!.coveredTags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Third-Party Integrations */}
      {hasThirdParty && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Third-Party Integrations</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{scope.thirdPartyIntegrations.length}</Badge>
          </div>
          <div className="rounded-md border border-border px-3">
            {scope.thirdPartyIntegrations.map((p, i) => (
              <ScopeRow key={i} item={p} />
            ))}
          </div>
        </div>
      )}

      {/* Special Setup */}
      {hasSpecial && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Special Setup</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{scope.specialSetup.length}</Badge>
          </div>
          <div className="rounded-md border border-border px-3">
            {scope.specialSetup.map((p, i) => (
              <ScopeRow key={i} item={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TechAnalysisCard({ data, isLoading }: Props) {
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
  const findings = analysis.findings || analysis; // backwards compat
  const scope = analysis.scope;

  return (
    <CardTabs
      tabs={[
        {
          value: 'findings',
          label: 'Findings',
          icon: <TrendingUp className="h-3.5 w-3.5" />,
          content: <FindingsTab findings={findings} techCount={techCount} sources={sources} />,
        },
        {
          value: 'scope',
          label: 'Estimate Scope',
          icon: <Wrench className="h-3.5 w-3.5" />,
          content: scope ? <ScopeTab scope={scope} /> : <p className="text-sm text-muted-foreground">Scope data not available.</p>,
        },
      ]}
    />
  );
}
