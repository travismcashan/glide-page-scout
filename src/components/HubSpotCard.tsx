import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Building2, DollarSign, Mail, Phone, MapPin, Calendar, Briefcase, UserPlus, MessageSquare, PhoneCall, Video, StickyNote, CheckSquare, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { CardTabs } from './CardTabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type HubSpotData = {
  success: boolean;
  domain: string;
  companies: any[];
  contacts: any[];
  deals: any[];
  engagements?: any[];
  formSubmissions?: any[];
  stats: {
    companiesCount: number;
    contactsCount: number;
    dealsCount: number;
    engagementsCount?: number;
    formSubmissionsCount?: number;
  };
};

function CompanyRow({ company }: { company: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left">
        <Card className="p-3 hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium truncate">{company.name || 'Unnamed Company'}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {company.industry && <span>{company.industry}</span>}
                {company.numberofemployees && <span>{company.numberofemployees} employees</span>}
                {company.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.city}{company.state ? `, ${company.state}` : ''}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {company.lifecyclestage && <Badge variant="secondary" className="text-[10px]">{company.lifecyclestage}</Badge>}
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1">
        <Card className="p-4 bg-muted/30 space-y-2 text-xs text-muted-foreground">
          {company.domain && <p><strong>Domain:</strong> {company.domain}</p>}
          {company.annualrevenue && <p><strong>Revenue:</strong> ${Number(company.annualrevenue).toLocaleString()}</p>}
          {company.phone && <p><strong>Phone:</strong> {company.phone}</p>}
          {company.description && <p className="line-clamp-3">{company.description}</p>}
          {company.hs_lead_status && <p><strong>Lead Status:</strong> {company.hs_lead_status}</p>}
          {company.createdate && <p><strong>Created:</strong> {format(new Date(company.createdate), 'MMM d, yyyy')}</p>}
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ContactRow({ contact, onEnrichWithApollo, isPrimary }: { contact: any; onEnrichWithApollo?: (email: string, firstName?: string, lastName?: string) => void; isPrimary?: boolean }) {
  return (
    <Card className={`p-3 ${isPrimary ? 'border-primary/40 bg-primary/5' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{contact.firstname || ''} {contact.lastname || ''}</p>
            {isPrimary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
            {contact.jobtitle && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{contact.jobtitle}</span>}
            {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {contact.lifecyclestage && <Badge variant="secondary" className="text-[10px]">{contact.lifecyclestage}</Badge>}
          {contact.hs_lead_status && <Badge variant="outline" className="text-[10px]">{contact.hs_lead_status}</Badge>}
          {contact.email && onEnrichWithApollo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEnrichWithApollo(contact.email, contact.firstname || undefined, contact.lastname || undefined)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enrich with Apollo</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </Card>
  );
}

function ContactsTab({ contacts, onEnrichWithApollo }: { contacts: any[]; onEnrichWithApollo?: (email: string, firstName?: string, lastName?: string) => void }) {
  if (contacts.length === 0) return <p className="text-sm text-muted-foreground">No contacts found.</p>;

  const sorted = [...contacts].sort((a, b) => {
    const aHasTitle = a.jobtitle ? 1 : 0;
    const bHasTitle = b.jobtitle ? 1 : 0;
    if (bHasTitle !== aHasTitle) return bHasTitle - aHasTitle;
    const aDate = a.lastmodifieddate ? new Date(a.lastmodifieddate).getTime() : 0;
    const bDate = b.lastmodifieddate ? new Date(b.lastmodifieddate).getTime() : 0;
    return bDate - aDate;
  });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground"><strong>{contacts.length}</strong> contact{contacts.length !== 1 ? 's' : ''} found</p>
      {sorted.map((contact, i) => (
        <ContactRow
          key={contact.id}
          contact={contact}
          onEnrichWithApollo={onEnrichWithApollo}
          isPrimary={i === 0}
        />
      ))}
    </div>
  );
}

function DealsTab({ deals }: { deals: any[] }) {
  if (deals.length === 0) return <p className="text-sm text-muted-foreground">No deals found.</p>;

  const totalValue = deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">{deals.length}</p>
          <p className="text-xs text-muted-foreground">Deals</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Value</p>
        </Card>
      </div>
      {deals.map((deal) => (
        <Card key={deal.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{deal.dealname || 'Untitled Deal'}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {deal.amount && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${Number(deal.amount).toLocaleString()}</span>}
                {deal.closedate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Close: {format(new Date(deal.closedate), 'MMM d, yyyy')}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {deal.dealstage && <Badge variant="secondary" className="text-[10px]">{deal.dealstage}</Badge>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const engagementIcon: Record<string, any> = {
  emails: Mail,
  calls: PhoneCall,
  meetings: Video,
  notes: StickyNote,
  tasks: CheckSquare,
};

const engagementLabel: Record<string, string> = {
  emails: 'Email',
  calls: 'Call',
  meetings: 'Meeting',
  notes: 'Note',
  tasks: 'Task',
};

function getEngagementTitle(eng: any): string {
  switch (eng.type) {
    case 'emails': return eng.hs_email_subject || 'No subject';
    case 'calls': return eng.hs_call_title || 'Phone call';
    case 'meetings': return eng.hs_meeting_title || 'Meeting';
    case 'notes': return (eng.hs_note_body || '').replace(/<[^>]*>/g, '').substring(0, 80) || 'Note';
    case 'tasks': return eng.hs_task_subject || 'Task';
    default: return 'Activity';
  }
}

function getEngagementDetail(eng: any): string | null {
  switch (eng.type) {
    case 'emails': {
      const dir = eng.hs_email_direction === 'INCOMING_EMAIL' ? '← Received' : '→ Sent';
      const parts = [dir];
      if (eng.hs_email_sender_email) parts.push(`from ${eng.hs_email_sender_email}`);
      return parts.join(' ');
    }
    case 'calls': {
      const parts: string[] = [];
      if (eng.hs_call_direction) parts.push(eng.hs_call_direction === 'INBOUND' ? '← Inbound' : '→ Outbound');
      if (eng.hs_call_duration) parts.push(`${Math.round(Number(eng.hs_call_duration) / 1000 / 60)}min`);
      if (eng.hs_call_disposition) parts.push(eng.hs_call_disposition);
      return parts.join(' · ') || null;
    }
    case 'meetings': {
      if (eng.hs_meeting_outcome) return eng.hs_meeting_outcome;
      return null;
    }
    case 'tasks': {
      const parts: string[] = [];
      if (eng.hs_task_status) parts.push(eng.hs_task_status);
      if (eng.hs_task_priority) parts.push(`Priority: ${eng.hs_task_priority}`);
      return parts.join(' · ') || null;
    }
    default: return null;
  }
}
function getEngagementBody(eng: any): string | null {
  const strip = (html: string) => html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || null;
  switch (eng.type) {
    case 'emails': return strip(eng.hs_email_text || '');
    case 'calls': return strip(eng.hs_call_body || '');
    case 'meetings': return strip(eng.hs_meeting_body || '');
    case 'notes': return strip(eng.hs_note_body || '');
    case 'tasks': return strip(eng.hs_task_body || '');
    default: return null;
  }
}

function EngagementRow({ eng }: { eng: any }) {
  const [open, setOpen] = useState(false);
  const title = getEngagementTitle(eng);
  const detail = getEngagementDetail(eng);
  const bodyContent = getEngagementBody(eng);
  const hasExpandable = !!bodyContent || (eng.type === 'emails' && (eng.hs_email_to_email || eng.hs_email_sender_email)) || (eng.type === 'meetings' && (eng.hs_meeting_start_time || eng.hs_meeting_end_time));

  return (
    <tr
      className={`border-b border-border text-xs leading-5 ${hasExpandable ? 'hover:bg-muted/20 cursor-pointer' : 'hover:bg-muted/20'}`}
      onClick={() => hasExpandable && setOpen(!open)}
    >
      <td className="px-3 py-1 whitespace-nowrap w-[60px] align-top">
        <span className="text-muted-foreground truncate">{engagementLabel[eng.type] || eng.type}</span>
      </td>
      <td className="px-3 py-1 max-w-0 align-top">
        <div className="flex items-center gap-1.5 truncate">
          {hasExpandable && (open ? <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />)}
          <span className={open ? '' : 'truncate'}>{title}</span>
        </div>
        {open && (
          <div className="mt-1.5 space-y-0.5 text-muted-foreground pb-1">
            {eng.type === 'emails' && eng.hs_email_sender_email && <p><strong>From:</strong> {eng.hs_email_sender_email}</p>}
            {eng.type === 'emails' && eng.hs_email_to_email && <p><strong>To:</strong> {eng.hs_email_to_email}</p>}
            {eng.type === 'meetings' && eng.hs_meeting_start_time && (
              <p><strong>Time:</strong> {format(new Date(eng.hs_meeting_start_time), 'MMM d, yyyy h:mm a')}{eng.hs_meeting_end_time ? ` – ${format(new Date(eng.hs_meeting_end_time), 'h:mm a')}` : ''}</p>
            )}
            {eng.type === 'meetings' && eng.hs_meeting_outcome && <p><strong>Outcome:</strong> {eng.hs_meeting_outcome}</p>}
            {bodyContent && <p className="whitespace-pre-wrap leading-relaxed line-clamp-6">{bodyContent}</p>}
          </div>
        )}
      </td>
      <td className="px-3 py-1 truncate max-w-0 text-muted-foreground align-top">
        {detail || '—'}
      </td>
      <td className="px-3 py-1 whitespace-nowrap text-right text-muted-foreground tabular-nums w-[90px] align-top">
        {eng.hs_timestamp ? format(new Date(eng.hs_timestamp), 'MMM d, yyyy') : '—'}
      </td>
    </tr>
  );
}

function EngagementTypeSection({ type, items }: { type: string; items: any[] }) {
  const [open, setOpen] = useState(true);
  const Icon = engagementIcon[type] || MessageSquare;

  return (
    <>
      <tr
        className="h-7 bg-muted/40 border-b border-border cursor-pointer hover:bg-muted/60"
        onClick={() => setOpen(!open)}
      >
        <td colSpan={4} className="px-3 py-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <Icon className="h-3.5 w-3.5" />
            <span>{engagementLabel[type] || type}s</span>
            <Badge variant="secondary" className="text-[10px] ml-1">{items.length}</Badge>
          </div>
        </td>
      </tr>
      {open && items.map((eng) => <EngagementRow key={eng.id} eng={eng} />)}
    </>
  );
}

function EngagementsTab({ engagements }: { engagements: any[] }) {
  if (engagements.length === 0) return <p className="text-sm text-muted-foreground">No engagement history found.</p>;

  // Group by type, preserving order: notes, meetings, calls, emails, tasks
  const typeOrder = ['notes', 'meetings', 'calls', 'emails', 'tasks'];
  const grouped: Record<string, any[]> = {};
  engagements.forEach(e => {
    if (!grouped[e.type]) grouped[e.type] = [];
    grouped[e.type].push(e);
  });
  const orderedTypes = typeOrder.filter(t => grouped[t]?.length).concat(
    Object.keys(grouped).filter(t => !typeOrder.includes(t))
  );

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted border-b border-border h-7">
              <th className="text-left px-3 py-1 font-medium text-muted-foreground w-[60px]">Type</th>
              <th className="text-left px-3 py-1 font-medium text-muted-foreground">Title</th>
              <th className="text-left px-3 py-1 font-medium text-muted-foreground">Detail</th>
              <th className="text-right px-3 py-1 font-medium text-muted-foreground w-[90px]">Date</th>
            </tr>
          </thead>
          <tbody>
            {orderedTypes.map(type => (
              <EngagementTypeSection key={type} type={type} items={grouped[type]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormSubmissionRow({ sub }: { sub: any }) {
  const [open, setOpen] = useState(false);
  const fields = sub.fields || [];
  const hasContent = fields.length > 0 || sub.pageUrl;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full text-left" disabled={!hasContent}>
        <Card className={`p-3 transition-colors ${hasContent ? 'hover:bg-muted/50 cursor-pointer' : ''}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium truncate">{sub.formTitle}</p>
                {fields.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{fields.length} field{fields.length !== 1 ? 's' : ''}</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {sub.contactName && <span>{sub.contactName}</span>}
                {sub.contactEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{sub.contactEmail}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {sub.timestamp && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {format(new Date(sub.timestamp), 'MMM d, yyyy')}
                </span>
              )}
              {hasContent && (open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
            </div>
          </div>
        </Card>
      </CollapsibleTrigger>
      {hasContent && (
        <CollapsibleContent>
          <Card className="p-3 mt-0.5 bg-muted/30 space-y-2 text-xs text-muted-foreground">
            {sub.pageUrl && (
              <p><strong>Page:</strong>{' '}
                <a href={sub.pageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {sub.pageUrl}
                </a>
              </p>
            )}
            {fields.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Field</th>
                      <th className="text-left px-2.5 py-1.5 font-medium text-muted-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f: any, idx: number) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="px-2.5 py-1.5 font-medium capitalize whitespace-nowrap">{f.name.replace(/_/g, ' ')}</td>
                        <td className="px-2.5 py-1.5 break-all">{f.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function FormSubmissionsTab({ formSubmissions }: { formSubmissions: any[] }) {
  if (formSubmissions.length === 0) return <p className="text-sm text-muted-foreground">No form submissions found.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground"><strong>{formSubmissions.length}</strong> form submission{formSubmissions.length !== 1 ? 's' : ''} found</p>
      {formSubmissions.map((sub, i) => (
        <FormSubmissionRow key={sub.conversionId || i} sub={sub} />
      ))}
    </div>
  );
}

export function HubSpotCard({ data, onEnrichWithApollo }: { data: HubSpotData; onEnrichWithApollo?: (email: string, firstName?: string, lastName?: string) => void }) {
  const engagements = data.engagements || [];
  const formSubmissions = data.formSubmissions || [];

  const tabs = [
    { value: 'contacts', label: `Contacts (${data.stats.contactsCount})`, content: <ContactsTab contacts={data.contacts} onEnrichWithApollo={onEnrichWithApollo} /> },
    { value: 'engagements', label: `Activity (${data.stats.engagementsCount || engagements.length})`, content: <EngagementsTab engagements={engagements} />, visible: engagements.length > 0 || (data.stats.engagementsCount ?? 0) > 0 },
    { value: 'forms', label: `Forms (${data.stats.formSubmissionsCount || formSubmissions.length})`, content: <FormSubmissionsTab formSubmissions={formSubmissions} />, visible: formSubmissions.length > 0 || (data.stats.formSubmissionsCount ?? 0) > 0 },
    { value: 'companies', label: `Companies (${data.stats.companiesCount})`, content: (
      <div className="space-y-2">
        {data.companies.length === 0 ? <p className="text-sm text-muted-foreground">No companies found.</p> : null}
        {data.companies.map((c) => <CompanyRow key={c.id} company={c} />)}
      </div>
    )},
    { value: 'deals', label: `Deals (${data.stats.dealsCount})`, content: <DealsTab deals={data.deals} /> },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        HubSpot CRM data for <strong>{data.domain}</strong>
      </p>
      <CardTabs tabs={tabs} defaultValue="contacts" />
    </div>
  );
}
