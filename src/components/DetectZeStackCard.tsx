import { Badge } from '@/components/ui/badge';

type Technology = {
  name: string;
  categories: string[];
  confidence: number | null;
  version: string | null;
};

type Props = {
  data: {
    grouped?: Record<string, Technology[]>;
    totalCount?: number;
    scanDepth?: string | null;
  } | null;
};

const categoryColors: Record<string, string> = {
  CMS: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  CDN: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Analytics: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CRM: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  'JavaScript libraries': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  'JavaScript frameworks': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'Web servers': 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
  Databases: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'Cloud hosting': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  'Tag managers': 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  Advertising: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
  Security: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function DetectZeStackCard({ data }: Props) {
  if (!data || !data.grouped) return null;

  const categories = Object.entries(data.grouped).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {categories.map(([category, techs]) => (
          <div key={category}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{category}</p>
            <div className="flex flex-wrap gap-1.5">
              {techs.map((tech) => (
                <Badge
                  key={tech.name}
                  variant="outline"
                  className={`text-xs ${categoryColors[category] || ''}`}
                >
                  {tech.name}
                  {tech.version && (
                    <span className="ml-1 text-muted-foreground">{tech.version}</span>
                  )}
                  {tech.confidence != null && tech.confidence < 100 && (
                    <span className="ml-1 text-muted-foreground/60">{tech.confidence}%</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      {data.scanDepth && data.scanDepth !== 'full' && (
        <p className="text-[10px] text-muted-foreground italic">
          Partial scan — some detection layers were limited
        </p>
      )}
    </div>
  );
}
