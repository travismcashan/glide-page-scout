import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

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
};

export function SitemapCard({ data, globalInnerExpand = null }: Props) {
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
          <span><strong className="text-foreground">{stats.sitemapsFound}</strong> Sitemap{stats.sitemapsFound !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span><strong className="text-foreground">{stats.totalUrls.toLocaleString()}</strong> Total URLs</span>
          {stats.contentTypeHintsCount > 0 && (
            <>
              <span>·</span>
              <span><strong className="text-foreground">{stats.contentTypeHintsCount}</strong> Content Type Hint{stats.contentTypeHintsCount !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      )}

      {/* Sitemap tree */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Sitemap</span>
          <span className="w-[80px] text-center text-xs font-medium text-muted-foreground">Label</span>
          <span className="w-[70px] text-right text-xs font-medium text-muted-foreground">URLs</span>
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
            <div key={group.sitemapUrl} className="border-b border-border last:border-0">
              <button
                onClick={() => toggleGroup(group.sitemapUrl)}
                className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="text-xs font-semibold text-foreground flex-1 truncate">{filename}</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{group.urls.length}</Badge>
              </button>
              {isExpanded && (
                <div className="max-h-[200px] overflow-y-auto border-t border-border bg-card">
                  {group.urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-6 py-1 text-xs font-mono leading-5 text-muted-foreground hover:text-primary hover:underline hover:bg-muted/20 transition-colors border-t border-border/50 first:border-t-0"
                    >
                      <span className="truncate flex-1">{url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
