import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { PageTagsMap } from '@/lib/pageTags';
import type { ContentTypesData } from '@/components/content-types/types';

const baseTypeColors: Record<string, string> = {
  Page: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Post: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  CPT: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Archive: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

interface Props {
  pageTags: PageTagsMap | null;
  contentTypesData: ContentTypesData | null;
}

function TableSection({ title, columns, rows }: {
  title: string;
  columns: string[];
  rows: { cells: React.ReactNode[] }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              {columns.map((col, i) => (
                <th key={col} className={`px-3 py-2 font-medium text-muted-foreground ${i > 0 ? 'text-right' : ''}`}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
                {row.cells.map((cell, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j === 0 ? 'font-medium text-foreground' : 'text-right text-muted-foreground'}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RedesignEstimateCard({ pageTags, contentTypesData }: Props) {
  const { baseTypeCounts, templates, contentTypes, totalTemplates } = useMemo(() => {
    const counts: Record<string, number> = { Page: 0, Post: 0, CPT: 0, Archive: 0, Search: 0 };
    const templateMap: Record<string, { count: number; baseType?: string }> = {};

    if (pageTags) {
      for (const tag of Object.values(pageTags)) {
        const bt = tag.baseType || 'Page';
        counts[bt] = (counts[bt] || 0) + 1;
        const tmpl = tag.template || 'Unknown';
        if (!templateMap[tmpl]) {
          templateMap[tmpl] = { count: 0, baseType: bt };
        }
        templateMap[tmpl].count++;
      }
    }

    const sortedTemplates = Object.entries(templateMap)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([name, data]) => ({ name, ...data }));

    // Content types: only Post and CPT (matching Repeating Content card)
    const ctList: { type: string; count: number; baseType?: string }[] = [];
    if (contentTypesData?.summary) {
      for (const s of contentTypesData.summary) {
        if (s.baseType === 'Post' || s.baseType === 'CPT') {
          ctList.push({ type: s.type, count: s.count, baseType: s.baseType });
        }
      }
    }

    return {
      baseTypeCounts: Object.entries(counts).filter(([, c]) => c > 0),
      templates: sortedTemplates,
      contentTypes: ctList,
      totalTemplates: sortedTemplates.length,
    };
  }, [pageTags, contentTypesData]);

  if (!pageTags || Object.keys(pageTags).length === 0) {
    return <p className="text-sm text-muted-foreground">No page classification data available yet. Run URL Discovery and Content Types first.</p>;
  }

  const totalPages = Object.keys(pageTags).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold text-foreground">{totalTemplates}</span>
        <span className="text-sm text-muted-foreground">unique templates across</span>
        <span className="text-2xl font-bold text-foreground">{totalPages}</span>
        <span className="text-sm text-muted-foreground">discovered URLs</span>
      </div>

      {/* Level 1 — Base Types */}
      <TableSection
        title="Level 1 — Base Types"
        columns={['Type', 'URLs']}
        rows={baseTypeCounts.map(([type, count]) => ({
          cells: [
            <span className="flex items-center gap-2">
              <Badge variant="outline" className={`${baseTypeColors[type] || ''} text-[10px] px-1.5 py-0`}>{type}</Badge>
              {type}
            </span>,
            count,
          ],
        }))}
      />

      {/* Level 2 — Unique Templates */}
      <TableSection
        title={`Level 2 — Unique Templates (${totalTemplates})`}
        columns={['Template', 'Type', 'URLs']}
        rows={templates.map((t) => ({
          cells: [
            t.name,
            t.baseType ? <Badge variant="outline" className={`${baseTypeColors[t.baseType] || ''} text-[10px] px-1.5 py-0`}>{t.baseType}</Badge> : null,
            t.count,
          ],
        }))}
      />

      {/* Level 3 — Repeating Content Types (Post & CPT only) */}
      {contentTypes.length > 0 && (
        <TableSection
          title={`Level 3 — Repeating Content (${contentTypes.length})`}
          columns={['Content Type', 'Type', 'URLs']}
          rows={contentTypes.map((ct) => ({
            cells: [
              ct.type,
              ct.baseType ? <Badge variant="outline" className={`${baseTypeColors[ct.baseType] || ''} text-[10px] px-1.5 py-0`}>{ct.baseType}</Badge> : null,
              ct.count,
            ],
          }))}
        />
      )}
    </div>
  );
}
