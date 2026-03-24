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

    // Content types from content_types_data
    const ctList: { type: string; count: number }[] = [];
    if (contentTypesData?.summary) {
      for (const s of contentTypesData.summary) {
        ctList.push({ type: s.type, count: s.count });
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
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Level 1 — Base Types</h4>
        <div className="flex flex-wrap gap-2">
          {baseTypeCounts.map(([type, count]) => (
            <Badge key={type} variant="outline" className={`${baseTypeColors[type] || ''} text-sm px-3 py-1`}>
              {type} <span className="ml-1.5 font-bold">{count}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Level 2 — Unique Templates */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Level 2 — Unique Templates ({totalTemplates})</h4>
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Template</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">Type</th>
                <th className="px-3 py-2 font-medium text-muted-foreground text-right">URLs</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.name} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 font-medium text-foreground">{t.name}</td>
                  <td className="px-3 py-1.5 text-right">
                    {t.baseType && (
                      <Badge variant="outline" className={`${baseTypeColors[t.baseType] || ''} text-[10px] px-1.5 py-0`}>
                        {t.baseType}
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Level 3 — Content Types */}
      {contentTypes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Level 3 — Content Types ({contentTypes.length})</h4>
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Content Type</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">URLs</th>
                </tr>
              </thead>
              <tbody>
                {contentTypes.map((ct) => (
                  <tr key={ct.type} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-1.5 font-medium text-foreground">{ct.type}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{ct.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
