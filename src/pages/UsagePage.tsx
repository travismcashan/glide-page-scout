import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useModelPricing } from '@/hooks/useCachedQueries';
import { toast } from 'sonner';
import { Activity, Zap, Hash, Clock, AlertTriangle, DollarSign } from 'lucide-react';
import { BrandLoader } from '@/components/BrandLoader';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type UsageRow = {
  day: string;
  provider: string;
  model: string;
  edge_function: string;
  total_calls: number;
  sum_prompt_tokens: number;
  sum_completion_tokens: number;
  sum_total_tokens: number;
  sum_duration_ms: number;
  error_count: number;
};

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  anthropic: '#D97706',
  openai: '#10B981',
  perplexity: '#8B5CF6',
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  anthropic: 'Claude',
  openai: 'OpenAI',
  perplexity: 'Perplexity',
};

type PricingMap = Record<string, [number, number]>;

function estimateCost(pricing: PricingMap, model: string, promptTokens: number, completionTokens: number): number {
  const p = pricing[model];
  if (!p) return 0;
  return (promptTokens / 1_000_000) * p[0] + (completionTokens / 1_000_000) * p[1];
}

function formatCost(cost: number): string {
  if (cost === 0) return '—';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsagePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { pricing } = useModelPricing();
  const [data, setData] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchUsage();
  }, [authLoading, user, range, viewAll]);

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - range);

      const { data: rows, error } = await supabase.rpc('get_usage_summary', {
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_user_id: (isAdmin && viewAll) ? null : user!.id,
      });

      if (error) throw error;
      setData((rows as UsageRow[]) || []);
    } catch (err) {
      console.error('Usage fetch error:', err);
      toast.error('Failed to load usage data');
    }
    setLoading(false);
  };

  // Aggregate stats
  const stats = useMemo(() => {
    const totalTokens = data.reduce((s, r) => s + r.sum_total_tokens, 0);
    const totalCalls = data.reduce((s, r) => s + r.total_calls, 0);
    const totalErrors = data.reduce((s, r) => s + r.error_count, 0);
    const totalDuration = data.reduce((s, r) => s + r.sum_duration_ms, 0);
    const totalCost = data.reduce((s, r) => s + estimateCost(pricing, r.model, r.sum_prompt_tokens, r.sum_completion_tokens), 0);
    const byProvider: Record<string, { tokens: number; calls: number; cost: number }> = {};
    for (const r of data) {
      if (!byProvider[r.provider]) byProvider[r.provider] = { tokens: 0, calls: 0, cost: 0 };
      byProvider[r.provider].tokens += r.sum_total_tokens;
      byProvider[r.provider].calls += r.total_calls;
      byProvider[r.provider].cost += estimateCost(pricing, r.model, r.sum_prompt_tokens, r.sum_completion_tokens);
    }
    return { totalTokens, totalCalls, totalErrors, totalDuration, totalCost, byProvider };
  }, [data, pricing]);

  // Chart data: daily tokens by provider
  const chartData = useMemo(() => {
    const dayMap = new Map<string, Record<string, number>>();
    for (const r of data) {
      const existing = dayMap.get(r.day) || {};
      existing[r.provider] = (existing[r.provider] || 0) + r.sum_total_tokens;
      dayMap.set(r.day, existing);
    }
    const providers = [...new Set(data.map(r => r.provider))].sort();
    return {
      days: Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, providerTokens]) => ({ day: day.slice(5), ...providerTokens })),
      providers,
    };
  }, [data]);

  // Breakdown table: by model + function
  const breakdown = useMemo(() => {
    const groups = new Map<string, { provider: string; model: string; edge_function: string; calls: number; prompt: number; completion: number; total: number; errors: number; cost: number }>();
    for (const r of data) {
      const key = `${r.provider}|${r.model}|${r.edge_function}`;
      const g = groups.get(key) || { provider: r.provider, model: r.model, edge_function: r.edge_function, calls: 0, prompt: 0, completion: 0, total: 0, errors: 0, cost: 0 };
      g.calls += r.total_calls;
      g.prompt += r.sum_prompt_tokens;
      g.completion += r.sum_completion_tokens;
      g.total += r.sum_total_tokens;
      g.errors += r.error_count;
      g.cost += estimateCost(pricing, r.model, r.sum_prompt_tokens, r.sum_completion_tokens);
      groups.set(key, g);
    }
    return Array.from(groups.values()).sort((a, b) => b.cost - a.cost || b.total - a.total);
  }, [data, pricing]);

  return (
    <div>
      <main className="px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Usage</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setViewAll(!viewAll)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${viewAll ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
              >
                {viewAll ? 'All Users' : 'My Usage'}
              </button>
            )}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`text-xs px-3 py-1.5 transition-colors ${range === opt.value ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No usage data yet. AI calls will appear here once edge functions are deployed with tracking.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<DollarSign className="h-4 w-4" />} label="Est. Cost" value={formatCost(stats.totalCost)} />
              <StatCard icon={<Zap className="h-4 w-4" />} label="Total Tokens" value={formatTokens(stats.totalTokens)} />
              <StatCard icon={<Hash className="h-4 w-4" />} label="API Calls" value={stats.totalCalls.toLocaleString()} />
              <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Errors" value={stats.totalErrors.toLocaleString()} />
            </div>

            {/* Provider Breakdown Badges */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byProvider).sort(([,a], [,b]) => b.cost - a.cost || b.tokens - a.tokens).map(([provider, { tokens, calls, cost }]) => (
                <div key={provider} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[provider] || '#888' }} />
                  <span className="text-sm font-medium">{PROVIDER_LABELS[provider] || provider}</span>
                  <Badge variant="secondary" className="text-[10px]">{formatCost(cost)}</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatTokens(tokens)}</Badge>
                  <span className="text-xs text-muted-foreground">{calls} calls</span>
                </div>
              ))}
            </div>

            {/* Chart */}
            {chartData.days.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-muted-foreground mb-4">Daily Token Usage by Provider</h2>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.days} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tickFormatter={formatTokens} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [formatTokens(value), PROVIDER_LABELS[name] || name]}
                      />
                      <Legend formatter={(value: string) => PROVIDER_LABELS[value] || value} />
                      {chartData.providers.map(provider => (
                        <Bar key={provider} dataKey={provider} stackId="tokens" fill={PROVIDER_COLORS[provider] || '#888'} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Breakdown Table */}
            {breakdown.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-muted-foreground">Breakdown by Model & Function</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Provider</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Model</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Function</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Calls</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Prompt</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Completion</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Total</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[row.provider] || '#888' }} />
                              <span className="font-medium">{PROVIDER_LABELS[row.provider] || row.provider}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.model}</td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.edge_function}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{row.calls.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatTokens(row.prompt)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatTokens(row.completion)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">{formatTokens(row.total)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-500">{formatCost(row.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
