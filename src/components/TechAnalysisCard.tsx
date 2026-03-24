import { Badge } from '@/components/ui/badge';
import { Brain, AlertTriangle, Lightbulb, Server, TrendingUp } from 'lucide-react';

type Analysis = {
  platform: { name: string; type: string; modernScore: number };
  highlights: string[];
  risks: string[];
  recommendations: string[];
  stackAge: string;
  complexity: string;
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

  return (
    <div className="space-y-4">
      {/* Platform header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{analysis.platform.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{analysis.platform.type}</Badge>
            <Badge variant="outline" className={`text-[10px] ${ageColors[analysis.stackAge] || ''}`}>{analysis.stackAge}</Badge>
            <Badge variant="outline" className={`text-[10px] ${complexityColors[analysis.complexity] || ''}`}>{analysis.complexity}</Badge>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground mb-0.5">Modern Score</p>
          <div className="w-24">
            <ScoreBar score={analysis.platform.modernScore} />
          </div>
        </div>
      </div>

      {/* Source info */}
      <p className="text-[10px] text-muted-foreground">
        Analysis based on {techCount} technologies from {sources.join(', ')}
      </p>

      {/* Highlights */}
      {analysis.highlights?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium">Key Findings</p>
          </div>
          <ul className="space-y-1">
            {analysis.highlights.map((h, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-foreground/40">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {analysis.risks?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-xs font-medium">Technical Risks</p>
          </div>
          <ul className="space-y-1">
            {analysis.risks.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-amber-500/60">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium">Redesign Recommendations</p>
          </div>
          <ul className="space-y-1">
            {analysis.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-primary/60">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
