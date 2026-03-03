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

const columnLabels: Record<string, string> = {
  Db: 'Database',
  Rk: 'Rank',
  Or: 'Organic Keywords',
  Ot: 'Organic Traffic',
  Oc: 'Organic Cost',
  Ad: 'Paid Keywords',
  At: 'Paid Traffic',
  Ac: 'Paid Cost',
  Sh: 'Semrush Rank',
  Sv: 'Visibility',
};

const keywordLabels: Record<string, string> = {
  Ph: 'Keyword',
  Po: 'Position',
  Nq: 'Volume',
  Cp: 'CPC',
  Tr: 'Traffic %',
  Tc: 'Traffic Cost',
  Co: 'Competition',
  Kd: 'Difficulty',
  Ur: 'URL',
};

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
  const usOverview = data.overview?.find(r => r.Db === 'us') || data.overview?.[0];

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
            { key: 'Or', icon: TrendingUp },
            { key: 'Ot', icon: TrendingUp },
            { key: 'Ad', icon: TrendingUp },
            { key: 'Rk', icon: TrendingUp },
          ].map(({ key }) => (
            <div key={key} className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{columnLabels[key] || key}</p>
              <p className="text-lg font-semibold">{Number(usOverview[key] || 0).toLocaleString()}</p>
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
                  {['Ph', 'Po', 'Nq', 'Kd', 'Tr', 'Cp'].map(col => (
                    <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {keywordLabels[col] || col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.organicKeywords.map((kw, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{kw.Ph}</td>
                    <td className="px-3 py-2">{kw.Po}</td>
                    <td className="px-3 py-2">{Number(kw.Nq || 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{kw.Kd}%</td>
                    <td className="px-3 py-2">{kw.Tr}%</td>
                    <td className="px-3 py-2">${kw.Cp}</td>
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
                  {['Db', 'Rk', 'Or', 'Ot', 'Ad', 'At'].map(col => (
                    <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {columnLabels[col] || col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.overview.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium uppercase">{row.Db}</td>
                    <td className="px-3 py-2">{Number(row.Rk || 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(row.Or || 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(row.Ot || 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(row.Ad || 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{Number(row.At || 0).toLocaleString()}</td>
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
