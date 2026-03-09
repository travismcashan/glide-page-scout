import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Linkedin, Mail, Phone, Building2, MapPin, Briefcase, Search, UserPlus } from 'lucide-react';
import { apolloApi } from '@/lib/api/firecrawl';
import { toast } from 'sonner';

type ApolloData = {
  success: boolean;
  found?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  linkedinUrl?: string;
  photoUrl?: string;
  email?: string;
  emailStatus?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  organizationName?: string;
  organizationDomain?: string;
  organizationIndustry?: string;
  organizationSize?: number;
  organizationLinkedin?: string;
  organizationLogo?: string;
  seniority?: string;
  departments?: string[];
  employmentHistory?: { title: string; organizationName: string; startDate?: string; endDate?: string; current?: boolean }[];
  error?: string;
};

type Props = {
  data: ApolloData | null;
  isLoading: boolean;
  onSearch: (email: string, firstName?: string, lastName?: string) => void;
};

export function ApolloCard({ data, isLoading, onSearch }: Props) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Email is required'); return; }
    onSearch(email.trim(), firstName.trim() || undefined, lastName.trim() || undefined);
  };

  return (
    <div className="space-y-4">
      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground mb-1 block">Email *</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" type="email" required disabled={isLoading} />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">First name</label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" disabled={isLoading} />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">Last name</label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" disabled={isLoading} />
        </div>
        <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {isLoading ? 'Searching...' : 'Enrich'}
        </Button>
      </form>

      {/* Results */}
      {data && data.found === false && (
        <p className="text-sm text-muted-foreground">No matching contact found in Apollo's database.</p>
      )}

      {data && data.found && (
        <div className="border rounded-lg p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-4">
            {data.photoUrl ? (
              <img src={data.photoUrl} alt={data.name || ''} className="h-14 w-14 rounded-full object-cover border" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground">
                {(data.firstName?.[0] || '?')}{(data.lastName?.[0] || '')}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg leading-tight">{data.name}</h3>
              {data.title && <p className="text-sm text-muted-foreground">{data.title}</p>}
              {data.seniority && (
                <Badge variant="secondary" className="mt-1 text-[10px]">{data.seniority}</Badge>
              )}
              {data.departments?.map(d => (
                <Badge key={d} variant="outline" className="mt-1 ml-1 text-[10px]">{d}</Badge>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {data.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${data.email}`} className="text-primary hover:underline truncate">{data.email}</a>
                {data.emailStatus && <Badge variant={data.emailStatus === 'verified' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{data.emailStatus}</Badge>}
              </div>
            )}
            {data.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{data.phone}</span>
              </div>
            )}
            {data.linkedinUrl && (
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{data.linkedinUrl.replace('https://www.linkedin.com/in/', '')}</a>
              </div>
            )}
            {(data.city || data.state || data.country) && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{[data.city, data.state, data.country].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Organization */}
          {data.organizationName && (
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-2">
                {data.organizationLogo ? (
                  <img src={data.organizationLogo} alt="" className="h-5 w-5 rounded" />
                ) : (
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">{data.organizationName}</span>
                {data.organizationIndustry && <Badge variant="outline" className="text-[10px]">{data.organizationIndustry}</Badge>}
                {data.organizationSize && <Badge variant="secondary" className="text-[10px]">{data.organizationSize.toLocaleString()} employees</Badge>}
              </div>
              {data.organizationLinkedin && (
                <a href={data.organizationLinkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Company LinkedIn →</a>
              )}
            </div>
          )}

          {/* Employment History */}
          {data.employmentHistory && data.employmentHistory.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Employment History
              </h4>
              <div className="space-y-1.5">
                {data.employmentHistory.slice(0, 5).map((job, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`font-medium ${job.current ? 'text-foreground' : 'text-muted-foreground'}`}>{job.title}</span>
                    <span className="text-muted-foreground">at</span>
                    <span>{job.organizationName}</span>
                    {job.current && <Badge variant="default" className="text-[10px] px-1.5 py-0">Current</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
