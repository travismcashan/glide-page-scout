import { Badge } from '@/components/ui/badge';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';
import { CardTabs } from '@/components/CardTabs';
import { AlertTriangle, CheckCircle2, XCircle, Code, Star, FileJson, Tag } from 'lucide-react';

type SchemaData = {
  summary: {
    totalSchemas: number;
    jsonLdCount: number;
    microdataCount: number;
    rdfaCount: number;
    detectedTypes: string[];
    errorCount: number;
    warningCount: number;
    eligibleRichResults: string[];
  };
  jsonLd: any[];
  microdata: any[];
  rdfa: any[];
  errors: any[];
  warnings: any[];
};

export function SchemaCard({ data }: { data: SchemaData }) {
  const { summary } = data;
  const hasSchemas = summary.totalSchemas > 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-4 flex-wrap">
        {hasSchemas ? (
          <MetaStat value={summary.totalSchemas} label={summary.totalSchemas !== 1 ? 'Schemas Found' : 'Schema Found'} />
        ) : (
          <span className="text-destructive text-xs"><strong>No Structured Data Found</strong></span>
        )}
        {summary.jsonLdCount > 0 && (
          <><MetaStatDivider /><MetaStat value={summary.jsonLdCount} label="JSON-LD" /></>
        )}
        {summary.microdataCount > 0 && (
          <><MetaStatDivider /><MetaStat value={summary.microdataCount} label="Microdata" /></>
        )}
        {summary.rdfaCount > 0 && (
          <><MetaStatDivider /><MetaStat value={summary.rdfaCount} label="RDFa" /></>
        )}
        {summary.errorCount > 0 && (
          <><MetaStatDivider /><span className="text-destructive text-xs"><strong>{summary.errorCount}</strong> Error{summary.errorCount !== 1 ? 's' : ''}</span></>
        )}
        {summary.warningCount > 0 && (
          <><MetaStatDivider /><span className="text-yellow-600 dark:text-yellow-400 text-xs"><strong>{summary.warningCount}</strong> Warning{summary.warningCount !== 1 ? 's' : ''}</span></>
        )}
      </div>

      {!hasSchemas && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground">No structured data detected</p>
          <p className="text-xs text-muted-foreground">
            Adding JSON-LD schema markup can improve search visibility with rich results like FAQ snippets, star ratings, breadcrumbs, and more.
          </p>
        </div>
      )}

      {hasSchemas && (
        <CardTabs tabs={[
          {
            value: 'overview',
            label: 'Overview',
            icon: <Star className="h-3.5 w-3.5" />,
            content: <OverviewTab summary={summary} />,
          },
          {
            value: 'json-ld',
            label: `JSON-LD (${summary.jsonLdCount})`,
            icon: <Code className="h-3.5 w-3.5" />,
            content: <JsonLdTab blocks={data.jsonLd} />,
            visible: summary.jsonLdCount > 0,
          },
          {
            value: 'microdata',
            label: `Microdata (${summary.microdataCount})`,
            icon: <Tag className="h-3.5 w-3.5" />,
            content: <MicrodataTab items={data.microdata} />,
            visible: summary.microdataCount > 0,
          },
          {
            value: 'issues',
            label: `Issues (${summary.errorCount + summary.warningCount})`,
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            content: <IssuesTab errors={data.errors} warnings={data.warnings} />,
            visible: summary.errorCount + summary.warningCount > 0,
          },
        ]} />
      )}
    </div>
  );
}

function OverviewTab({ summary }: { summary: SchemaData['summary'] }) {
  return (
    <div className="space-y-4">
      {/* Detected types */}
      {summary.detectedTypes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Detected Schema Types</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.detectedTypes.map(t => (
              <Badge key={t} variant="outline" className="text-xs font-mono">{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Rich results eligibility */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Google Rich Results Eligibility</p>
        {summary.eligibleRichResults.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {summary.eligibleRichResults.map(r => (
              <Badge key={r} className="gap-1 text-xs bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                <CheckCircle2 className="h-3 w-3" /> {r}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No rich result types eligible — schemas may be incomplete or unsupported.</p>
        )}
      </div>

      {/* Format breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="JSON-LD" value={summary.jsonLdCount} />
        <Stat label="Microdata" value={summary.microdataCount} />
        <Stat label="RDFa" value={summary.rdfaCount} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function JsonLdTab({ blocks }: { blocks: any[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
            <Code className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">
              {block.parseError
                ? 'Invalid JSON-LD'
                : (block['@type'] || (block['@graph'] ? 'Graph' : 'Schema')) + (block['@type'] ? '' : '')}
            </span>
            {block.parseError && <Badge variant="destructive" className="text-[10px]">Parse Error</Badge>}
          </div>
          <pre className="p-3 text-xs font-mono overflow-x-auto max-h-64 bg-muted/20">
            {block.parseError
              ? block.raw || block.parseError
              : JSON.stringify(block, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

function MicrodataTab({ items }: { items: any[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium font-mono">{item.type}</span>
          </div>
          {item.properties?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.properties.map((p: string) => (
                <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function IssuesTab({ errors, warnings }: { errors: any[]; warnings: any[] }) {
  return (
    <div className="space-y-2">
      {errors.map((e, i) => (
        <div key={`e-${i}`} className="flex gap-2 items-start rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{e.message}</p>
            {e.schemaType && <p className="text-xs text-muted-foreground mt-0.5">Schema: {e.schemaType} · Block #{e.block}</p>}
          </div>
        </div>
      ))}
      {warnings.map((w, i) => (
        <div key={`w-${i}`} className="flex gap-2 items-start rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{w.message}</p>
            {w.schemaType && <p className="text-xs text-muted-foreground mt-0.5">Schema: {w.schemaType} · Block #{w.block}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
