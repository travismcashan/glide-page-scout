import { CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Code, Paintbrush } from 'lucide-react';
import { useState } from 'react';
import { CardTabs } from '@/components/CardTabs';

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

function ScoreBox({ label, count, variant }: { label: string; count: number; variant: 'error' | 'warning' | 'info' | 'success' }) {
  const colors = {
    error: count > 0 ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-muted/30',
    warning: count > 0 ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-border bg-muted/30',
    info: 'border-border bg-muted/30',
    success: 'border-green-500/30 bg-green-500/10',
  };
  const textColors = {
    error: count > 0 ? 'text-destructive' : 'text-muted-foreground',
    warning: count > 0 ? 'text-yellow-500' : 'text-muted-foreground',
    info: 'text-blue-400',
    success: 'text-green-400',
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colors[variant]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${textColors[variant]}`}>{count}</p>
    </div>
  );
}

function CollapsibleMessages({ messages, type, label }: { messages: ValidationMessage[]; type: 'error' | 'warning' | 'info'; label: string }) {
  const [open, setOpen] = useState(false);
  if (messages.length === 0) return null;

  const icon = type === 'error' ? <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" /> :
    type === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" /> :
    <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />;

  const borderColor = type === 'error' ? 'border-destructive/20' :
    type === 'warning' ? 'border-yellow-500/20' : 'border-blue-500/20';

  const shown = open ? messages : messages.slice(0, 3);

  return (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {icon}
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{messages.length} issue{messages.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="divide-y divide-border/50">
          {shown.map((msg, i) => {
            const line = msg.lastLine || msg.line;
            return (
              <div key={i} className="px-3 py-2 space-y-1">
                <p className="text-xs text-foreground leading-relaxed">{msg.message}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  {line != null && (
                    <span className="font-mono">
                      Line {line}{msg.lastColumn ? `:${msg.lastColumn}` : ''}
                    </span>
                  )}
                </div>
                {msg.extract && (
                  <pre className="text-[10px] font-mono bg-muted/50 rounded px-2 py-1 overflow-x-auto max-w-full whitespace-pre-wrap break-all text-muted-foreground leading-relaxed">
                    {msg.extract}
                  </pre>
                )}
              </div>
            );
          })}
          {!open && messages.length > 3 && (
            <div className="px-3 py-1.5 text-center">
              <span className="text-[11px] text-muted-foreground">+{messages.length - 3} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ValidationPanel({ errors, warnings, info, valid, apiError }: {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  info?: ValidationMessage[];
  valid: boolean;
  apiError?: string | null;
}) {
  if (apiError) {
    return <p className="text-xs text-destructive py-2">{apiError}</p>;
  }

  if (valid && warnings.length === 0 && (!info || info.length === 0)) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center text-green-400">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">No validation issues found</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && <CollapsibleMessages messages={errors} type="error" label="Errors" />}
      {warnings.length > 0 && <CollapsibleMessages messages={warnings} type="warning" label="Warnings" />}
      {info && info.length > 0 && <CollapsibleMessages messages={info} type="info" label="Info" />}
    </div>
  );
}

export function W3CCard({ data }: { data: W3CData }) {
  const totalErrors = data.html.errorCount + data.css.errorCount;
  const totalWarnings = data.html.warningCount + data.css.warningCount;

  return (
    <div className="space-y-4">
      {/* Summary metric boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ScoreBox label="HTML Errors" count={data.html.errorCount} variant="error" />
        <ScoreBox label="CSS Errors" count={data.css.errorCount} variant="error" />
        <ScoreBox label="Warnings" count={totalWarnings} variant="warning" />
        {data.html.infoCount != null && (
          <ScoreBox label="Info" count={data.html.infoCount} variant="info" />
        )}
      </div>

      {/* Tabbed detail view */}
      <CardTabs
        tabs={[
          {
            value: 'html',
            label: `HTML${data.html.errorCount > 0 ? ` (${data.html.errorCount})` : ''}`,
            icon: <Code className="h-3.5 w-3.5" />,
            content: (
              <ValidationPanel
                errors={data.html.errors}
                warnings={data.html.warnings}
                info={data.html.info}
                valid={data.html.valid}
                apiError={data.html.apiError}
              />
            ),
          },
          {
            value: 'css',
            label: `CSS${data.css.errorCount > 0 ? ` (${data.css.errorCount})` : ''}`,
            icon: <Paintbrush className="h-3.5 w-3.5" />,
            content: (
              <ValidationPanel
                errors={data.css.errors}
                warnings={data.css.warnings}
                valid={data.css.valid}
                apiError={data.css.apiError}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
