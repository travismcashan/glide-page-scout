import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type YellowLabData = {
  globalScore?: number | null;
  runId?: string;
  categories?: Record<string, { score: number; label: string }>;
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-destructive';
}

function scoreGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  if (score >= 20) return 'E';
  return 'F';
}

function gradeBg(grade: string): string {
  const map: Record<string, string> = {
    A: 'bg-green-500 text-white',
    B: 'bg-green-400 text-white',
    C: 'bg-yellow-500 text-white',
    D: 'bg-orange-500 text-white',
    E: 'bg-destructive text-destructive-foreground',
    F: 'bg-destructive text-destructive-foreground',
  };
  return map[grade] || 'bg-muted text-muted-foreground';
}

const categoryOrder = [
  'pageWeight',
  'requests',
  'domComplexity',
  'javascriptComplexity',
  'badJavascript',
  'jQuery',
  'cssComplexity',
  'badCSS',
  'fonts',
  'serverConfig',
];

const categoryIcons: Record<string, string> = {
  pageWeight: '📦',
  requests: '🔗',
  domComplexity: '🏗️',
  javascriptComplexity: '⚙️',
  badJavascript: '⚠️',
  jQuery: '💲',
  cssComplexity: '🎨',
  badCSS: '🚫',
  fonts: '🔤',
  serverConfig: '🖥️',
};

export function YellowLabCard({ data }: { data: YellowLabData }) {
  const globalScore = data.globalScore ?? 0;
  const grade = scoreGrade(globalScore);
  const categories = data.categories || {};

  const sorted = categoryOrder.filter(k => categories[k]).map(k => ({ key: k, ...categories[k] }));
  // Add any categories not in the predefined order
  for (const [k, v] of Object.entries(categories)) {
    if (!categoryOrder.includes(k)) sorted.push({ key: k, ...v });
  }

  return (
    <div className="space-y-6">
      {/* Hero score */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className={`inline-flex items-center justify-center w-14 h-14 rounded-xl text-2xl font-bold ${gradeBg(grade)}`}>
            {grade}
          </span>
          <span className="text-xs text-muted-foreground">Grade</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className={`text-4xl font-bold ${scoreColor(globalScore)}`}>{globalScore}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      {/* Category breakdown */}
      {sorted.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Category Scores</p>
          <div className="space-y-2">
            {sorted.map(cat => {
              const catGrade = scoreGrade(cat.score);
              return (
                <div key={cat.key} className="flex items-center gap-3">
                  <span className="text-base w-6 text-center">{categoryIcons[cat.key] || '📊'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm truncate">{cat.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-mono font-semibold ${scoreColor(cat.score)}`}>{cat.score}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 ${gradeBg(catGrade)} border-0`}>{catGrade}</Badge>
                      </div>
                    </div>
                    <Progress value={cat.score} className="h-1.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
