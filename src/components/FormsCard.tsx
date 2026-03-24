import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Globe, FileText } from 'lucide-react';

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
  const { forms, summary } = data;

  const toggleForm = (idx: number) => {
    setExpandedForms(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  // Separate global vs page-specific forms
  const globalForms = forms.filter(f => f.isGlobal);
  const pageForms = forms.filter(f => !f.isGlobal);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        <span><strong className="text-foreground text-sm">{summary.uniqueForms}</strong> Unique Forms</span>
        <span>·</span>
        <span><strong className="text-foreground text-sm">{summary.globalForms}</strong> Global</span>
        <span>·</span>
        <span><strong className="text-foreground text-sm">{summary.pagesWithForms}</strong> Pages with Forms</span>
        <span>·</span>
        <span><strong className="text-foreground text-sm">{summary.pagesScraped}</strong> Pages Scanned</span>
      </div>

      {/* Forms table */}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10 text-left">
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground w-8"></th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-left">Form</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-center w-28">Type</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-center w-28">Platform</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-center w-16">Fields</th>
              <th className="px-3 py-1.5 font-medium text-xs text-muted-foreground text-right w-16">Pages</th>
            </tr>
          </thead>
          <tbody>
            {/* Global forms section */}
            {globalForms.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} className="p-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Global Forms</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{globalForms.length}</Badge>
                    </div>
                  </td>
                </tr>
                {globalForms.map((form, i) => (
                  <FormRow key={`g-${i}`} form={form} index={i} isExpanded={expandedForms.has(i)} onToggle={() => toggleForm(i)} />
                ))}
              </>
            )}

            {/* Page-specific forms */}
            {pageForms.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} className="p-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 border-t border-border">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Page-Specific Forms</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">{pageForms.length}</Badge>
                    </div>
                  </td>
                </tr>
                {pageForms.map((form, i) => {
                  const idx = globalForms.length + i;
                  return <FormRow key={`p-${i}`} form={form} index={idx} isExpanded={expandedForms.has(idx)} onToggle={() => toggleForm(idx)} />;
                })}
              </>
            )}

            {forms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No forms detected on scanned pages.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
    <>
      <tr className="border-t border-border/50 hover:bg-muted/20 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-1 text-center">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground inline-block" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground inline-block" />
          }
        </td>
        <td className="px-3 py-1 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">{form.formType}</span>
            {form.isGlobal && <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20">global</Badge>}
            {form.hasFileUpload && <Badge variant="outline" className="text-[9px] px-1 py-0">📎 upload</Badge>}
            {form.hasCaptcha && <Badge variant="outline" className="text-[9px] px-1 py-0">🛡 captcha</Badge>}
          </div>
        </td>
        <td className="px-3 py-1 text-center">
          <Badge variant="outline" className={`${typeColors[form.formType] || ''} text-[10px] px-1.5 py-0`}>
            {form.formType}
          </Badge>
        </td>
        <td className="px-3 py-1 text-center">
          <Badge variant="outline" className={`${platformColors[form.platform || 'Native'] || platformColors.Native} text-[10px] px-1.5 py-0`}>
            {form.platform || 'Native'}
          </Badge>
        </td>
        <td className="px-3 py-1 text-center text-xs text-muted-foreground">{form.fieldCount}</td>
        <td className="px-3 py-1 text-right text-xs text-muted-foreground">{form.pageCount}</td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr className="bg-muted/10">
          <td></td>
          <td colSpan={5} className="px-3 py-2">
            <div className="space-y-2 text-xs">
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
                      <a key={i} href={page} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline font-mono">
                        {path}
                      </a>
                    );
                  })}
                  {form.pages.length > 10 && <span className="text-muted-foreground text-[11px]">+{form.pages.length - 10} more</span>}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
