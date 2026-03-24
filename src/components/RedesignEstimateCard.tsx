import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PageTagsMap } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

const baseTypeColors: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

interface Props {
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
}

export function RedesignEstimateCard({ pageTags, contentTypesData }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const { baseTypeCounts, contentTypes, totalPages } = useMemo(() => {
    const counts: Record<string, number> = { Page: 0, Post: 0, CPT: 0, Archive: 0, Search: 0 };

    if (pageTags) {
      for (const [, tag] of Object.entries(pageTags)) {
        const bt = tag.baseType || 'Page';
        counts[bt] = (counts[bt] || 0) + 1;
      }
    }

    const ctList: { type: string; count: number; baseType?: string }[] = [];
    if (contentTypesData?.summary) {
      for (const s of contentTypesData.summary) {
        if (s.baseType === 'Post' || s.baseType === 'CPT') {
          ctList.push({ type: s.type, count: s.count, baseType: s.baseType });
        }
      }
    }

    return {
      baseTypeCounts: Object.entries(counts).filter(([, c]) => c > 0),
      contentTypes: ctList,
      totalPages: pageTags ? Object.keys(pageTags).length : 0,
    };
  }, [pageTags, contentTypesData]);

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet.</p>;
  }

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalRepeating = contentTypes.reduce((sum, ct) => sum + ct.count, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold text-foreground">{totalPages}</span>
        <span className="text-sm text-muted-foreground">total URLs</span>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-2xl font-bold text-foreground">{baseTypeCounts.length}</span>
        <span className="text-sm text-muted-foreground">base types</span>
        {contentTypes.length > 0 && (
          <>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-2xl font-bold text-foreground">{contentTypes.length}</span>
            <span className="text-sm text-muted-foreground">repeating content types</span>
          </>
        )}
      </div>

      {/* Unified container with collapsible sections */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Base Types section */}
        <button
          onClick={() => toggleSection('base-types')}
          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        >
          {collapsedSections.has('base-types')
            ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          }
          <span className="text-xs font-medium text-muted-foreground flex-1">Base Types</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{baseTypeCounts.length}</Badge>
        </button>
        {!collapsedSections.has('base-types') && (
          <div>
            {baseTypeCounts.map(([type, count]) => (
              <div key={type} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 flex-1">
                  <Badge variant="outline" className={`${baseTypeColors[type] || ''} text-[10px] px-1.5 py-0`}>{type}</Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Repeating Content section */}
        {contentTypes.length > 0 && (
          <>
            <button
              onClick={() => toggleSection('repeating')}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
            >
              {collapsedSections.has('repeating')
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              }
              <span className="text-xs font-medium text-muted-foreground flex-1">Repeating Content</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{totalRepeating}</Badge>
            </button>
            {!collapsedSections.has('repeating') && (
              <div>
                {contentTypes.map((ct) => (
                  <div key={ct.type} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <span className="text-xs font-mono leading-5 text-muted-foreground flex-1 truncate">{ct.type}</span>
                    {ct.baseType && (
                      <Badge variant="outline" className={`${baseTypeColors[ct.baseType] || ''} text-[10px] px-1.5 py-0 mr-2`}>{ct.baseType}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{ct.count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
