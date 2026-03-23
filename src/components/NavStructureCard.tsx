import { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink, Navigation, Menu, PanelTop } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

function NavTreeItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4.5" />
        )}

        <span className={`text-sm ${depth === 0 ? 'font-medium' : 'text-muted-foreground'}`}>
          {item.label}
        </span>

        {hasChildren && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {item.children!.length}
          </Badge>
        )}

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {item.children!.map((child, idx) => (
            <NavTreeItem key={`${child.label}-${idx}`} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavSection({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: NavItem[]; emptyText?: string }) {
  if (!items.length && !emptyText) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
          {items.length}
        </Badge>
      </div>
      {items.length > 0 ? (
        <div className="border border-border rounded-lg p-2 bg-muted/20">
          {items.map((item, idx) => (
            <NavTreeItem key={`${item.label}-${idx}`} item={item} depth={0} />
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

export function NavStructureCard({ data }: { data: NavStructureData }) {
  const primary = data.primary || data.items || [];
  const secondary = data.secondary || [];
  const footer = data.footer || [];

  if (!primary.length && !secondary.length && !footer.length) {
    return (
      <p className="text-sm text-muted-foreground">No navigation structure detected.</p>
    );
  }

  const totalCount = data.totalLinks || (countLinks(primary) + countLinks(secondary) + countLinks(footer));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{totalCount} total unique links</span>
        {primary.length > 0 && <span>· {countLinks(primary)} primary</span>}
        {secondary.length > 0 && <span>· {countLinks(secondary)} secondary</span>}
        {footer.length > 0 && <span>· {countLinks(footer)} footer-only</span>}
      </div>

      {secondary.length > 0 && (
        <NavSection
          title="Secondary Navigation"
          icon={<PanelTop className="h-3.5 w-3.5 text-muted-foreground" />}
          items={secondary}
        />
      )}

      <NavSection
        title="Primary Navigation"
        icon={<Navigation className="h-3.5 w-3.5 text-muted-foreground" />}
        items={primary}
      />

      <NavSection
        title="Footer Only (unique pages)"
        icon={<Menu className="h-3.5 w-3.5 text-muted-foreground" />}
        items={footer}
        emptyText="No unique footer links — all footer items match the header navigation."
      />
    </div>
  );
}
