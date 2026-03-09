import { useMemo } from 'react';
import { Image } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildCrawlContext } from '@/lib/buildCrawlContext';

type AttachedDoc = { name: string; content: string };

type PageData = {
  url: string;
  title: string | null;
  ai_outline: string | null;
  raw_content: string | null;
  screenshot_url?: string | null;
};

type SessionData = {
  domain: string;
  base_url: string;
  [key: string]: any;
};

type Props = {
  session: SessionData;
  pages?: PageData[];
  documents: AttachedDoc[];
};

export function ContextPreview({ session, pages, documents }: Props) {
  const context = useMemo(() => buildCrawlContext(session, pages), [session, pages]);
  const totalChars = context.length;
  const estTokens = Math.round(totalChars / 4);
  const docChars = documents.reduce((sum, d) => sum + d.content.length, 0);
  const screenshotCount = (pages || []).filter(p => p.screenshot_url).length;
  const screenshotsIncluded = Math.min(screenshotCount, 10);

  const sections = useMemo(() => {
    const parts: { label: string; content: string; chars: number }[] = [];
    // Split only on our tagged source headers, not arbitrary ## headings in page content
    const sourcePattern = /^## \[Source: (.+?)\]/gm;
    let match: RegExpExecArray | null;
    const matches: { label: string; start: number }[] = [];

    while ((match = sourcePattern.exec(context)) !== null) {
      matches.push({ label: match[1], start: match.index + match[0].length });
    }

    // First section: everything before the first [Source:] tag (header/preamble)
    if (matches.length > 0) {
      const preamble = context.slice(0, matches[0].start - matches[0].label.length - '## [Source: ]'.length).trim();
      if (preamble) {
        const firstLine = preamble.split('\n')[0].replace(/^#+ /, '').trim();
        parts.push({ label: firstLine, content: preamble, chars: preamble.length });
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].start;
      const end = i + 1 < matches.length
        ? context.lastIndexOf('## [Source:', matches[i + 1].start)
        : context.length;
      const content = context.slice(start, end).trim();
      parts.push({ label: matches[i].label, content, chars: content.length });
    }

    return parts;
  }, [context]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Crawl context: <strong className="text-foreground">{totalChars.toLocaleString()}</strong> chars (~{estTokens.toLocaleString()} tokens)</span>
        {docChars > 0 && <span>Attached docs: <strong className="text-foreground">{docChars.toLocaleString()}</strong> chars (~{Math.round(docChars / 4).toLocaleString()} tokens)</span>}
        <span>Combined: ~<strong className="text-foreground">{Math.round((totalChars + docChars) / 4).toLocaleString()}</strong> / 100K tokens</span>
      </div>

      {screenshotsIncluded > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Image className="h-3.5 w-3.5 text-primary" />
          <span><strong className="text-foreground">{screenshotsIncluded}</strong> page screenshot{screenshotsIncluded !== 1 ? 's' : ''} will be sent as images for visual analysis</span>
          {screenshotCount > 10 && <span className="text-muted-foreground/60">(capped at 10 of {screenshotCount})</span>}
        </div>
      )}

      <div className="text-xs space-y-0.5">
        <p className="font-medium text-muted-foreground mb-1">What's included:</p>
        <ul className="space-y-0.5">
          {sections.map((s, i) => {
            const isPassthrough = s.label.includes('Avoma') || s.label.includes('Scraped Page');
            return (
              <li key={i} className="flex items-start gap-1.5">
                <span className={`shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full ${s.chars > 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="text-foreground/80">
                  <strong>{s.label}</strong>
                  <span className="text-muted-foreground ml-1">
                    ({s.chars.toLocaleString()} chars)
                    {isPassthrough && ' — passed in full'}
                    {!isPassthrough && s.chars > 0 && ' — key metrics extracted'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="raw" className="border-0">
          <AccordionTrigger className="py-1 text-[11px] text-muted-foreground hover:no-underline">
            Show raw context
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[300px] rounded border border-border bg-muted/30 p-2">
              <pre className="text-[11px] whitespace-pre-wrap font-mono text-foreground/70">{context}</pre>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
