import { Skeleton } from '@/components/ui/skeleton';

/** Generic skeleton shapes for different tab types */
const layouts = {
  cards: (
    <div className="space-y-6 animate-fade-in">
      {/* Section header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-48" />
      </div>
      {/* Card skeletons */}
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  ),
  chat: (
    <div className="flex flex-col items-center h-[calc(100vh-200px)] animate-fade-in">
      <div className="w-full max-w-3xl space-y-4 flex-1 pt-8">
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
            <div className={`space-y-2 ${i % 2 === 0 ? 'w-2/5' : 'w-3/5'}`}>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              {i % 2 !== 0 && <Skeleton className="h-4 w-3/5" />}
            </div>
          </div>
        ))}
      </div>
      <div className="w-full max-w-3xl mt-auto">
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  ),
  knowledge: (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  ),
};

type TabSkeletonVariant = keyof typeof layouts;

export function TabSkeleton({ variant = 'cards' }: { variant?: TabSkeletonVariant }) {
  return layouts[variant];
}