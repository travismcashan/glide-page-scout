import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OverallScore, CategoryKey } from '@/lib/siteScore';

export type CrawlInsights = {
  executive_summary: string;
  category_insights: Partial<Record<CategoryKey, string>>;
  priority_actions: {
    action: string;
    category: CategoryKey;
    impact: 'high' | 'medium' | 'low';
  }[];
  generated_at: string;
};

export function useCrawlInsights(sessionId: string | null, overallScore: OverallScore | null, allDone: boolean) {
  const [insights, setInsights] = useState<CrawlInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const triggeredRef = useRef(false);

  // Load cached insights from session
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase
        .from('crawl_sessions')
        .select('ai_insights')
        .eq('id', sessionId)
        .single();
      if ((data as any)?.ai_insights) {
        setInsights((data as any).ai_insights as CrawlInsights);
      }
    })();
  }, [sessionId]);

  // Generate insights when crawl completes
  useEffect(() => {
    if (!sessionId || !overallScore || !allDone || insights || loading || triggeredRef.current) return;
    if (overallScore.categories.length === 0) return;
    triggeredRef.current = true;

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-crawl-insights', {
          body: { sessionId, overallScore },
        });

        if (error) throw error;
        if (data?.insights) {
          setInsights(data.insights);
          // Persist to session
          await supabase
            .from('crawl_sessions')
            .update({ ai_insights: data.insights } as any)
            .eq('id', sessionId);
        }
      } catch (e) {
        console.warn('[crawl-insights] Generation failed, using fallback:', e);
        // Fallback: no AI insights, template narrative will be used
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, overallScore, allDone, insights, loading]);

  return { insights, loading };
}
