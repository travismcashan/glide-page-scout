import { useState, forwardRef, useImperativeHandle } from 'react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { ChevronRight, ChevronDown, ExternalLink, Navigation, Menu, PanelTop } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap } from '@/lib/pageTags';

const baseTypeStyles: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

type NavItem = {
  label: string;
  url?: string | null;
  children?: NavItem[];
};

type NavStructureData = {
  primary?: NavItem[];
  secondary?: NavItem[];
  footer?: NavItem[];
  items?: NavItem[]; // backward compat
  totalLinks: number;
};

// ── Markdown generation ──

function itemsToMarkdown(items: NavItem[], depth: number = 0): string {
  const indent = '  '.repeat(depth);
  return items.map(item => {
    const link = item.url ? `[${item.label}](${item.url})` : `**${item.label}**`;
    const line = `${indent}- ${link}`;
    const childLines = item.children?.length ? '\n' + itemsToMarkdown(item.children, depth + 1) : '';
    return line + childLines;
  }).join('\n');
}

function toMarkdown(primary: NavItem[], secondary: NavItem[], footer: NavItem[]): string {
  const sections: string[] = [];
  if (primary.length > 0) sections.push(`## Primary Navigation\n\n${itemsToMarkdown(primary)}`);
  if (secondary.length > 0) sections.push(`## Secondary Navigation\n\n${itemsToMarkdown(secondary)}`);
  if (footer.length > 0) {
    sections.push(`## Footer Navigation (unique pages)\n\n${itemsToMarkdown(footer)}`);
  } else {
    sections.push(`## Footer Navigation\n\n_No unique footer links — all footer items match the header navigation._`);
  }
  return `# Site Navigation Structure\n\n${sections.join('\n\n')}`;
}

// ── Rich text (HTML) generation for clipboard ──

function itemsToHtml(items: NavItem[], depth: number = 0): string {
  const lis = items.map(item => {
    const link = item.url
      ? `<a href="${item.url}">${item.label}</a>`
      : `<strong>${item.label}</strong>`;
    const children = item.children?.length ? `\n<ul>${itemsToHtml(item.children, depth + 1)}</ul>` : '';
    return `<li>${link}${children}</li>`;
  }).join('\n');
  return lis;
}

function toHtml(primary: NavItem[], secondary: NavItem[], footer: NavItem[]): string {
  const sections: string[] = [];
  if (primary.length > 0) sections.push(`<h3>Primary Navigation</h3><ul>${itemsToHtml(primary)}</ul>`);
  if (secondary.length > 0) sections.push(`<h3>Secondary Navigation</h3><ul>${itemsToHtml(secondary)}</ul>`);
  if (footer.length > 0) {
    sections.push(`<h3>Footer Navigation (unique pages)</h3><ul>${itemsToHtml(footer)}</ul>`);
  } else {
    sections.push(`<h3>Footer Navigation</h3><p><em>No unique footer links — all footer items match the header navigation.</em></p>`);
  }
  return `<h2>Site Navigation Structure</h2>${sections.join('')}`;
}

// ── Infer nesting for flat section headers ──

function inferNesting(items: NavItem[]): NavItem[] {
  const result: NavItem[] = [];
  let currentHeader: NavItem | null = null;
  let collecting: NavItem[] = [];

  const flush = () => {
    if (currentHeader && collecting.length > 0) {
      result.push({ ...currentHeader, children: [...(currentHeader.children || []), ...collecting] });
    } else if (currentHeader) {
      result.push(currentHeader);
    }
    currentHeader = null;
    collecting = [];
  };

  for (const item of items) {
    const isHeader = !item.url && (!item.children || item.children.length === 0);
    if (isHeader) {
      flush();
      currentHeader = item;
    } else if (currentHeader) {
      collecting.push(item);
    } else {
      result.push({
        ...item,
        children: item.children ? inferNesting(item.children) : undefined,
      });
    }
  }
  flush();

  return result.map(item => ({
    ...item,
    children: item.children ? inferNesting(item.children) : undefined,
  }));
}

// ── Tree rendering ──

function buildTreePrefix(parentLines: boolean[], isLast: boolean, isFirst: boolean): string {
  let prefix = '';
  for (const showLine of parentLines) {
    prefix += showLine ? '│   ' : '    ';
  }
  if (isFirst && parentLines.length === 0) {
    prefix += isLast ? '─── ' : '┌── ';
  } else {
    prefix += isLast ? '└── ' : '├── ';
  }
  return prefix;
}

