import { useMemo, useState, useEffect } from 'react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { PageTagsMap } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

type NavItem = { label: string; url?: string | null; children?: NavItem[] };
type NavStructure = { primary?: NavItem[]; secondary?: NavItem[]; footer?: NavItem[] } | null;

interface Props {
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
  navStructure?: NavStructure;
  globalInnerExpand?: boolean | null;
}

/** Count unique URLs from nav items (top-level only, not children) */
function countNavUrls(items: NavItem[] | undefined): number {
  if (!items) return 0;
  const urls = new Set<string>();
  for (const item of items) {
    if (item.url) urls.add(item.url.replace(/\/$/, ''));
  }
  return urls.size;
}

/** Count unique URLs from children of nav items (second level) */
function countNavChildUrls(items: NavItem[] | undefined): number {
  if (!items) return 0;
  const urls = new Set<string>();
  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        if (child.url) urls.add(child.url.replace(/\/$/, ''));
      }
    }
  }
  return urls.size;
}

export function RedesignEstimateCard({ pageTags, contentTypesData, navStructure, globalInnerExpand = null }: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (globalInnerExpand === true) {
      setCollapsedSections(new Set());
    } else if (globalInnerExpand === false) {
      setCollapsedSections(new Set(['base-types', 'page-types']));
    }
  }, [globalInnerExpand]);

  const { baseTypeCounts, totalPages, primaryPages, secondaryPages, tertiaryPages } = useMemo(() => {
    const counts: Record<string, number> = { Page: 0, Post: 0, CPT: 0, Archive: 0, Search: 0 };

    if (pageTags) {
      for (const [, tag] of Object.entries(pageTags)) {
        const bt = tag.baseType || 'Page';
        counts[bt] = (counts[bt] || 0) + 1;
      }
    }

    const total = pageTags ? Object.keys(pageTags).length : 0;

    // Derive page types from nav structure
    const primary = countNavUrls(navStructure?.primary);
    const secondary = countNavChildUrls(navStructure?.primary);
    const tertiary = Math.max(0, total - primary - secondary);

    return {
      baseTypeCounts: Object.entries(counts).filter(([, c]) => c > 0),
      totalPages: total,
      primaryPages: primary,
      secondaryPages: secondary,
      tertiaryPages: tertiary,
    };
  }, [pageTags, navStructure]);

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

  const pageTypes = [
    { label: 'Primary', count: primaryPages, desc: 'Custom designed, top-level nav pages' },
    { label: 'Secondary', count: secondaryPages, desc: 'Sub-navigation pages off primary nav' },
    { label: 'Tertiary', count: tertiaryPages, desc: 'Supporting & footer-only pages' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <MetaStat value={totalPages} label="Total URLs" />
        <MetaStatDivider />
        <MetaStat value={primaryPages} label="Primary" />
        <MetaStatDivider />
        <MetaStat value={secondaryPages} label="Secondary" />
        <MetaStatDivider />
        <MetaStat value={tertiaryPages} label="Tertiary" />
      </div>

      {/* Unified container with collapsible sections */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Type</span>
          <span className="text-xs font-medium text-muted-foreground">Count</span>
        </div>

        {/* Page Types section */}
        <button
          onClick={() => toggleSection('page-types')}
          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        >
          {collapsedSections.has('page-types')
            ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          }
          <span className="text-xs font-semibold text-foreground">Page Types</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{totalPages}</Badge>
        </button>
        {!collapsedSections.has('page-types') && (
          <div>
            {pageTypes.map((pt) => (
              <div key={pt.label} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                <span className="text-xs font-mono leading-5 text-muted-foreground flex-1" title={pt.desc}>{pt.label}</span>
                <span className="text-xs text-muted-foreground font-mono">{pt.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Base Types section */}
        <button
          onClick={() => toggleSection('base-types')}
          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
        >
          {collapsedSections.has('base-types')
            ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          }
          <span className="text-xs font-semibold text-foreground">Base Types</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{totalPages}</Badge>
        </button>
        {!collapsedSections.has('base-types') && (
          <div>
            {baseTypeCounts.map(([type, count]) => (
              <div key={type} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors">
                <span className="text-xs font-mono leading-5 text-muted-foreground flex-1">{type === 'Archive' ? 'Taxonomy' : type}</span>
                <span className="text-xs text-muted-foreground font-mono">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
