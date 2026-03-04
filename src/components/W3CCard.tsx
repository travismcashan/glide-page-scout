import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Code, Paintbrush } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type ValidationMessage = {
  type?: string;
  subType?: string;
  message: string;
  lastLine?: number;
  lastColumn?: number;
  firstLine?: number;
  firstColumn?: number;
  line?: number;
  context?: string | null;
  extract?: string;
  hiliteStart?: number;
  hiliteLength?: number;
  level?: number | null;
};

type W3CData = {
  html: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    errors: ValidationMessage[];
    warnings: ValidationMessage[];
    info: ValidationMessage[];
    apiError?: string | null;
  };
  css: {
    valid: boolean;
    errorCount: number;
    warningCount: number;
    errors: ValidationMessage[];
    warnings: ValidationMessage[];
    apiError?: string | null;
  };
};

function MessageList({ messages, type }: { messages: ValidationMessage[]; type: 'error' | 'warning' | 'info' }) {
  const [expanded, setExpanded] = useState(false);
  if (messages.length === 0) return null;

  const icon = type === 'error' ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
    type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" /> :
    <Info className="h-3.5 w-3.5 text-blue-500" />;

  const shown = expanded ? messages : messages.slice(0, 5);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {shown.map((msg, i) => {
          const line = msg.lastLine || msg.line;
          return (
            <div key={i} className="w-full flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
              <div className="pt-0.5 shrink-0">{icon}</div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs text-foreground">{msg.message}</p>
                <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  {line && <span>Line {line}{msg.lastColumn ? `:${msg.lastColumn}` : ''}</span>}
                  {msg.context && <span className="font-mono truncate max-w-[200px]">{msg.context}</span>}
                </div>
                {msg.extract && (
                  <pre className="text-[10px] font-mono bg-muted/50 rounded px-1.5 py-0.5 overflow-x-auto max-w-full whitespace-pre-wrap break-all text-muted-foreground">
                    {msg.extract}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {messages.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Show less' : `Show all ${messages.length}`}
        </button>
      )}
    </div>
  );
}

function ValidationSummary({ valid, errors, warnings, label }: { valid: boolean; errors: number; warnings: number; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {valid ? (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-500/30">
          <CheckCircle className="h-3 w-3 mr-0.5" /> {label} Valid
        </Badge>
      ) : (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          <XCircle className="h-3 w-3 mr-0.5" /> {errors} error{errors !== 1 ? 's' : ''}
        </Badge>
      )}
      {warnings > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600 border-yellow-500/30">
          <AlertTriangle className="h-3 w-3 mr-0.5" /> {warnings} warning{warnings !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}

export function W3CCard({ data }: { data: W3CData }) {
  return (
    <div className="space-y-4">
      {/* Overall summary */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-muted-foreground" />
          <ValidationSummary valid={data.html.valid} errors={data.html.errorCount} warnings={data.html.warningCount} label="HTML" />
        </div>
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4 text-muted-foreground" />
          <ValidationSummary valid={data.css.valid} errors={data.css.errorCount} warnings={data.css.warningCount} label="CSS" />
        </div>
      </div>

      <Tabs defaultValue="html">
        <TabsList>
          <TabsTrigger value="html" className="text-xs">
            HTML {data.html.errorCount > 0 && <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">{data.html.errorCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="css" className="text-xs">
            CSS {data.css.errorCount > 0 && <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0">{data.css.errorCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="html" className="mt-3 space-y-4">
          {data.html.apiError && (
            <p className="text-xs text-destructive">{data.html.apiError}</p>
          )}
          {data.html.errorCount > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Errors</p>
              <MessageList messages={data.html.errors} type="error" />
            </div>
          )}
          {data.html.warningCount > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Warnings</p>
              <MessageList messages={data.html.warnings} type="warning" />
            </div>
          )}
          {data.html.infoCount > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Info</p>
              <MessageList messages={data.html.info} type="info" />
            </div>
          )}
          {data.html.valid && data.html.warningCount === 0 && (
            <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> No HTML validation issues found.</p>
          )}
        </TabsContent>

        <TabsContent value="css" className="mt-3 space-y-4">
          {data.css.apiError && (
            <p className="text-xs text-destructive">{data.css.apiError}</p>
          )}
          {data.css.errorCount > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Errors</p>
              <MessageList messages={data.css.errors} type="error" />
            </div>
          )}
          {data.css.warningCount > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Warnings</p>
              <MessageList messages={data.css.warnings} type="warning" />
            </div>
          )}
          {data.css.valid && data.css.warningCount === 0 && (
            <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> No CSS validation issues found.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
