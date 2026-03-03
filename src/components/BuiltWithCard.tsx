import { Badge } from '@/components/ui/badge';
import { Code, CreditCard } from 'lucide-react';

type Technology = {
  name: string;
  description?: string;
  link?: string;
};

type Credits = {
  available?: string | null;
  used?: string | null;
  remaining?: string | null;
};

type Props = {
  grouped: Record<string, Technology[]> | null;
  totalCount: number;
  isLoading: boolean;
  credits?: Credits | null;
};

export function BuiltWithCard({ grouped, totalCount, isLoading, credits }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-2">
        <Code className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Detecting technology stack...</span>
      </div>
    );
  }

  const hasCredits = credits && (credits.remaining != null || credits.available != null);

  return (
    <div className="space-y-3">
      {hasCredits && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          <span>Credits: <strong className="text-foreground">{credits.remaining ?? '?'}</strong> remaining of {credits.available ?? '?'}</span>
          {credits.used && <span>({credits.used} used)</span>}
        </div>
      )}

      {(!grouped || totalCount === 0) ? (
        <p className="text-sm text-muted-foreground">No technologies detected for this domain. This may indicate insufficient API credits or the domain isn't indexed.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Technology Stack</span>
            <Badge variant="secondary">{totalCount} technologies</Badge>
          </div>
          <div className="space-y-2">
            {Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).map(([category, techs]) => (
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
        </>
      )}
    </div>
  );
}
