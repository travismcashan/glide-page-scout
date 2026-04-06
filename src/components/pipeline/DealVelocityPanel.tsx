import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, TrendingUp, Clock, Target, DollarSign, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PIPELINES } from '@/config/pipeline';

interface Deal {
  dealstage: string;
  amount: string | null;
  closedate: string | null;
  createdate: string | null;
}

interface Props {
  deals: Deal[];
  pipelineId: string;
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function DealVelocityPanel({ deals, pipelineId }: Props) {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('deal-velocity-expanded') === 'true'; } catch { return false; }
  });

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem('deal-velocity-expanded', String(next)); } catch {}
  };

  const pipeline = PIPELINES[pipelineId];
  const stages = pipeline?.stages ?? [];
  const openStages = stages.filter(s => !s.closed);
  const wonStageIds = new Set(stages.filter(s => s.outcome === 'won').map(s => s.id));
  const lostStageIds = new Set(stages.filter(s => s.outcome === 'lost').map(s => s.id));

  const metrics = useMemo(() => {
    if (!deals.length) return null;

    // -- Stage distribution (open deals only) --
    const stageMap = new Map<string, { count: number; totalValue: number }>();
    for (const s of openStages) {
      stageMap.set(s.id, { count: 0, totalValue: 0 });
    }
    for (const d of deals) {
      const entry = stageMap.get(d.dealstage);
      if (entry) {
        entry.count++;
        entry.totalValue += Number(d.amount) || 0;
      }
    }
    const stageBreakdown = openStages.map(s => ({
      stage: s.label.replace(/^Follow-Up\s*\/?\s*/i, 'Follow-Up'),
      count: stageMap.get(s.id)?.count ?? 0,
      value: stageMap.get(s.id)?.totalValue ?? 0,
    }));

    // -- Monthly volume (deals created per month, last 12 months) --
    const now = new Date();
    const monthBuckets: { month: string; count: number; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthBuckets.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count: 0,
        value: 0,
      });
    }

    // Include ALL deals (open + closed) for volume trend
    for (const d of deals) {
      const created = d.createdate ? new Date(d.createdate) : null;
      if (!created) continue;
      const monthsAgo = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 12) {
        const idx = 11 - monthsAgo;
        monthBuckets[idx].count++;
        monthBuckets[idx].value += Number(d.amount) || 0;
      }
    }

    // -- Win/loss velocity (closed deals with both dates) --
    let wonCount = 0, lostCount = 0;
    let wonTotalDays = 0, lostTotalDays = 0;
    let wonTotalValue = 0;

    for (const d of deals) {
      const isWon = wonStageIds.has(d.dealstage);
      const isLost = lostStageIds.has(d.dealstage);
      if (!isWon && !isLost) continue;

      if (isWon) {
        wonCount++;
        wonTotalValue += Number(d.amount) || 0;
      } else {
        lostCount++;
      }

      if (d.createdate && d.closedate) {
        const days = (new Date(d.closedate).getTime() - new Date(d.createdate).getTime()) / 86400000;
        if (days > 0) {
          if (isWon) wonTotalDays += days;
          else lostTotalDays += days;
        }
      }
    }

    const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
    const avgWonCycle = wonCount > 0 ? Math.round(wonTotalDays / wonCount) : 0;
    const avgLostCycle = lostCount > 0 ? Math.round(lostTotalDays / lostCount) : 0;
    const avgWonValue = wonCount > 0 ? wonTotalValue / wonCount : 0;

    // -- Deals aging (open deals, days since creation) --
    let agingTotal = 0, agingCount = 0;
    for (const d of deals) {
      if (wonStageIds.has(d.dealstage) || lostStageIds.has(d.dealstage)) continue;
      if (!d.createdate) continue;
      const days = (Date.now() - new Date(d.createdate).getTime()) / 86400000;
      agingTotal += days;
      agingCount++;
    }
    const avgAging = agingCount > 0 ? Math.round(agingTotal / agingCount) : 0;

    return {
      stageBreakdown,
      monthBuckets,
      winRate,
      wonCount,
      lostCount,
      avgWonCycle,
      avgLostCycle,
      avgWonValue,
      avgAging,
    };
  }, [deals, openStages, wonStageIds, lostStageIds]);

  if (!metrics || deals.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={toggle}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <BarChart3 className="h-4 w-4" />
        Deal Velocity Analytics
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {/* Stat cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                <Target className="h-3.5 w-3.5" /> Win Rate
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.winRate}%</p>
              <p className="text-xs text-muted-foreground">{metrics.wonCount}W / {metrics.lostCount}L</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Avg Won Cycle
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.avgWonCycle > 0 ? `${metrics.avgWonCycle}d` : '--'}</p>
              <p className="text-xs text-muted-foreground">Lost avg: {metrics.avgLostCycle > 0 ? `${metrics.avgLostCycle}d` : '--'}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" /> Avg Won Value
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.avgWonValue > 0 ? fmtCurrency(metrics.avgWonValue) : '--'}</p>
              <p className="text-xs text-muted-foreground">{metrics.wonCount} won deals</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Open Deal Age
              </div>
              <p className="text-2xl font-bold mt-1">{metrics.avgAging > 0 ? `${metrics.avgAging}d` : '--'}</p>
              <p className="text-xs text-muted-foreground">avg days in pipeline</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stage distribution */}
            <Card className="p-4">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">Deals by Stage</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.stageBreakdown} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'count') return [value, 'Deals'];
                        return [fmtCurrency(value), 'Value'];
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Monthly volume trend */}
            <Card className="p-4">
              <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">Pipeline Volume (12 Months)</h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.monthBuckets} margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'count') return [value, 'Deals Created'];
                        return [fmtCurrency(value), 'Value'];
                      }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
