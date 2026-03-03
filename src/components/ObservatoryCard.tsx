import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { ChevronDown, Shield, ShieldCheck, ShieldAlert, ShieldX, ExternalLink } from 'lucide-react';

type ObservatoryData = {
  grade: string | null;
  score: number | null;
  scannedAt: string | null;
  detailsUrl: string | null;
  tests: Record<string, {
    pass: boolean;
    result: string;
    score_description: string;
    score_modifier: number;
    recommendation?: string;
  }> | null;
};

function gradeVariant(grade: string | null): 'default' | 'secondary' | 'destructive' {
  if (!grade) return 'secondary';
  if (grade.startsWith('A')) return 'default';
  if (grade.startsWith('B') || grade.startsWith('C')) return 'secondary';
  return 'destructive';
}

function gradeIcon(grade: string | null) {
  if (!grade) return <Shield className="h-4 w-4 text-muted-foreground" />;
  if (grade.startsWith('A')) return <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />;
  if (grade.startsWith('B') || grade.startsWith('C')) return <ShieldAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  return <ShieldX className="h-4 w-4 text-destructive" />;
}

function testDisplayName(key: string): string {
  const names: Record<string, string> = {
    'content-security-policy': 'Content Security Policy',
    'cookies': 'Cookies',
    'cross-origin-resource-sharing': 'CORS',
    'redirection': 'Redirection',
    'referrer-policy': 'Referrer Policy',
    'strict-transport-security': 'Strict Transport Security (HSTS)',
    'subresource-integrity': 'Subresource Integrity',
    'x-content-type-options': 'X-Content-Type-Options',
    'x-frame-options': 'X-Frame-Options',
    'cross-origin-resource-policy': 'Cross-Origin Resource Policy',
  };
  return names[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function ObservatoryCard({ data, isLoading }: { data: ObservatoryData | null; isLoading: boolean }) {
  const [showAll, setShowAll] = useState(false);

  if (isLoading || !data) return null;

  const tests = data.tests ? Object.entries(data.tests) : [];
  const passed = tests.filter(([, t]) => t.pass);
  const failed = tests.filter(([, t]) => !t.pass);

  return (
    <div className="space-y-4">
      {/* Header with grade */}
      <div className="flex items-center gap-3">
        {gradeIcon(data.grade)}
        <span className="text-sm font-medium">Security Grade</span>
        <Badge variant={gradeVariant(data.grade)} className="text-lg px-3 py-0.5 font-bold ml-auto">
          {data.grade || '—'}
        </Badge>
        {data.score != null && (
          <span className="text-xs text-muted-foreground">{data.score}/100</span>
        )}
      </div>

      {data.detailsUrl && (
        <a href={data.detailsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Full report on MDN Observatory
        </a>
      )}

      {/* Failed tests */}
      {failed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-destructive flex items-center gap-1">
            <ShieldX className="h-3.5 w-3.5" /> {failed.length} Failed
          </p>
          {failed.map(([key, test]) => (
            <div key={key} className="border border-border rounded-lg px-3 py-2 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{testDisplayName(key)}</span>
                <Badge variant="destructive" className="text-[10px]">
                  {test.score_modifier > 0 ? `+${test.score_modifier}` : test.score_modifier}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{test.score_description || test.result}</p>
            </div>
          ))}
        </div>
      )}

      {/* Passed tests */}
      {passed.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-medium flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> {passed.length} Passed
            <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
          {showAll && passed.map(([key, test]) => (
            <div key={key} className="flex items-center justify-between text-xs border-b border-border/50 pb-1 last:border-0">
              <span className="text-muted-foreground">{testDisplayName(key)}</span>
              <Badge variant="outline" className="text-[10px]">
                {test.score_modifier > 0 ? `+${test.score_modifier}` : test.score_modifier === 0 ? '0' : test.score_modifier}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {data.scannedAt && (
        <p className="text-[10px] text-muted-foreground">
          Scanned: {new Date(data.scannedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
