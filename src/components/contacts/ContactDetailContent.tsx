import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Linkedin, Sparkles } from 'lucide-react';
import { ApolloPersonHeader } from '@/components/apollo/ApolloPersonHeader';
import { ApolloContactSection } from '@/components/apollo/ApolloContactSection';
import { ApolloEmploymentSection } from '@/components/apollo/ApolloEmploymentSection';
import { ApolloOrgSection } from '@/components/apollo/ApolloOrgSection';
import { format } from 'date-fns';
import type { ApolloData } from '@/components/apollo/types';

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  seniority: string | null;
  role_type: string | null;
  is_primary: boolean;
  lead_status: string | null;
  lifecycle_stage: string | null;
  enrichment_data: any;
  created_at: string;
};

type Deal = {
  id: string;
  name: string;
  amount: number | null;
  stage: string | null;
  status: string;
  close_date: string | null;
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  'Inbound': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  'Contacting': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Scheduled': 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  'Future Follow-Up': 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

const SENIORITY_COLORS: Record<string, string> = {
  c_suite: 'bg-purple-500/15 text-purple-400',
  vp: 'bg-indigo-500/15 text-indigo-400',
  director: 'bg-blue-500/15 text-blue-400',
  manager: 'bg-teal-500/15 text-teal-400',
  senior: 'bg-green-500/15 text-green-400',
  owner: 'bg-orange-500/15 text-orange-400',
};

const DEAL_STATUS_COLORS: Record<string, string> = {
  won: 'bg-green-500/15 text-green-400',
  lost: 'bg-red-500/15 text-red-400',
  open: 'bg-blue-500/15 text-blue-400',
};

export function ContactDetailContent({
  contact,
  deals,
  dealsLoading,
  companyName,
}: {
  contact: Contact;
  deals?: Deal[];
  dealsLoading?: boolean;
  companyName?: string;
}) {
  const apollo: ApolloData | null = contact.enrichment_data?.apollo || null;
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';

  return (
    <div className="space-y-4">
      {/* Header */}
      {apollo ? (
        <ApolloPersonHeader data={apollo} />
      ) : (
        <div className="p-4 bg-muted/30">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {contact.photo_url ? (
                <img src={contact.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-semibold text-muted-foreground">
                  {(contact.first_name?.[0] || '') + (contact.last_name?.[0] || '') || '?'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg leading-tight">{name}</h3>
                {contact.seniority && (
                  <Badge variant="secondary" className={`text-[10px] capitalize ${SENIORITY_COLORS[contact.seniority] || ''}`}>
                    {contact.seniority.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              {contact.title && <p className="text-sm font-medium text-muted-foreground mt-0.5">{contact.title}</p>}
              {contact.department && <p className="text-xs text-muted-foreground">{contact.department.replace('master_', '')}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Badges row */}
      <div className="px-4 flex flex-wrap gap-1.5">
        {contact.is_primary && <Badge variant="outline" className="text-[10px]">Primary Contact</Badge>}
        {contact.lead_status && (
          <Badge variant="outline" className={`text-[10px] ${LEAD_STATUS_COLORS[contact.lead_status] || ''}`}>
            {contact.lead_status}
          </Badge>
        )}
        {contact.lifecycle_stage && (
          <Badge variant="outline" className="text-[10px] capitalize">{contact.lifecycle_stage}</Badge>
        )}
        {contact.role_type && contact.role_type !== 'other' && (
          <Badge variant="secondary" className="text-[10px] capitalize">{contact.role_type.replace('_', ' ')}</Badge>
        )}
        {companyName && (
          <Badge variant="outline" className="text-[10px]">{companyName}</Badge>
        )}
      </div>

      {/* Contact info */}
      <div className="px-4">
        {apollo ? (
          <ApolloContactSection data={apollo} />
        ) : (
          <div className="space-y-2 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline truncate">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
              </div>
            )}
            {contact.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                  {contact.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')}
                </a>
              </div>
            )}
            {!contact.email && !contact.phone && !contact.linkedin_url && (
              <p className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Use "Enrich" to discover contact details
              </p>
            )}
          </div>
        )}
      </div>

      {/* Employment & Org (Apollo only) */}
      {apollo && (
        <div className="px-4">
          <ApolloEmploymentSection data={apollo} />
          <ApolloOrgSection data={apollo} />
        </div>
      )}

      {/* Deals */}
      {deals && deals.length > 0 && (
        <div className="px-4 border-t pt-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Company Deals ({deals.length})
          </h4>
          <div className="space-y-2">
            {deals.map(deal => (
              <div key={deal.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-background">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{deal.name}</span>
                    <Badge variant="outline" className={`text-[10px] py-0 ${DEAL_STATUS_COLORS[deal.status] || ''}`}>{deal.status}</Badge>
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                    {deal.amount != null && <span className="font-semibold text-foreground">${deal.amount.toLocaleString()}</span>}
                    {deal.close_date && <span>Close: {format(new Date(deal.close_date), 'MMM d, yyyy')}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {dealsLoading && (
        <div className="px-4 text-xs text-muted-foreground">Loading deals...</div>
      )}
    </div>
  );
}
