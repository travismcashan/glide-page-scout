import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Download } from 'lucide-react';

type GtmetrixScores = {
  performance: number;
  structure: number;
  lcp: number;
  tbt: number;
  cls: number;
};

type Props = {
  grade: string | null;
  scores: GtmetrixScores | null;
  pdfUrl: string | null;
  apiKey?: string | null;
  testId: string | null;
  isRunning: boolean;
};

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function gradeColor(grade: string | null): string {
  if (!grade) return 'secondary';
  if (grade === 'A') return 'default';
  if (grade === 'B') return 'default';
  return 'destructive';
}

export function GtmetrixCard({ grade, scores, pdfUrl, apiKey, testId, isRunning }: Props) {
  if (isRunning) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Running GTmetrix performance test...</span>
      </div>
    );
  }

  if (!grade && !scores) return null;

  const handleDownloadPdf = () => {
    if (!pdfUrl || !apiKey) return;
    // Open authenticated PDF in new tab
    const authUrl = `${pdfUrl}?key=${apiKey}`;
    window.open(authUrl, '_blank');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">GTmetrix Performance</span>
          <Badge variant={gradeColor(grade) as any}>Grade {grade}</Badge>
        </div>
        {pdfUrl && apiKey && (
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="h-3 w-3 mr-1" /> PDF Report
          </Button>
        )}
      </div>
      {scores && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{scores.performance ?? '—'}%</div>
            <div className="text-xs text-muted-foreground">Performance</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{scores.structure ?? '—'}%</div>
            <div className="text-xs text-muted-foreground">Structure</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{formatMs(scores.lcp)}</div>
            <div className="text-xs text-muted-foreground">LCP</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{formatMs(scores.tbt)}</div>
            <div className="text-xs text-muted-foreground">TBT</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-lg font-bold">{scores.cls?.toFixed(3) ?? '—'}</div>
            <div className="text-xs text-muted-foreground">CLS</div>
          </div>
        </div>
      )}
    </div>
  );
}
