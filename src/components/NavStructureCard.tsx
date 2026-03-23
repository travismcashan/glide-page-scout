import { useState } from 'react';
import { ChevronRight, ChevronDown, ExternalLink, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type NavItem = {
  label: string;
  url?: string | null;
  children?: NavItem[];
};

type NavStructureData = {
  items: NavItem[];
  totalLinks: number;
};

function NavTreeItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors group ${depth > 0 ? 'ml-4' : ''}`}
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

export function NavStructureCard({ data }: { data: NavStructureData }) {
  if (!data?.items?.length) {
    return (
      <p className="text-sm text-muted-foreground">No navigation structure detected.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5" />
          <span>{data.items.length} top-level items</span>
        </div>
        <span>·</span>
        <span>{data.totalLinks} total links</span>
      </div>

      <div className="border border-border rounded-lg p-2 bg-muted/20">
        {data.items.map((item, idx) => (
          <NavTreeItem key={`${item.label}-${idx}`} item={item} depth={0} />
        ))}
      </div>
    </div>
  );
}
