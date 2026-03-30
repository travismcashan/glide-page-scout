import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Returns true if any crawl session is currently running (status = 'analyzing') */
export function useActiveCrawl(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { count } = await supabase
        .from('crawl_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'analyzing');
      if (mounted) setActive((count ?? 0) > 0);
    };

    check();
    const interval = setInterval(check, 10000);

    // Also listen for realtime changes
    const channel = supabase
      .channel('active-crawl-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crawl_sessions' }, () => {
        check();
      })
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return active;
}
