import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Megaphone, Crown, Linkedin, Mail, ChevronDown, ChevronUp } from 'lucide-react';

export type TeamContact = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  photoUrl?: string;
  email?: string;
  emailStatus?: string;
  linkedinUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  seniority?: string;
  departments?: string[];
  organizationName?: string;
  organizationLogo?: string;
};

export type ApolloTeamData = {
  success: boolean;
  domain?: string;
  marketing: TeamContact[];
  c_suite: TeamContact[];
  totalFound: number;
  error?: string;
};

type Props = {
  data: ApolloTeamData | null;
  isLoading: boolean;
  onSearch: () => void;
  domain: string | null;
};

function ContactRow({ contact }: { contact: TeamContact }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
      {contact.photoUrl ? (
        <img src={contact.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-border shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {(contact.firstName?.[0] || '?')}{(contact.lastName?.[0] || '')}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium truncate">{contact.name}</span>
          {contact.seniority && (
            <Badge variant="secondary" className="text-[9px] capitalize px-1 py-0">{contact.seniority}</Badge>
          )}
        </div>
        {contact.title && (
          <p className="text-xs text-muted-foreground truncate">{contact.title}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {contact.email && (
          <a href={`mailto:${contact.email}`} title={contact.email} className="text-muted-foreground hover:text-primary transition-colors">
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        {contact.linkedinUrl && (
          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
            <Linkedin className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function ContactGroup({ label, icon, contacts }: { label: string; icon: React.ReactNode; contacts: TeamContact[] }) {
  const [expanded, setExpanded] = useState(true);
  if (contacts.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        {icon}
        {label} ({contacts.length})
        {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {contacts.map(c => <ContactRow key={c.id} contact={c} />)}
        </div>
      )}
    </div>
  );
}

export function ApolloTeamContacts({ data, isLoading, onSearch, domain }: Props) {
  if (!domain) return null;

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Team Discovery
        </h4>
        {!data && !isLoading && (
          <Button variant="outline" size="sm" onClick={onSearch} className="text-xs gap-1.5 h-7">
            <Users className="h-3.5 w-3.5" />
            Find Marketing & C-Suite
          </Button>
        )}
        {isLoading && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </span>
        )}
      </div>

      {data && !data.success && (
        <p className="text-sm text-destructive">{data.error || 'Search failed'}</p>
      )}

      {data && data.success && data.totalFound === 0 && (
        <p className="text-sm text-muted-foreground">No marketing or C-suite contacts found at {data.domain}.</p>
      )}

      {data && data.success && data.totalFound > 0 && (
        <div className="space-y-3">
          <ContactGroup
            label="C-Suite & Leadership"
            icon={<Crown className="h-3.5 w-3.5" />}
            contacts={data.c_suite}
          />
          <ContactGroup
            label="Marketing Team"
            icon={<Megaphone className="h-3.5 w-3.5" />}
            contacts={data.marketing}
          />
        </div>
      )}

      {data && data.success && data.totalFound > 0 && (
        <Button variant="ghost" size="sm" onClick={onSearch} disabled={isLoading} className="text-xs gap-1.5 h-7">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      )}
    </div>
  );
}
