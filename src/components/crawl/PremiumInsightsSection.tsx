import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, BarChart3, Search, Lock, CheckCircle2 } from 'lucide-react';

type PremiumCard = {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  enhances: string;
  hasData: boolean;
  action?: React.ReactNode;
};

type Props = {
  sslLabsData: any;
  ga4Data: any;
  searchConsoleData: any;
  onRunSslLabs?: () => void;
  sslLabsLoading?: boolean;
  ga4Connected?: boolean;
  gscConnected?: boolean;
  /** Full SSL Labs card to render when data exists */
  sslLabsCard?: React.ReactNode;
  /** Full GA4 card to render when data exists */
  ga4Card?: React.ReactNode;
  /** Full Search Console card to render when data exists */
  searchConsoleCard?: React.ReactNode;
};

export function PremiumInsightsSection({
  sslLabsData, ga4Data, searchConsoleData,
  onRunSslLabs, sslLabsLoading,
  ga4Connected, gscConnected,
  sslLabsCard, ga4Card, searchConsoleCard,
}: Props) {
  const hasSsl = !!sslLabsData;
  const hasGa4 = !!ga4Data?.found;
  const hasGsc = !!searchConsoleData?.found;
  const allConnected = hasSsl && hasGa4 && hasGsc;

  // If all premium integrations have data, just render them inline
  if (allConnected) {
    return (
      <div className="space-y-6 mt-14">
        <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Premium Insights
        </h3>
        <div className="space-y-6">
          {sslLabsCard}
          {ga4Card}
          {searchConsoleCard}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-14">
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Premium Insights
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Run additional checks to enhance your site health score. These are optional and not included in the automatic crawl.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* SSL Labs */}
        <Card className={`p-5 ${hasSsl ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <Shield className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">SSL Labs</h4>
              <p className="text-[10px] text-muted-foreground">Enhances Security score</p>
            </div>
            {hasSsl && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            SSL/TLS certificate grade, protocol support, and cipher strength analysis.
          </p>
          {hasSsl ? (
            <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Connected
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={onRunSslLabs} disabled={sslLabsLoading} className="w-full">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              {sslLabsLoading ? 'Running...' : 'Run SSL Scan'}
            </Button>
          )}
        </Card>

        {/* Google Analytics */}
        <Card className={`p-5 ${hasGa4 ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <BarChart3 className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Google Analytics</h4>
              <p className="text-[10px] text-muted-foreground">Enhances Content & UX score</p>
            </div>
            {hasGa4 && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            User engagement metrics — bounce rate, session duration, and traffic sources.
          </p>
          {hasGa4 ? (
            <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Requires client OAuth
            </Badge>
          )}
        </Card>

        {/* Search Console */}
        <Card className={`p-5 ${hasGsc ? 'border-emerald-500/20 bg-emerald-500/[0.02]' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-md bg-muted">
              <Search className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Search Console</h4>
              <p className="text-[10px] text-muted-foreground">Enhances SEO score</p>
            </div>
            {hasGsc && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Google Search performance — clicks, impressions, and indexing status.
          </p>
          {hasGsc ? (
            <Badge variant="outline" className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Requires client OAuth
            </Badge>
          )}
        </Card>
      </div>

      {/* Render connected premium cards below the grid */}
      {(hasSsl || hasGa4 || hasGsc) && (
        <div className="space-y-6 mt-6">
          {hasSsl && sslLabsCard}
          {hasGa4 && ga4Card}
          {hasGsc && searchConsoleCard}
        </div>
      )}
    </div>
  );
}
