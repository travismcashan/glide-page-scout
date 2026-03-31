import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Megaphone, Crown, Linkedin, Mail, ChevronDown, ChevronUp, Briefcase, GraduationCap } from 'lucide-react';

type EmploymentEntry = {
  title?: string;
  organizationName?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  degree?: string;
  kind?: string;
};

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
  employmentHistory?: EmploymentEntry[];
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

function formatDate(d?: string) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function EmploymentTimeline({ history }: { history: EmploymentEntry[] }) {
  if (!history || history.length === 0) return null;

  const jobs = history.filter(e => e.kind !== 'education');
  const education = history.filter(e => e.kind === 'education');

  return (
    <div className="mt-2 ml-11 space-y-1.5">
      {jobs.slice(0, 4).map((entry, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <Briefcase className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <span className="font-medium">{entry.title}</span>
            {entry.organizationName && (
              <span className="text-muted-foreground"> · {entry.organizationName}</span>
            )}
            {(entry.startDate || entry.endDate) && (
              <span className="text-muted-foreground/70 ml-1">
                ({formatDate(entry.startDate)}{entry.endDate ? ` – ${formatDate(entry.endDate)}` : entry.current ? ' – Present' : ''})
              </span>
            )}
          </div>
        </div>
      ))}
      {education.slice(0, 2).map((entry, i) => (
        <div key={`edu-${i}`} className="flex items-start gap-2 text-xs">
          <GraduationCap className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <span className="font-medium">{entry.organizationName}</span>
            {entry.degree && (
              <span className="text-muted-foreground"> · {entry.degree}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactRow({ contact }: { contact: TeamContact }) {
  const [expanded, setExpanded] = useState(false);
  const hasHistory = contact.employmentHistory && contact.employmentHistory.length > 0;

  return (
    <div className="py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        {contact.photoUrl ? (
          <img src={contact.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-border shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {(contact.firstName?.[0] || '?')}{(contact.lastName?.[0] || '')}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => hasHistory && setExpanded(!expanded)}
              className={`text-sm font-medium truncate ${hasHistory ? 'hover:underline cursor-pointer' : ''}`}
            >
              {contact.name}
            </button>
            {contact.seniority && (
              <Badge variant="secondary" className="text-[10px] capitalize px-1 py-0">{contact.seniority}</Badge>
            )}
            {hasHistory && (
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>
          {contact.title && (
            <p className="text-xs text-muted-foreground truncate">{contact.title}</p>
          )}
          {contact.city && (
            <p className="text-[10px] text-muted-foreground/70 truncate">
              {[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}
            </p>
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
      {expanded && contact.employmentHistory && (
        <EmploymentTimeline history={contact.employmentHistory} />
      )}
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
