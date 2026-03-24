import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap } from '@/lib/pageTags';
import type { ClassifiedUrl } from './types';

export type NavTag = { type: 'primary' | 'secondary' | 'footer'; label: string };

const baseTypeStyles: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

interface ExpandableUrlRowsProps {
  urls: ClassifiedUrl[];
  allTypes: string[];
  onChangeType?: (url: string, newType: string) => void;
  readOnly?: boolean;
  navMap?: Map<string, NavTag[]>;
  pageTags?: PageTagsMap | null;
  onPageTagChange?: (url: string, template: string) => void;
}

export function ExpandableUrlRows({ urls, allTypes, onChangeType, readOnly, navMap, pageTags, onPageTagChange }: ExpandableUrlRowsProps) {
  const INITIAL = 5;
  const STEP = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const visible = urls.slice(0, visibleCount);
  const hasMore = visibleCount < urls.length;
  const remaining = urls.length - visibleCount;

  return (
    <TooltipProvider>
      <div>
        {visible.map((item) => {
          let pathname: string;
          try { pathname = new URL(item.url).pathname; } catch { pathname = item.url; }
          const pageTag = getPageTag(pageTags, item.url);
          return (
            <div key={item.url} className="flex items-center px-3 py-1 hover:bg-muted/20 transition-colors group border-t border-border/50">
              {/* Left: URL */}
              <div className="flex items-center flex-1 min-w-0 gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono leading-5 text-muted-foreground truncate min-w-0 hover:text-primary hover:underline"
                    >
                      {pathname}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-md">
                    <p className="text-xs font-mono break-all">{item.url}</p>
                  </TooltipContent>
                </Tooltip>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Right: Type | Template columns */}
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
                    onChange={onPageTagChange ? (t) => onPageTagChange(item.url, t) : undefined}
                    readOnly={!onPageTagChange}
                    hideBaseType
                  />
                </span>
              </div>

              {!readOnly && onChangeType && (
                <Select
                  value={item.contentType}
                  onValueChange={(val) => onChangeType(item.url, val)}
                >
                  <SelectTrigger className="h-6 text-[10px] w-[140px] shrink-0 px-2 py-0 ml-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allTypes.map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
        {urls.length > INITIAL && (
          <div className="flex items-center gap-3 px-3 py-0.5">
            {hasMore && (
              <button
                onClick={() => setVisibleCount(urls.length)}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-none p-0"
              >
                Show all ({urls.length}) <ChevronDown className="h-3 w-3" />
              </button>
            )}
            {visibleCount > INITIAL && (
              <button
                onClick={() => setVisibleCount(INITIAL)}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-none p-0"
              >
                Show less <ChevronUp className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
