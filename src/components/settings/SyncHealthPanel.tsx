import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncRun {
  function_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  records_upserted: number;
  records_deleted: number;
  records_skipped: number;
}

const SYNC_FUNCTIONS = [
  { name: 'hubspot-deals-sync', label: 'HubSpot Deals', interval: '30 min', maxAge: 60 },
  { name: 'hubspot-contacts-sync', label: 'HubSpot Contacts', interval: '30 min', maxAge: 60 },
  { name: 'global-sync', label: 'Global Sync', interval: '6 hours', maxAge: 720, body: { action: 'sync' } },
  { name: 'crawl-recover', label: 'Crawl Recover', interval: '5 min', maxAge: 10 },
] as const;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

type HealthStatus = 'healthy' | 'overdue' | 'failed' | 'running' | 'unknown';

function getHealthStatus(run: SyncRun | undefined, maxAgeMinutes: number): HealthStatus {
  if (!run) return 'unknown';
  if (run.status === 'running') return 'running';
  if (run.status === 'failed') return 'failed';
  const ageMs = Date.now() - new Date(run.started_at).getTime();
  if (ageMs > maxAgeMinutes * 60 * 1000) return 'overdue';
  return 'healthy';
}

const STATUS_CONFIG: Record<HealthStatus, { color: string; borderColor: string; icon: typeof CheckCircle2; label: string }> = {
  healthy:  { color: 'text-emerald-600', borderColor: 'border-emerald-500/30', icon: CheckCircle2, label: 'Healthy' },
  overdue:  { color: 'text-amber-600', borderColor: 'border-amber-500/30', icon: AlertTriangle, label: 'Overdue' },
  failed:   { color: 'text-red-600', borderColor: 'border-red-500/30', icon: XCircle, label: 'Failed' },
  running:  { color: 'text-blue-600', borderColor: 'border-blue-500/30', icon: Loader2, label: 'Running' },
  unknown:  { color: 'text-muted-foreground', borderColor: 'border-border', icon: Clock, label: 'No runs' },
};

export function SyncHealthPanel() {
  const [runs, setRuns] = useState<Record<string, SyncRun>>({});
  const [loading, setLoading] = useState(true);
  const [invoking, setInvoking] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    // Get the latest run per function using a query ordered by started_at desc
    // and deduplicating client-side (Supabase doesn't support DISTINCT ON directly)
    const { data, error } = await supabase
      .from('sync_runs')
      .select('function_name, status, started_at, completed_at, duration_ms, error_message, records_upserted, records_deleted, records_skipped')
      .in('function_name', SYNC_FUNCTIONS.map(f => f.name))
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch sync_runs:', error);
      setLoading(false);
      return;
    }

    const latest: Record<string, SyncRun> = {};
    for (const row of data || []) {
      if (!latest[row.function_name]) {
        latest[row.function_name] = row as SyncRun;
      }
    }
    setRuns(latest);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleRunNow = async (functionName: string, body: Record<string, unknown> = {}) => {
    setInvoking(functionName);
    try {
      const { error } = await supabase.functions.invoke(functionName, {
        body: { ...body, source: 'manual' },
      });
      if (error) throw error;
      toast.success(`${functionName} triggered`);
      // Refetch after a short delay to pick up the new running entry
      setTimeout(fetchRuns, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to invoke ${functionName}: ${message}`);
    } finally {
      setInvoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Sync Health
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled sync status and manual triggers. Jobs run automatically via pg_cron.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchRuns} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3">
        {SYNC_FUNCTIONS.map((fn) => {
          const run = runs[fn.name];
          const health = getHealthStatus(run, fn.maxAge);
          const cfg = STATUS_CONFIG[health];
          const Icon = cfg.icon;
          const totalRecords = run ? (run.records_upserted + run.records_deleted + run.records_skipped) : 0;

          return (
            <div
              key={fn.name}
              className={`rounded-lg border ${cfg.borderColor} p-4 flex items-center justify-between gap-4`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`h-5 w-5 shrink-0 ${cfg.color} ${health === 'running' ? 'animate-spin' : ''}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{fn.label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                      every {fn.interval}
                    </Badge>
                  </div>
                  {run ? (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{relativeTime(run.started_at)}</span>
                      <span>{formatDuration(run.duration_ms)}</span>
                      {totalRecords > 0 && (
                        <span>
                          {run.records_upserted > 0 && `${run.records_upserted} upserted`}
                          {run.records_deleted > 0 && ` / ${run.records_deleted} deleted`}
                          {run.records_skipped > 0 && ` / ${run.records_skipped} skipped`}
                        </span>
                      )}
                      {run.error_message && (
                        <span className="text-red-500 truncate max-w-[200px]" title={run.error_message}>
                          {run.error_message}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">No runs recorded yet</p>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={invoking === fn.name}
                onClick={() => handleRunNow(fn.name, 'body' in fn ? fn.body : {})}
              >
                {invoking === fn.name ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run Now
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
