import { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink, Navigation, Menu, PanelTop, Copy, FileText, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PageTemplateBadge } from '@/components/PageTemplateBadge';
import { getPageTag, type PageTagsMap } from '@/lib/pageTags';

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

  if (primary.length > 0) {
    sections.push(`## Primary Navigation\n\n${itemsToMarkdown(primary)}`);
  }

  if (secondary.length > 0) {
    sections.push(`## Secondary Navigation\n\n${itemsToMarkdown(secondary)}`);
  }

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

  if (primary.length > 0) {
    sections.push(`<h3>Primary Navigation</h3><ul>${itemsToHtml(primary)}</ul>`);
  }

  if (secondary.length > 0) {
    sections.push(`<h3>Secondary Navigation</h3><ul>${itemsToHtml(secondary)}</ul>`);
  }

  if (footer.length > 0) {
    sections.push(`<h3>Footer Navigation (unique pages)</h3><ul>${itemsToHtml(footer)}</ul>`);
  } else {
    sections.push(`<h3>Footer Navigation</h3><p><em>No unique footer links — all footer items match the header navigation.</em></p>`);
  }

  return `<h2>Site Navigation Structure</h2>${sections.join('')}`;
}

// ── Components ──

function NavTreeItem({ item, depth = 0, pageTags, onPageTagChange }: { item: NavItem; depth?: number; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children && item.children.length > 0;
  const pageTag = item.url ? getPageTag(pageTags, item.url) : undefined;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="p-0.5 rounded hover:bg-muted">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4.5" />
        )}

        <span className={`text-sm ${depth === 0 ? 'font-medium' : 'text-muted-foreground'}`}>{item.label}</span>

        {hasChildren && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{item.children!.length}</Badge>
        )}

        {item.url && (
          <PageTemplateBadge
            tag={pageTag}
            onChange={onPageTagChange ? (t, v) => onPageTagChange(item.url!, t, v) : undefined}
            onLabelChange={onPageLabelChange ? (l) => onPageLabelChange(item.url!, l) : undefined}
            readOnly={!onPageTagChange}
          />
        )}

        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
            onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child, idx) => (
            <NavTreeItem key={`${child.label}-${idx}`} item={child} depth={depth + 1} pageTags={pageTags} onPageTagChange={onPageTagChange} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavSection({ title, icon, items, emptyText, pageTags, onPageTagChange }: { title: string; icon: React.ReactNode; items: NavItem[]; emptyText?: string; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void }) {
  if (!items.length && !emptyText) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">{items.length}</Badge>
      </div>
      {items.length > 0 ? (
        <div className="border border-border rounded-lg p-2 bg-muted/20">
          {items.map((item, idx) => (
            <NavTreeItem key={`${item.label}-${idx}`} item={item} depth={0} pageTags={pageTags} onPageTagChange={onPageTagChange} />
          ))}
        </div>
      ) : emptyText ? (
        <p className="text-xs text-muted-foreground italic pl-6">{emptyText}</p>
      ) : null}
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

export function NavStructureCard({ data, pageTags, onPageTagChange }: { data: NavStructureData; pageTags?: PageTagsMap | null; onPageTagChange?: (url: string, template: string) => void }) {
  const [copiedFormat, setCopiedFormat] = useState<'md' | 'rich' | null>(null);
  const primary = data.primary || data.items || [];
  const secondary = data.secondary || [];
  const footer = data.footer || [];

  if (!primary.length && !secondary.length && !footer.length) {
    return <p className="text-sm text-muted-foreground">No navigation structure detected.</p>;
  }

  const totalCount = data.totalLinks || (countLinks(primary) + countLinks(secondary) + countLinks(footer));

  const copyMarkdown = async () => {
    const md = toMarkdown(primary, secondary, footer);
    await navigator.clipboard.writeText(md);
    setCopiedFormat('md');
    toast.success('Markdown copied to clipboard');
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const copyRichText = async () => {
    const html = toHtml(primary, secondary, footer);
    const plainText = toMarkdown(primary, secondary, footer);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
      setCopiedFormat('rich');
      toast.success('Rich text copied — paste into Word or Google Docs');
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      // Fallback for browsers that don't support ClipboardItem
      await navigator.clipboard.writeText(plainText);
      setCopiedFormat('md');
      toast.success('Copied as plain text (rich text not supported in this browser)');
      setTimeout(() => setCopiedFormat(null), 2000);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{totalCount} total unique links</span>
          {primary.length > 0 && <span>· {countLinks(primary)} primary</span>}
          {secondary.length > 0 && <span>· {countLinks(secondary)} secondary</span>}
          {footer.length > 0 && <span>· {countLinks(footer)} footer-only</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={copyMarkdown} className="h-7 text-xs gap-1.5">
            {copiedFormat === 'md' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={copyRichText} className="h-7 text-xs gap-1.5">
            {copiedFormat === 'rich' ? <Check className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            Rich Text
          </Button>
        </div>
      </div>

      <NavSection title="Primary Navigation" icon={<Navigation className="h-3.5 w-3.5 text-muted-foreground" />} items={primary} pageTags={pageTags} onPageTagChange={onPageTagChange} />

      {secondary.length > 0 && (
        <NavSection title="Secondary Navigation" icon={<PanelTop className="h-3.5 w-3.5 text-muted-foreground" />} items={secondary} pageTags={pageTags} onPageTagChange={onPageTagChange} />
      )}

      <NavSection
        title="Footer Only (unique pages)"
        icon={<Menu className="h-3.5 w-3.5 text-muted-foreground" />}
        items={footer}
        emptyText="No unique footer links — all footer items match the header navigation."
        pageTags={pageTags}
        onPageTagChange={onPageTagChange}
       
      />
    </div>
  );
}
