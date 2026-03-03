import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Link2, TrendingUp } from 'lucide-react';

type SemrushCardProps = {
  data: {
    overview?: Record<string, string>[];
    organicKeywords?: Record<string, string>[];
    backlinks?: Record<string, string> | null;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">SEMrush Domain Analysis</span>
      </div>

      {/* Overview stats */}
      {usOverview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Organic Keywords', keys: ['Or', 'Organic Keywords'] },
            { label: 'Organic Traffic', keys: ['Ot', 'Organic Traffic'] },
            { label: 'Paid Keywords', keys: ['Ad', 'Adwords Keywords'] },
            { label: 'Rank', keys: ['Rk', 'Rank'] },
          ].map(({ label, keys }) => (
            <div key={label} className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{Number(getVal(usOverview, ...keys)).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Backlinks summary */}
      {data.backlinks && (
        <div className="flex items-center gap-2 flex-wrap">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Backlinks:</span>
          <Badge variant="secondary">{Number(data.backlinks.total || 0).toLocaleString()} total</Badge>
          <Badge variant="outline">{Number(data.backlinks.domains_num || 0).toLocaleString()} domains</Badge>
          <Badge variant="outline">{Number(data.backlinks.follows_num || 0).toLocaleString()} follow</Badge>
          <Badge variant="outline">{Number(data.backlinks.nofollows_num || 0).toLocaleString()} nofollow</Badge>
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
