import { Loader2, Search } from 'lucide-react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';

type AiSearchData = {
  ai_visibility?: number;
  mentions?: number;
  cited_pages?: number;
  platforms?: {
    name: string;
    mentions: number;
    cited_pages: number;
  }[];
};

type SemrushCardProps = {
  data: {
    overview?: Record<string, string>[];
    organicKeywords?: Record<string, string>[];
    backlinks?: Record<string, string> | null;
    ai_search?: AiSearchData | null;
  } | null;
  isLoading: boolean;
};

// Map both short codes and full names to display labels
const overviewKeyMap: Record<string, string> = {
  Db: 'Database', Database: 'Database',
  Rk: 'Rank', Rank: 'Rank',
  Or: 'Organic Keywords', 'Organic Keywords': 'Organic Keywords',
  Ot: 'Organic Traffic', 'Organic Traffic': 'Organic Traffic',
  Oc: 'Organic Cost', 'Organic Cost': 'Organic Cost',
  Ad: 'Paid Keywords', 'Adwords Keywords': 'Paid Keywords',
  At: 'Paid Traffic', 'Adwords Traffic': 'Paid Traffic',
  Ac: 'Paid Cost', 'Adwords Cost': 'Paid Cost',
  Sh: 'Semrush Rank',
  Sv: 'Visibility',
  As: 'Authority Score', 'Authority Score': 'Authority Score',
};

// Helper to find a value from a row using either short or full key
function getVal(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '0';
}

export function SemrushCard({ data, isLoading }: SemrushCardProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">SEMrush Domain Analysis</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Pulling SEMrush data...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Get US overview row (or first available)
  const usOverview = data.overview?.find(r => (r.Db || r.Database || '').toLowerCase() === 'us') || data.overview?.[0];

  // Authority Score rating
  const authorityScore = usOverview ? Number(getVal(usOverview, 'As', 'Authority Score')) : 0;
  const asRating = authorityScore >= 60 ? 'Great' : authorityScore >= 40 ? 'Good' : authorityScore >= 20 ? 'Fair' : 'Low';
  const asColor = authorityScore >= 60 ? 'text-green-400' : authorityScore >= 40 ? 'text-emerald-400' : authorityScore >= 20 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      {/* SEO Overview */}
      {(usOverview || data.backlinks) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">SEO</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {usOverview && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Authority Score</p>
                <p className="text-lg font-bold tabular-nums">{authorityScore || '—'}</p>
                <p className={`text-xs font-medium ${asColor}`}>{authorityScore ? asRating : ''}</p>
              </div>
            )}
            {usOverview && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Organic Traffic</p>
                <p className="text-lg font-bold tabular-nums">{Number(getVal(usOverview, 'Ot', 'Organic Traffic')).toLocaleString()}</p>
              </div>
            )}
            {usOverview && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Organic Keywords</p>
                <p className="text-lg font-bold tabular-nums">{Number(getVal(usOverview, 'Or', 'Organic Keywords')).toLocaleString()}</p>
              </div>
            )}
            {data.backlinks && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Ref. Domains</p>
                <p className="text-lg font-bold tabular-nums">{Number(data.backlinks.domains_num || 0).toLocaleString()}</p>
              </div>
            )}
            {usOverview && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Paid Traffic</p>
                <p className="text-lg font-bold tabular-nums">{Number(getVal(usOverview, 'At', 'Adwords Traffic')).toLocaleString()}</p>
              </div>
            )}
            {usOverview && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Paid Keywords</p>
                <p className="text-lg font-bold tabular-nums">{Number(getVal(usOverview, 'Ad', 'Adwords Keywords')).toLocaleString()}</p>
              </div>
            )}
            {data.backlinks && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Backlinks</p>
                <p className="text-lg font-bold tabular-nums">{Number(data.backlinks.total || 0).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Search */}
      {data.ai_search && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Search</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">AI Visibility</p>
              <p className="text-lg font-bold tabular-nums">{data.ai_search.ai_visibility ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Mentions</p>
              <p className="text-lg font-bold tabular-nums">{(data.ai_search.mentions ?? 0).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Cited Pages</p>
              <p className="text-lg font-bold tabular-nums">{(data.ai_search.cited_pages ?? 0).toLocaleString()}</p>
            </div>
          </div>
          {data.ai_search.platforms && data.ai_search.platforms.length > 0 && (
            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Platform</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mentions</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cited Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ai_search.platforms.map((p, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 tabular-nums">{p.mentions.toLocaleString()}</td>
                      <td className="px-3 py-2 tabular-nums">{p.cited_pages.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Top keywords table */}
      {data.organicKeywords && data.organicKeywords.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Top Organic Keywords (US)</p>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  {[
                    { label: 'Keyword', keys: ['Ph', 'Keyword'] },
                    { label: 'Position', keys: ['Po', 'Position'] },
                    { label: 'Volume', keys: ['Nq', 'Search Volume'] },
                    { label: 'Difficulty', keys: ['Kd', 'Keyword Difficulty'] },
                    { label: 'Traffic %', keys: ['Tr', 'Traffic (%)'] },
                    { label: 'CPC', keys: ['Cp', 'CPC'] },
                  ].map(({ label }) => (
                    <th key={label} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.organicKeywords.map((kw, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{getVal(kw, 'Ph', 'Keyword')}</td>
                    <td className="px-3 py-2">{getVal(kw, 'Po', 'Position')}</td>
                    <td className="px-3 py-2">{Number(getVal(kw, 'Nq', 'Search Volume')).toLocaleString()}</td>
                    <td className="px-3 py-2">{getVal(kw, 'Kd', 'Keyword Difficulty')}%</td>
                    <td className="px-3 py-2">{getVal(kw, 'Tr', 'Traffic (%)')}%</td>
                    <td className="px-3 py-2">${getVal(kw, 'Cp', 'CPC')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All database overview */}
      {data.overview && data.overview.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            All databases ({data.overview.length})
          </summary>
          <div className="mt-2 overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted">
                  {[
                    { label: 'Database', keys: ['Db', 'Database'] },
                    { label: 'Rank', keys: ['Rk', 'Rank'] },
                    { label: 'Organic KW', keys: ['Or', 'Organic Keywords'] },
                    { label: 'Organic Traffic', keys: ['Ot', 'Organic Traffic'] },
                    { label: 'Paid KW', keys: ['Ad', 'Adwords Keywords'] },
                    { label: 'Paid Traffic', keys: ['At', 'Adwords Traffic'] },
                  ].map(({ label }) => (
                    <th key={label} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.overview.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium uppercase">{getVal(row, 'Db', 'Database')}</td>
                    <td className="px-3 py-2">{Number(getVal(row, 'Rk', 'Rank')).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(getVal(row, 'Or', 'Organic Keywords')).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(getVal(row, 'Ot', 'Organic Traffic')).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(getVal(row, 'Ad', 'Adwords Keywords')).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(getVal(row, 'At', 'Adwords Traffic')).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
