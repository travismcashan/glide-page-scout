import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wand2, ArrowRight, Sparkles, Bug, Lightbulb } from 'lucide-react';

const CATEGORY_META: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  feature: { label: 'Feature', icon: Sparkles, color: 'text-primary' },
  bug: { label: 'Bug', icon: Bug, color: 'text-red-500' },
  idea: { label: 'Idea', icon: Lightbulb, color: 'text-amber-500' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: 'text-red-500' },
  medium: { label: 'Medium', color: 'text-amber-500' },
  low: { label: 'Low', color: 'text-green-500' },
};

export type RecommendedItem = {
  id: string;
  title: string;
  description: string | null;
  reason: string;
  category: string;
  priority: string;
  effort: string | null;
};

type RecommendModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RecommendedItem[];
  summary?: string;
  onAccept: () => void;
  onDismiss: () => void;
};

function ItemCard({ item }: { item: RecommendedItem }) {
  const cat = CATEGORY_META[item.category] || CATEGORY_META.feature;
  const CatIcon = cat.icon;
  const pri = PRIORITY_META[item.priority] || PRIORITY_META.medium;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-2">
      <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
        {item.reason}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${cat.color}`}>
          <CatIcon className="h-3 w-3" />
          {cat.label}
        </span>
        <span className="text-xs text-muted-foreground/40">|</span>
        <span className={`text-xs font-medium ${pri.color}`}>
          {pri.label}
        </span>
        {item.effort && (
          <>
            <span className="text-xs text-muted-foreground/40">|</span>
            <span className="text-xs font-medium text-muted-foreground capitalize">
              {item.effort}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function RecommendModal({
  open, onOpenChange,
  items, summary,
  onAccept, onDismiss,
}: RecommendModalProps) {
  const isSprint = items.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-5 w-5 text-primary" />
            {isSprint ? 'Sprint Recommendation' : 'AI Recommendation'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {summary && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {summary}
            </p>
          )}

          {/* Recommended items */}
          <div className="space-y-2.5">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={onAccept} className="flex-1">
              {isSprint
                ? `Move ${items.length} items to Planned`
                : 'Move to Planned'}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <Button variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
