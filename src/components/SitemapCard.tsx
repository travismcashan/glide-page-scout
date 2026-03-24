import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap } from '@/lib/pageTags';

const baseTypeStyles: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

type SitemapGroup = {
  sitemapUrl: string;
  label: string;
  urls: string[];
};

type SitemapData = {
  success: boolean;
  found?: boolean;
  urls?: string[];
  groups?: SitemapGroup[];
  contentTypeHints?: { label: string; urls: string[]; sitemapUrl: string }[];
  stats?: { totalUrls: number; sitemapsFound: number; contentTypeHintsCount: number };
};

type Props = {
  data: SitemapData;
  globalInnerExpand?: boolean | null;
  pageTags?: PageTagsMap | null;
  onPageTagChange?: (url: string, template: string) => void;
};

export function SitemapCard({ data, globalInnerExpand = null, pageTags, onPageTagChange }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (globalInnerExpand === true) {
      setExpandedGroups(new Set((data.groups || []).map(g => g.sitemapUrl)));
    } else if (globalInnerExpand === false) {
      setExpandedGroups(new Set());
    }
  }, [globalInnerExpand, data.groups]);

  if (!data.found) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No XML sitemap found for this domain. The site may not have one, or it may be at a non-standard path.
      </p>
    );
  }

  const groups = data.groups || [];
  const stats = data.stats;

  const toggleGroup = (sitemapUrl: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(sitemapUrl)) next.delete(sitemapUrl);
      else next.add(sitemapUrl);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      {stats && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span><strong className="text-foreground text-sm">{stats.sitemapsFound}</strong> Sitemap{stats.sitemapsFound !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span><strong className="text-foreground text-sm">{stats.totalUrls.toLocaleString()}</strong> Total URLs</span>
          {stats.contentTypeHintsCount > 0 && (
            <>
              <span>·</span>
              <span><strong className="text-foreground text-sm">{stats.contentTypeHintsCount}</strong> Content Type Hint{stats.contentTypeHintsCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      )}

      {/* Sitemap tree */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky column header — matches NavStructureCard / UrlDiscoveryCard */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">URL</span>
          <span className="w-[70px] text-center text-xs font-medium text-muted-foreground">Type</span>
          <span className="w-[120px] text-center text-xs font-medium text-muted-foreground">Template</span>
        </div>
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.sitemapUrl);
          const filename = (() => {
            try {
              return new URL(group.sitemapUrl).pathname.split('/').pop() || group.sitemapUrl;
            } catch {
              return group.sitemapUrl;
            }
          })();

          return (
            <div key={group.sitemapUrl}>
              {/* Collapsible section header — matches NavStructureCard sections */}
              <button
                onClick={() => toggleGroup(group.sitemapUrl)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
              >
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                }
                <span className="text-xs font-semibold text-foreground flex-1 truncate">{filename}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{group.urls.length}</Badge>
              </button>
              {isExpanded && (
                <div className="max-h-[200px] overflow-y-auto bg-card">
                  {group.urls.map((url) => {
                    const pageTag = getPageTag(pageTags, url);
                    return (
                      <div key={url} className="flex items-center px-3 py-1 border-t border-border/50 hover:bg-muted/20 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono leading-5 truncate block text-muted-foreground hover:text-primary hover:underline"
                          >
                            {url}
                          </a>
                        </div>
                        <div className="flex items-center gap-0 shrink-0">
                          <span className="w-[70px] flex justify-center">
                            {pageTag?.baseType && (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${baseTypeStyles[pageTag.baseType] || ''}`}>
                                {pageTag.baseType}
                              </Badge>
                            )}
                          </span>
                          <span className="w-[120px] flex justify-center">
                            <PageTemplateBadge
                              tag={pageTag}
                              onChange={onPageTagChange ? (t) => onPageTagChange(url, t) : undefined}
                              readOnly={!onPageTagChange}
                              hideBaseType
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
