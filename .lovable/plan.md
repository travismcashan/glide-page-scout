

## Restore Integration Counts on Sites List

### Why it won't blow up the database
The `integration_runs` table is narrow (no JSONB columns — just UUIDs, text status, and timestamps). Even 28K rows would be under 1MB. We never touch `crawl_sessions` JSONB data.

### What to do

1. **Create a database function** `count_integrations(session_ids uuid[])` that queries `integration_runs` for rows with `status = 'done'`, grouped by `session_id`. Returns `TABLE(session_id uuid, integration_count bigint)`.

2. **No frontend changes needed** — `HistoryPage.tsx` already calls this RPC at line 128 and maps the results. It just silently fails because the function doesn't exist yet.

### Files changed
- **Database migration only** — one new SQL function

### The SQL
```sql
CREATE OR REPLACE FUNCTION public.count_integrations(session_ids uuid[])
RETURNS TABLE(session_id uuid, integration_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT ir.session_id, count(*)::bigint AS integration_count
  FROM public.integration_runs ir
  WHERE ir.session_id = ANY(session_ids)
    AND ir.status = 'done'
  GROUP BY ir.session_id;
$$;
```

