import { useMemo } from 'react';
import { computeOverallScore, type OverallScore, type CategoryScore, gradeToColor, gradeToBgColor, scoreToGrade } from '@/lib/siteScore';
import { GradeBadge } from '@/components/GradeBadge';
import { Trophy, TrendingDown } from 'lucide-react';

type SessionData = { id: string; domain: string; [key: string]: any };

type Props = {
  sessions: SessionData[];
};

type ScoredSession = {
  domain: string;
  sessionId: string;
  overall: OverallScore;
};

const CATEGORY_ORDER = ['performance', 'seo', 'accessibility', 'security', 'content', 'technology', 'url-analysis'];
const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance',
  seo: 'SEO & Search',
  accessibility: 'Accessibility',
  security: 'Security',
  content: 'Content',
  technology: 'Technology',
  'url-analysis': 'URL Health',
};

export function GroupScoreGrid({ sessions }: Props) {
  const scored = useMemo<ScoredSession[]>(() => {
    return sessions
      .map(s => {
        const overall = computeOverallScore(s);
        if (!overall) return null;
        return { domain: s.domain, sessionId: s.id, overall };
      })
      .filter(Boolean) as ScoredSession[];
  }, [sessions]);

  if (scored.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-muted-foreground">No score data available yet. Sites need completed analyses to compare.</p>
      </div>
    );
  }

  // Find best/worst per category
  const bestWorst = useMemo(() => {
    const map: Record<string, { best: string; worst: string }> = {};
    for (const catKey of CATEGORY_ORDER) {
      let bestScore = -1, worstScore = 101, bestDomain = '', worstDomain = '';
      for (const s of scored) {
        const cat = s.overall.categories.find(c => c.key === catKey);
        if (!cat) continue;
        if (cat.score > bestScore) { bestScore = cat.score; bestDomain = s.sessionId; }
        if (cat.score < worstScore) { worstScore = cat.score; worstDomain = s.sessionId; }
      }
      if (bestDomain) map[catKey] = { best: bestDomain, worst: worstDomain };
    }
    return map;
  }, [scored]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Category</th>
            {scored.map(s => (
              <th key={s.sessionId} className="text-center py-3 px-3 font-medium text-xs max-w-[140px]">
                <span className="truncate block">{s.domain}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.map(catKey => (
            <tr key={catKey} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-3 px-3 font-medium text-sm">{CATEGORY_LABELS[catKey]}</td>
              {scored.map(s => {
                const cat = s.overall.categories.find(c => c.key === catKey);
                const bw = bestWorst[catKey];
                const isBest = bw && bw.best === s.sessionId && scored.length > 1;
                const isWorst = bw && bw.worst === s.sessionId && bw.worst !== bw.best;
                return (
                  <td key={s.sessionId} className="text-center py-3 px-3">
                    {cat ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <GradeBadge grade={cat.grade} score={cat.score} />
                        {isBest && <Trophy className="h-3 w-3 text-amber-500" />}
                        {isWorst && <TrendingDown className="h-3 w-3 text-red-400" />}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {/* Overall footer */}
          <tr className="bg-muted/40 font-semibold">
            <td className="py-3 px-3 text-sm">Overall</td>
            {scored.map(s => (
              <td key={s.sessionId} className="text-center py-3 px-3">
                <GradeBadge grade={s.overall.grade} score={s.overall.score} size="md" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
