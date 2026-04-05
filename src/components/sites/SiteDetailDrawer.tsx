import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, ExternalLink, Shield, Gauge, Eye, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { buildSitePath } from '@/lib/sessionSlug';
import { computeOverallScore, scoreToGrade, gradeToColor } from '@/lib/siteScore';

type SiteProps = {
  id: string;
  domain: string;
  created_at: string;
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Performance': <Gauge className="h-3.5 w-3.5" />,
  'SEO': <Search className="h-3.5 w-3.5" />,
  'Security': <Shield className="h-3.5 w-3.5" />,
  'Accessibility': <Eye className="h-3.5 w-3.5" />,
};

export function SiteDetailDrawer({
  site,
  onClose,
}: {
  site: SiteProps | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!site) { setSession(null); return; }
    let cancelled = false;
    setLoading(true);

    supabase
      .from('crawl_sessions')
      .select('id, domain, base_url, status, psi_data, wave_data, ssllabs_data, wappalyzer_data, builtwith_data, detectzestack_data, gtmetrix_data, crux_data, observatory_data, carbon_data, yellowlab_data, semrush_data, created_at')
      .eq('id', site.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setSession(data);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [site?.id]);

  const overallScore = session ? computeOverallScore(session) : null;

  // Extract tech stack from available sources
  const techs: string[] = [];
  if (session?.wappalyzer_data?.technologies) {
    for (const t of session.wappalyzer_data.technologies) {
      if (t.name && !techs.includes(t.name)) techs.push(t.name);
    }
  }
  if (techs.length === 0 && session?.builtwith_data?.grouped) {
    for (const group of Object.values(session.builtwith_data.grouped) as any[]) {
      if (Array.isArray(group)) {
        for (const t of group) {
          if (t.name && !techs.includes(t.name)) techs.push(t.name);
        }
      }
    }
  }
  if (techs.length === 0 && session?.detectzestack_data?.grouped) {
    for (const group of Object.values(session.detectzestack_data.grouped) as any[]) {
      if (Array.isArray(group)) {
        for (const t of group) {
          if (t.name && !techs.includes(t.name)) techs.push(t.name);
        }
      }
    }
  }

  return (
    <Sheet open={!!site} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg p-0 flex flex-col">
        {site && (
          <>
            <div className="flex-1 overflow-y-auto">
              {/* Header */}
              <div className="p-4 bg-muted/30 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Globe className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg leading-tight truncate">{site.domain}</h3>
                    {overallScore && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-2xl font-bold ${gradeToColor(scoreToGrade(overallScore.overall))}`}>
                          {scoreToGrade(overallScore.overall)}
                        </span>
                        <span className="text-sm text-muted-foreground">{overallScore.overall}/100</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Category Scores */}
                  {overallScore && overallScore.categories.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Audit Scores</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {overallScore.categories.map((cat) => {
                          const grade = scoreToGrade(cat.score);
                          return (
                            <div key={cat.label} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-background">
                              <span className="text-muted-foreground shrink-0">{CATEGORY_ICONS[cat.label] || <Gauge className="h-3.5 w-3.5" />}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{cat.label}</p>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-sm font-bold ${gradeToColor(grade)}`}>{grade}</span>
                                  <span className="text-xs text-muted-foreground">{cat.score}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SSL Grade */}
                  {session?.ssllabs_data?.grade && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">SSL Certificate</h4>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Grade: </span>
                        <Badge variant="outline" className={`${session.ssllabs_data.grade.startsWith('A') ? 'bg-green-500/15 text-green-400' : session.ssllabs_data.grade.startsWith('B') ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                          {session.ssllabs_data.grade}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Tech Stack */}
                  {techs.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tech Stack ({techs.length})</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {techs.slice(0, 20).map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                        {techs.length > 20 && (
                          <Badge variant="outline" className="text-[10px]">+{techs.length - 20} more</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {!overallScore && !loading && (
                    <p className="text-sm text-muted-foreground text-center py-8">No audit data available. Run a crawl to generate scores.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t p-3 flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onClose(); navigate(buildSitePath(site.domain, site.created_at, 'raw-data')); }}
                className="gap-1.5 ml-auto"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View Full Audit
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
