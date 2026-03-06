import { useState, useEffect, lazy, Suspense } from 'react';
const ReactMarkdown = lazy(() => import('react-markdown'));
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, ExternalLink, ChevronDown, ChevronUp, Loader2, Zap, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api/firecrawl';
import { supabase } from '@/integrations/supabase/client';
import { isIntegrationPaused } from '@/lib/integrationState';
import { UrlSelectionList, type UrlEntry } from '@/components/UrlSelectionList';

type ContentPage = {
  id: string;
  url: string;
  title: string | null;
  raw_content: string | null;
  ai_outline: string | null;
  status: string;
};

type Props = {
  pages: ContentPage[];
  sessionId: string;
  baseUrl: string;
  discoveredUrls: string[];
  existingPageUrls: Set<string>;
  onPagesAdded: () => void;
  expandedPages: Set<string>;
  toggleExpand: (id: string) => void;
  generateOutline: (page: ContentPage) => void;
  generatingOutline: Set<string>;
  collapsed?: boolean;
};

export function ContentSectionCard({
  pages, sessionId, baseUrl, discoveredUrls, existingPageUrls, onPagesAdded,
  expandedPages, toggleExpand, generateOutline, generatingOutline, collapsed: controlledCollapsed
}: Props) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [hasOverride, setHasOverride] = useState(false);

  useEffect(() => {
    if (controlledCollapsed !== undefined) setHasOverride(false);
  }, [controlledCollapsed]);

  const isCollapsed = hasOverride ? internalCollapsed : (controlledCollapsed ?? internalCollapsed);
  const paused = isIntegrationPaused('content');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pickerOpen || analysisDone || analyzing || paused || discoveredUrls.length === 0) return;
    setEntries(discoveredUrls.map(u => ({ url: u, isRecommended: false })));
    runAnalysis();
  }, [pickerOpen, discoveredUrls]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await aiApi.recommendPages(baseUrl, discoveredUrls, 'content');
      if (result.success && result.recommendations?.length) {
        const recMap = new Map(result.recommendations.map(r => [r.url, r.reason]));
        setEntries(discoveredUrls.map(u => ({ url: u, reason: recMap.get(u), isRecommended: recMap.has(u) })));
        setSelected(new Set(result.recommendations.map(r => r.url)));
        toast.success(`AI selected ${result.recommendations.length} pages for content`);
      }
    } catch (e) {
      console.error('Content analysis failed:', e);
    }
    setAnalyzing(false);
    setAnalysisDone(true);
  };

  const handleSubmit = async () => {
    const newUrls = Array.from(selected).filter(u => !existingPageUrls.has(u));
    if (newUrls.length === 0) { toast.info('All selected pages already being processed'); return; }
    setSubmitting(true);
    try {
      const rows = newUrls.map(url => ({ session_id: sessionId, url, status: 'pending' }));
      const { error } = await supabase.from('crawl_pages').insert(rows);
      if (error) throw error;
      await supabase.from('crawl_sessions').update({ status: 'crawling' }).eq('id', sessionId);
      toast.success(`Queued ${newUrls.length} pages for content scraping`);
      onPagesAdded();
    } catch (e) { console.error(e); toast.error('Failed to queue content pages'); }
    setSubmitting(false);
  };

  if (paused) return null;

  return (
    <Card className="overflow-hidden">
      <div
        className="px-6 py-4 border-b border-border flex items-center gap-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => { setHasOverride(true); setInternalCollapsed(!isCollapsed); }}
      >
        <div className="p-2 rounded-lg bg-muted">
          <FileText className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Page Content</h2>
        <div className="flex items-center gap-2 ml-auto" onClick={e => e.stopPropagation()}>
          <span className="text-sm text-muted-foreground">{pages.length} pages</span>
          {discoveredUrls.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(!pickerOpen)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Pages
            </Button>
          )}
        </div>
        <div className="shrink-0">
          {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {!isCollapsed && pickerOpen && (
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3">Select business-relevant pages for content scraping</p>
          {analyzing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI is selecting content-rich pages...
            </div>
          ) : discoveredUrls.length > 0 ? (
            <UrlSelectionList
              entries={entries}
              selectedUrls={selected}
              setSelectedUrls={setSelected}
              existingUrls={existingPageUrls}
              existingLabel="Queued"
              onSubmit={handleSubmit}
              submitLabel="Queue Content"
              isSubmitting={submitting}
              isAnalyzing={analyzing}
              analysisDone={analysisDone}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for URL discovery...</p>
          )}
        </div>
      )}

      {!isCollapsed && pages.length > 0 ? (
        <div className="p-4 space-y-3">
          {pages.map(page => {
            const isExpanded = expandedPages.has(page.id);
            return (
              <Collapsible key={page.id} open={isExpanded} onOpenChange={() => toggleExpand(page.id)}>
                <div className="border border-border rounded-lg overflow-hidden">
                  <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{page.title || page.url}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{page.url}</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-3">
                      <div className="flex gap-2">
                        <a href={page.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> Visit</Button>
                        </a>
                        {!page.ai_outline && (
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); generateOutline(page); }} disabled={generatingOutline.has(page.id)}>
                            {generatingOutline.has(page.id) ? (<><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>) : (<><Zap className="h-3 w-3 mr-1" /> Generate AI Outline</>)}
                          </Button>
                        )}
                      </div>
                      <Tabs defaultValue={page.ai_outline ? 'outline' : 'raw'} key={page.ai_outline ? 'has-outline' : 'no-outline'}>
                        <TabsList>
                          <TabsTrigger value="raw">Raw Content</TabsTrigger>
                          {page.ai_outline && <TabsTrigger value="outline">Cleaned Content</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="raw" className="mt-3">
                          <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-primary prose-strong:text-foreground">
                            <Suspense fallback={<pre className="text-sm whitespace-pre-wrap">{page.raw_content}</pre>}>
                              <ReactMarkdown components={{ img: () => null }}>{page.raw_content || ''}</ReactMarkdown>
                            </Suspense>
                          </div>
                        </TabsContent>
                        {page.ai_outline && (
                          <TabsContent value="outline" className="mt-3">
                            <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-a:text-primary prose-strong:text-foreground">
                              <Suspense fallback={<pre className="text-sm whitespace-pre-wrap">{page.ai_outline}</pre>}>
                                <ReactMarkdown components={{ img: () => null }}>{page.ai_outline}</ReactMarkdown>
                              </Suspense>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      ) : !isCollapsed ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No content scraped yet. {discoveredUrls.length > 0 && !pickerOpen && (
            <button onClick={() => setPickerOpen(true)} className="text-primary underline underline-offset-2">Select pages to scrape.</button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
