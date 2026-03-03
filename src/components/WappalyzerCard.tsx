import { Badge } from '@/components/ui/badge';
import { Loader2, Layers } from 'lucide-react';

type WappalyzerCardProps = {
  data: {
    grouped?: Record<string, { name: string; versions?: string[]; website?: string }[]>;
    totalCount?: number;
    social?: string[] | null;
  } | null;
  isLoading: boolean;
};

export function WappalyzerCard({ data, isLoading }: WappalyzerCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Wappalyzer</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground min-h-[2.5rem]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span className="text-sm">Running Wappalyzer technology detection...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.grouped) return null;

  const categories = Object.entries(data.grouped).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Wappalyzer</span>
        <Badge variant="secondary">{data.totalCount || 0} technologies</Badge>
      </div>

      <div className="space-y-2">
        {categories.map(([category, techs]) => (
          <div key={category}>
            <p className="text-xs font-medium text-muted-foreground mb-1">{category}</p>
            <div className="flex flex-wrap gap-1.5">
              {techs.map((tech) => (
                <Badge key={tech.name} variant="outline" className="text-xs">
                  {tech.name}
                  {tech.versions && tech.versions.length > 0 && (
                    <span className="ml-1 text-muted-foreground">{tech.versions[0]}</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
