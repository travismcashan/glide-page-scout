import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Building2, Users, DollarSign, Mail, Phone, MapPin, Calendar, Briefcase, UserPlus } from 'lucide-react';
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
  stats: { companiesCount: number; contactsCount: number; dealsCount: number };
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

  // Sort: primary contact (most recent activity or first created) at top
  const sorted = [...contacts].sort((a, b) => {
    // Prefer contacts with job titles (more senior/relevant)
    const aHasTitle = a.jobtitle ? 1 : 0;
    const bHasTitle = b.jobtitle ? 1 : 0;
    if (bHasTitle !== aHasTitle) return bHasTitle - aHasTitle;
    // Then by most recently modified
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

export function HubSpotCard({ data, onEnrichWithApollo }: { data: HubSpotData; onEnrichWithApollo?: (email: string, firstName?: string, lastName?: string) => void }) {
  const tabs = [
    { value: 'contacts', label: `Contacts (${data.stats.contactsCount})`, content: <ContactsTab contacts={data.contacts} onEnrichWithApollo={onEnrichWithApollo} /> },
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
