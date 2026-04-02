import { X, ArrowRight, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RecommendBannerProps = {
  title: string;
  reason: string;
  onView: () => void;
  onDismiss: () => void;
};

export function RecommendBanner({ title, reason, onView, onDismiss }: RecommendBannerProps) {
  return (
    <div className="relative flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] px-5 py-3.5 mb-5">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 shrink-0">
        <Wand2 className="h-4.5 w-4.5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          Work on next: {title}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
          {reason}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onView}
        className="shrink-0"
      >
        View
        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
      </Button>

      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
