import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ApolloData } from './apollo/types';
import { ApolloPersonHeader } from './apollo/ApolloPersonHeader';
import { ApolloContactSection } from './apollo/ApolloContactSection';
import { ApolloOrgSection } from './apollo/ApolloOrgSection';
import { ApolloEmploymentSection } from './apollo/ApolloEmploymentSection';
import { ApolloTeamContacts, type ApolloTeamData } from './apollo/ApolloTeamContacts';

type Props = {
  data: ApolloData | null;
  isLoading: boolean;
  onSearch: (email: string, firstName?: string, lastName?: string) => void;
  teamData?: ApolloTeamData | null;
  teamLoading?: boolean;
  onTeamSearch?: () => void;
  prospectDomain?: string | null;
};

function CreditsBanner({ error }: { error?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
      <span className="text-sm">⚠</span>
      <p className="text-xs text-muted-foreground">{error || 'Apollo API credits have been exhausted. Enrichment will resume once credits are replenished.'}</p>
    </div>
  );
}

export function ApolloCard({ data, isLoading, onSearch, teamData, teamLoading, onTeamSearch, prospectDomain }: Props) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Email is required'); return; }
    onSearch(email.trim(), firstName.trim() || undefined, lastName.trim() || undefined);
  };

  const domain = prospectDomain || data?.organizationDomain || null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter your prospect's email to pull their professional profile, employment history, and company details from Apollo's 275M+ contact database.</p>

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

      {data && data.found === false && (
        <p className="text-sm text-muted-foreground">No matching contact found in Apollo's database.</p>
      )}

      {data && data.found && (
        <div className="border rounded-lg overflow-hidden">
          <ApolloPersonHeader data={data} />
          <div className="p-4 space-y-4">
            <ApolloContactSection data={data} />
            <ApolloOrgSection data={data} />
            <ApolloEmploymentSection data={data} />
            {onTeamSearch && (
              <ApolloTeamContacts
                data={teamData || null}
                isLoading={teamLoading || false}
                onSearch={onTeamSearch}
                domain={domain}
              />
            )}
          </div>
        </div>
      )}

      {/* Show team search even without a primary contact if we have a domain */}
      {(!data || !data.found) && domain && onTeamSearch && (
        <ApolloTeamContacts
          data={teamData || null}
          isLoading={teamLoading || false}
          onSearch={onTeamSearch}
          domain={domain}
        />
      )}
    </div>
  );
}
