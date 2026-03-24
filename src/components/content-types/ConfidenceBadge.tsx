import { Badge } from '@/components/ui/badge';

export function ConfidenceBadge({ conf }: { conf: { high: number; medium: number; low: number } }) {
  const total = conf.high + conf.medium + conf.low;
  if (total === 0) return null;
  const pct = Math.round((conf.high / total) * 100);
  if (pct >= 80) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">High</Badge>;
  if (pct >= 40) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Medium</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30">Low</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  const labels: Record<string, string> = {
    'url-pattern': 'URL Pattern',
    'schema-org': 'Schema.org',
    'meta-tags': 'Meta Tags',
    'css-classes': 'CSS Classes',
    'ai': 'AI',
  };
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
      {labels[source] || source}
    </Badge>
  );
}
