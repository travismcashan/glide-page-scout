import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { MetaStat, MetaStatDivider } from '@/components/MetaStat';

interface FormEntry {
  fingerprint: string;
  formType: string;
  description: string;
  platform: string | null;
  isGlobal: boolean;
  pages: string[];
  pageCount: number;
  fieldCount: number;
  fieldTypes: string[];
  fieldNames: string[];
  hasFileUpload: boolean;
  hasCaptcha: boolean;
  method: string;
  action: string;
}

interface FormsSummary {
  totalFormsFound: number;
  uniqueForms: number;
  globalForms: number;
  pagesWithForms: number;
  pagesScraped: number;
  platforms: Record<string, number>;
  formTypes: Record<string, number>;
}

interface FormsData {
  forms: FormEntry[];
  summary: FormsSummary;
}

interface Props {
  data: FormsData;
}

const platformColors: Record<string, string> = {
  HubSpot: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'Gravity Forms': 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  Typeform: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  WPForms: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'Contact Form 7': 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  Mailchimp: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  Calendly: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  Pardot: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  Marketo: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Jotform: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  Native: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
};

const typeColors: Record<string, string> = {
  Contact: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'Quote Request': 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  'Demo/Trial': 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  Newsletter: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  'Login/Auth': 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
  Search: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/30',
  Registration: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  'CTA/Lead Capture': 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  'Booking/Scheduling': 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  'Feedback/Survey': 'bg-teal-500/10 text-teal-600 border-teal-500/30',
};

export function FormsCard({ data }: Props) {
  const [expandedForms, setExpandedForms] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { forms, summary } = data;

  const toggleForm = (idx: number) => {
    setExpandedForms(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const globalForms = forms.filter(f => f.isGlobal);
  const pageForms = forms.filter(f => !f.isGlobal);

  return (
    <div className="space-y-4">
      {/* Meta stats — unified pattern */}
      <div className="flex items-center gap-4 flex-wrap">
        <MetaStat value={summary.uniqueForms} label="Unique Forms" />
        <MetaStatDivider />
        <MetaStat value={summary.globalForms} label="Global Forms" />
        <MetaStatDivider />
        <MetaStat value={summary.uniqueForms - summary.globalForms} label="Page-Specific Forms" />
        <MetaStatDivider />
        <MetaStat value={summary.pagesWithForms} label="Pages with Forms" />
        <MetaStatDivider />
        <MetaStat value={summary.pagesScraped} label="Pages Scanned" />
      </div>

      {/* Div-based card matching other integration cards */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Sticky header — matches Nav/Content/Sitemaps cards */}
        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 flex items-center px-3 py-1.5 border-b border-border">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Form</span>
          <span className="w-[120px] text-center text-xs font-medium text-muted-foreground">Platform</span>
          <span className="w-[45px] text-center text-xs font-medium text-muted-foreground">Fields</span>
          <span className="w-[50px] text-right text-xs font-medium text-muted-foreground">Pages</span>
        </div>

        {/* Global forms section */}
        {globalForms.length > 0 && (
          <div>
            <button
              onClick={() => toggleGroup('global')}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border first:border-t-0"
            >
              {collapsedGroups.has('global')
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              }
              
              <span className="text-xs font-semibold text-foreground">Global Forms</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{globalForms.length}</Badge>
            </button>
            {!collapsedGroups.has('global') && globalForms.map((form, i) => (
              <FormRow key={`g-${i}`} form={form} index={i} isExpanded={expandedForms.has(i)} onToggle={() => toggleForm(i)} />
            ))}
          </div>
        )}

        {/* Page-specific forms */}
        {pageForms.length > 0 && (
          <div>
            <button
              onClick={() => toggleGroup('page')}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left border-t border-border"
            >
              {collapsedGroups.has('page')
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              }
              
              <span className="text-xs font-semibold text-foreground">Page-Specific Forms</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{pageForms.length}</Badge>
            </button>
            {!collapsedGroups.has('page') && pageForms.map((form, i) => {
              const idx = globalForms.length + i;
              return <FormRow key={`p-${i}`} form={form} index={idx} isExpanded={expandedForms.has(idx)} onToggle={() => toggleForm(idx)} />;
            })}
          </div>
        )}

        {forms.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-3 py-6 text-center">No forms detected on scanned pages.</p>
        )}
      </div>

      {/* Platform breakdown below table */}
      {Object.keys(summary.platforms).length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Platforms detected: {Object.entries(summary.platforms)
            .sort(([, a], [, b]) => b - a)
            .map(([platform, count]) => `${platform} (${count})`)
            .join(', ')}
        </p>
      )}
    </div>
  );
}

function FormRow({ form, index, isExpanded, onToggle }: { form: FormEntry; index: number; isExpanded: boolean; onToggle: () => void }) {
  return (
    <div>
      {/* Row — matches height/spacing of other card rows */}
      <div
        className="flex items-center px-3 py-1 hover:bg-muted/20 transition-colors cursor-pointer group border-t border-border/50"
        onClick={onToggle}
      >
        {/* Left: Form name */}
        <div className="flex items-center flex-1 min-w-0 gap-2">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <span className="text-xs font-mono leading-5 text-foreground truncate">{form.formType}</span>
          {form.hasFileUpload && <Badge variant="outline" className="text-[9px] px-1 py-0">📎 upload</Badge>}
          {form.hasCaptcha && <Badge variant="outline" className="text-[9px] px-1 py-0">🛡 captcha</Badge>}
        </div>

        {/* Right columns */}
        <span className="w-[120px] flex justify-center">
          <Badge variant="outline" className={`${platformColors[form.platform || 'Native'] || platformColors.Native} text-[10px] px-1.5 py-0 whitespace-nowrap`}>
            {form.platform || 'Native'}
          </Badge>
        </span>
        <span className="w-[45px] text-center text-xs text-muted-foreground">{form.fieldCount}</span>
        <span className="w-[50px] text-right text-xs text-muted-foreground">{form.pageCount}</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="bg-muted/10 px-3 py-2 ml-8 space-y-2 text-xs border-t border-border/30">
          {form.description && (
            <div>
              <span className="font-medium text-foreground">Description: </span>
              <span className="text-muted-foreground">{form.description}</span>
            </div>
          )}
          {form.fieldNames.length > 0 && (
            <div>
              <span className="font-medium text-foreground">Fields: </span>
              <span className="text-muted-foreground">{form.fieldNames.join(', ')}</span>
            </div>
          )}
          {form.action && form.method !== 'EMBED' && (
            <div>
              <span className="font-medium text-foreground">Action: </span>
              <span className="text-muted-foreground font-mono">{form.method} {form.action || '(self)'}</span>
            </div>
          )}
          <div>
            <span className="font-medium text-foreground">Found on: </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {form.pages.slice(0, 10).map((page, i) => {
                let path: string;
                try { path = new URL(page).pathname; } catch { path = page; }
                return (
                  <a key={i} href={page} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline font-mono inline-flex items-center gap-0.5">
                    {path}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                );
              })}
              {form.pages.length > 10 && <span className="text-muted-foreground text-[11px]">+{form.pages.length - 10} more</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