function NavTreeItem({ item, depth = 0, isLast = false, isFirst = false, parentLines = [], globalExpand, pageTags, onPageTagChange }: {
  item: NavItem; depth?: number; isLast?: boolean; isFirst?: boolean; parentLines?: boolean[];
  globalExpand?: boolean | null; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void;
}) {
  const defaultExpanded = depth < 2;
  const [localToggle, setLocalToggle] = useState<boolean | null>(null);
  const [lastGlobal, setLastGlobal] = useState<boolean | null | undefined>(globalExpand);
  const hasChildren = item.children && item.children.length > 0;
  const pageTag = item.url ? getPageTag(pageTags, item.url) : undefined;
  const isBold = depth === 0 || hasChildren || !item.url;

  // Reset local override when global signal changes
  if (globalExpand !== lastGlobal) {
    setLastGlobal(globalExpand);
    setLocalToggle(null);
  }

  const expanded = localToggle !== null ? localToggle : globalExpand !== null && globalExpand !== undefined ? globalExpand : defaultExpanded;

  return (
    <div>
      <div className="flex items-center px-3 py-1 hover:bg-muted/20 transition-colors group border-t border-border/50">
        {/* Left: tree + label */}
        <div className="flex items-center flex-1 min-w-0">
          <span className="font-mono text-xs leading-5 text-foreground/50 whitespace-pre select-none shrink-0">
            {buildTreePrefix(parentLines, isLast, isFirst)}
          </span>

          {hasChildren ? (
            <button onClick={() => setLocalToggle(!expanded)} className="p-0.5 rounded hover:bg-muted shrink-0 mr-1">
              {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ) : null}

          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className={`text-xs font-mono leading-5 hover:underline truncate ${isBold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}
              onClick={(e) => e.stopPropagation()}>
              {item.label}
            </a>
          ) : (
            <span className={`text-xs leading-5 truncate ${isBold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
              {item.label}
            </span>
          )}

          {hasChildren && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1.5 shrink-0">{item.children!.length}</Badge>
          )}
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
            {item.url && (
              <PageTemplateBadge
                tag={pageTag}
                onChange={onPageTagChange ? (t) => onPageTagChange(item.url!, t) : undefined}
                readOnly={!onPageTagChange}
                hideBaseType
              />
            )}
          </span>
        </div>

        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary shrink-0"
            onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child, idx) => (
            <NavTreeItem
              key={`${child.label}-${idx}`}
              item={child}
              depth={depth + 1}
              isLast={idx === item.children!.length - 1}
              parentLines={[...parentLines, !isLast]}
              globalExpand={globalExpand}
              pageTags={pageTags}
              onPageTagChange={onPageTagChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countLinks(items: NavItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.url) count++;
    if (item.children) count += countLinks(item.children);
  }
  return count;
}

type SectionDef = {
  key: string;
  title: string;
  icon: React.ReactNode;
  items: NavItem[];
  emptyText?: string;
};

export interface NavStructureCardHandle {
  copyMarkdown: () => Promise<void>;
  copyRichText: () => Promise<void>;
}

type NavStructureCardProps = {
  data: NavStructureData;
  pageTags?: PageTagsMap | null;
  onPageTagChange?: (url: string, template: string) => void;
  globalInnerExpand?: boolean | null;
};

export const NavStructureCard = forwardRef<NavStructureCardHandle, NavStructureCardProps>(
  function NavStructureCard({ data, pageTags, onPageTagChange, globalInnerExpand = null }, ref) {
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    const rawPrimary = data.primary || data.items || [];
    const rawSecondary = data.secondary || [];
    const rawFooter = data.footer || [];

    const primary = inferNesting(rawPrimary);
    const secondary = inferNesting(rawSecondary);
    const footer = inferNesting(rawFooter);

    useImperativeHandle(ref, () => ({
      copyMarkdown: async () => {
        const md = toMarkdown(primary, secondary, footer);
        await navigator.clipboard.writeText(md);
        toast.success('Markdown copied to clipboard');
      },
      copyRichText: async () => {
        const html = toHtml(primary, secondary, footer);
        const plainText = toMarkdown(primary, secondary, footer);
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([plainText], { type: 'text/plain' }),
            }),
          ]);
          toast.success('Rich text copied — paste into Word or Google Docs');
        } catch {
          await navigator.clipboard.writeText(plainText);
          toast.success('Copied as plain text');
        }
      },
    }), [primary, secondary, footer]);

    if (!primary.length && !secondary.length && !footer.length) {
      return <p className="text-sm text-muted-foreground">No navigation structure detected.</p>;
    }

    const totalCount = data.totalLinks || (countLinks(primary) + countLinks(secondary) + countLinks(footer));

    const sections: SectionDef[] = [
      { key: 'primary', title: 'Primary Navigation', icon: <Navigation className="h-3.5 w-3.5 text-muted-foreground" />, items: primary },
      ...(secondary.length > 0 ? [{ key: 'secondary', title: 'Secondary Navigation', icon: <PanelTop className="h-3.5 w-3.5 text-muted-foreground" />, items: secondary }] : []),
      { key: 'footer', title: 'Footer Only (unique pages)', icon: <Menu className="h-3.5 w-3.5 text-muted-foreground" />, items: footer, emptyText: 'No unique footer links — all footer items match the header navigation.' },
    ];

    const toggleSection = (key: string) => {
      setCollapsedSections(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <MetaStat value={totalCount} label="Total Unique Links" />
          {primary.length > 0 && <><MetaStatDivider /><MetaStat value={countLinks(primary)} label="Primary" /></>}
          {secondary.length > 0 && <><MetaStatDivider /><MetaStat value={countLinks(secondary)} label="Secondary" /></>}
          {footer.length > 0 && <><MetaStatDivider /><MetaStat value={countLinks(footer)} label="Footer Only" /></>}
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
            <span className="flex-1 text-xs font-medium text-muted-foreground">URL</span>
            <span className="w-[70px] text-center text-xs font-medium text-muted-foreground">Type</span>
            <span className="w-[120px] text-center text-xs font-medium text-muted-foreground">Template</span>
          </div>

          {sections.map((section) => {
            const isCollapsed = collapsedSections.has(section.key);
            const linkCount = countLinks(section.items);

            return (
              <div key={section.key}>
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  }
                  <span className="text-xs font-semibold text-foreground">{section.title}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{linkCount}</Badge>
                </button>

                {!isCollapsed && (
                  section.items.length > 0 ? (
                    <div>
                      {section.items.map((item, idx) => (
                        <NavTreeItem key={`${section.key}-${item.label}-${idx}`} item={item} depth={0} isFirst={idx === 0} isLast={idx === section.items.length - 1} parentLines={[]} globalExpand={globalInnerExpand} pageTags={pageTags} onPageTagChange={onPageTagChange} />
                      ))}
                    </div>
                  ) : section.emptyText ? (
                    <p className="text-xs text-muted-foreground italic px-3 py-2">{section.emptyText}</p>
                  ) : null
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
