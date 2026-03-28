import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  showCheckbox?: boolean;
  isIncluded?: boolean;
}

const ROW_LIMIT = 5;

export function ExpandableUrlRows({ urls, allTypes, onChangeType, readOnly, navMap, pageTags, onPageTagChange, showCheckbox = false, isIncluded = true }: ExpandableUrlRowsProps) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = urls.length > ROW_LIMIT;
  const visibleUrls = showAll ? urls : urls.slice(0, ROW_LIMIT);

  return (
    <TooltipProvider>
      <div>
        <div style={{ maxHeight: showAll ? '336px' : `${ROW_LIMIT * 28}px`, overflowY: 'auto' }}>
        {visibleUrls.map((item) => {
          let pathname: string;
          try { pathname = new URL(item.url).pathname; } catch { pathname = item.url; }
          const pageTag = getPageTag(pageTags, item.url);
          return (
            <div key={item.url} className="flex items-center px-3 hover:bg-muted/20 transition-colors group border-t border-border/50" style={{ height: '28px' }}>
              {showCheckbox && (
                <Checkbox checked={isIncluded} disabled className="mr-2 shrink-0" />
              )}
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
                {!readOnly && onChangeType && (
                  <Select
                    value={item.contentType}
                    onValueChange={(val) => onChangeType(item.url, val)}
                  >
                    <SelectTrigger className="h-5 text-[10px] w-[120px] shrink-0 px-2 py-0 opacity-0 group-hover:opacity-100 transition-opacity border-dashed">
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

              {/* Right: Type | Template columns — aligned with all other tables */}
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
            </div>
          );
        })}
        </div>
        {hasMore && (
          <div className="relative">
            {!showAll && (
              <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
            <button
              onClick={() => setShowAll(prev => !prev)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {showAll ? 'Show less' : `Show all ${urls.length}`}
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
