import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap, type PageTemplateType, type PageTemplateVariant } from '@/lib/pageTags';
import type { ClassifiedUrl } from './types';

export type NavTag = { type: 'primary' | 'secondary' | 'footer'; label: string };

const navBadgeClass: Record<string, string> = {
  primary: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  secondary: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  footer: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
};

const navBadgeLabel: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  footer: 'Footer',
};

interface ExpandableUrlRowsProps {
  urls: ClassifiedUrl[];
  allTypes: string[];
  onChangeType?: (url: string, newType: string) => void;
  readOnly?: boolean;
  navMap?: Map<string, NavTag[]>;
  pageTags?: PageTagsMap | null;
  onPageTagChange?: (url: string, template: PageTemplateType, variant?: PageTemplateVariant) => void;
  onPageLabelChange?: (url: string, label: string) => void;
}

export function ExpandableUrlRows({ urls, allTypes, onChangeType, readOnly, navMap, pageTags, onPageTagChange, onPageLabelChange }: ExpandableUrlRowsProps) {
  const INITIAL = 5;
  const STEP = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL);
  const visible = urls.slice(0, visibleCount);
  const hasMore = visibleCount < urls.length;
  const remaining = urls.length - visibleCount;

  return (
    <TooltipProvider>
      <div className="space-y-0.5">
        {visible.map((item) => {
          let pathname: string;
          try { pathname = new URL(item.url).pathname; } catch { pathname = item.url; }
          const navKey = item.url.toLowerCase().replace(/\/$/, '');
          const navTags = navMap?.get(navKey) || [];
          const uniqueNavTypes = [...new Set(navTags.map(t => t.type))];
          const pageTag = getPageTag(pageTags, item.url);
          return (
            <div key={item.url} className="flex items-center gap-2 py-1 px-3 rounded hover:bg-muted/30 group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-muted-foreground truncate flex-1 min-w-0 hover:text-primary hover:underline"
                  >
                    {pathname}
                  </a>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md">
                  <p className="text-xs font-mono break-all">{item.url}</p>
                </TooltipContent>
              </Tooltip>
              <PageTemplateBadge
                tag={pageTag}
                onChange={onPageTagChange ? (t, v) => onPageTagChange(item.url, t, v) : undefined}
                onLabelChange={onPageLabelChange ? (l) => onPageLabelChange(item.url, l) : undefined}
                readOnly={!onPageTagChange}
              />
              {uniqueNavTypes.map((type) => (
                <Badge key={type} variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${navBadgeClass[type]}`}>
                  {navBadgeLabel[type]}
                </Badge>
              ))}
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
                  <SelectTrigger className="h-6 text-[10px] w-[140px] shrink-0 px-2 py-0">
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
        <div className="flex items-center gap-3 px-3">
          {hasMore && (
            <button
              onClick={() => setVisibleCount(prev => Math.min(prev + STEP, urls.length))}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer bg-transparent border-none p-0"
            >
              +{Math.min(remaining, STEP)} more{remaining > STEP ? ` (${remaining} left)` : ''} <ChevronDown className="h-3 w-3" />
            </button>
          )}
          {visibleCount > INITIAL && (
            <button
              onClick={() => setVisibleCount(INITIAL)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5 cursor-pointer bg-transparent border-none p-0"
            >
              Show less <ChevronUp className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
