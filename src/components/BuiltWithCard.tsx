import { Badge } from '@/components/ui/badge';
import { Code } from 'lucide-react';

type Technology = {
  name: string;
  description?: string;
  link?: string;
};

type Props = {
  grouped: Record<string, Technology[]> | null;
  totalCount: number;
  isLoading: boolean;
};

export function BuiltWithCard({ grouped, totalCount, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Code className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Detecting technology stack...</span>
      </div>
    );
  }

  if (!grouped || totalCount === 0) return null;

  const categories = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Code className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Technology Stack</span>
        <Badge variant="secondary">{totalCount} technologies</Badge>
      </div>
      <div className="space-y-2">
        {categories.map(([category, techs]) => (
          <div key={category}>
            <p className="text-xs text-muted-foreground font-medium mb-1">{category}</p>
            <div className="flex flex-wrap gap-1.5">
              {techs.map((tech) => (
                <Badge key={tech.name} variant="outline" className="text-xs">
                  {tech.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
