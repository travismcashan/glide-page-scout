import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Check, Loader2, Archive, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { type CompanyRecord, normalizeDomain } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

type Classification = 'valid' | 'suspect' | 'dead';

type ValidatedCompany = CompanyRecord & {
  classification: Classification;
  reason: string;
};

function classifyCompany(c: CompanyRecord): { classification: Classification; reason: string } {
  const hasActiveLinks = !!(c.harvest_client_id || c.freshdesk_company_id || (c.asana_project_gids?.length));
  const hasQuickbooks = !!c.quickbooks_client_name;
  const hasDomain = !!normalizeDomain(c.domain);
  const hasHubspot = !!c.hubspot_company_id;
  const hasEnrichment = c.enrichment_data && Object.keys(c.enrichment_data).length > 0;
  const isActive = c.status === 'active';

  if (isActive || hasActiveLinks) return { classification: 'valid', reason: 'Active system links' };
  if (hasQuickbooks) return { classification: 'valid', reason: 'QuickBooks invoice history' };
  if (hasDomain && hasEnrichment) return { classification: 'valid', reason: 'Domain + enrichment data' };
  if (hasDomain && hasHubspot) return { classification: 'valid', reason: 'Domain + HubSpot record' };
  if (hasDomain) return { classification: 'valid', reason: 'Has valid domain' };

  if (hasHubspot && !hasDomain) return { classification: 'suspect', reason: 'HubSpot only, no domain' };
  if (!hasDomain && !hasActiveLinks && !hasQuickbooks) return { classification: 'suspect', reason: 'No domain, no system links' };

  return { classification: 'dead', reason: 'No identifiable data' };
}

export default function Phase4Validate({ companies, onComplete, onSkip, onRefetch }: Props) {
  const [activeTab, setActiveTab] = useState<Classification | 'all'>('all');
  const [archiving, setArchiving] = useState(false);
  const [done, setDone] = useState(false);

  const validated = useMemo(() => {
    return companies
      .filter(c => c.status !== 'archived')
      .map(c => ({ ...c, ...classifyCompany(c) })) as ValidatedCompany[];
  }, [companies]);

  const valid = validated.filter(v => v.classification === 'valid');
  const suspect = validated.filter(v => v.classification === 'suspect');
  const dead = validated.filter(v => v.classification === 'dead');

  const filtered = activeTab === 'all' ? validated :
    validated.filter(v => v.classification === activeTab);

  const archiveSuspectAndDead = async () => {
    setArchiving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const toArchive = [...suspect, ...dead];
      const ids = toArchive.map(c => c.id);

      if (ids.length === 0) {
        toast.info('Nothing to archive');
        setDone(true);
        return;
      }

      // Batch update status
      const { error } = await supabase
        .from('companies')
        .update({ status: 'archived' })
        .in('id', ids);

      if (error) throw error;

      // Log
      await supabase.from('company_cleanup_log').insert({
        user_id: user.id,
        phase: 'validate',
        action: 'bulk_archive',
        details: {
          count: ids.length,
          suspect: suspect.length,
          dead: dead.length,
          ids,
        },
      });

      toast.success(`Archived ${ids.length} companies (${suspect.length} suspect, ${dead.length} dead)`);
      setDone(true);
      onRefetch();
    } catch (err: any) {
      toast.error(`Archive failed: ${err.message}`);
    } finally {
      setArchiving(false);
    }
  };

  if (done) {
    return (
      <Card className="p-8 text-center">
        <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">Validation Complete</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {valid.length} valid companies ready for enrichment.
        </p>
        <Button onClick={onComplete}>Continue to Next Phase</Button>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <h2 className="text-lg font-semibold mb-1">Validate Companies</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Classify companies before spending money on enrichment. Archive suspect and dead records to keep your data clean.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Valid</span>
          </div>
          <p className="text-2xl font-bold">{valid.length}</p>
          <p className="text-xs text-muted-foreground">Active links, domains, or invoices</p>
        </Card>
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">Suspect</span>
          </div>
          <p className="text-2xl font-bold">{suspect.length}</p>
          <p className="text-xs text-muted-foreground">No domain, no active system links</p>
        </Card>
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-500">Dead</span>
          </div>
          <p className="text-2xl font-bold">{dead.length}</p>
          <p className="text-xs text-muted-foreground">No identifiable data</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border pb-2">
        {(['all', 'valid', 'suspect', 'dead'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
              activeTab === tab ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab} <span className="text-xs ml-1 opacity-70">
              {tab === 'all' ? validated.length : tab === 'valid' ? valid.length : tab === 'suspect' ? suspect.length : dead.length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-y-auto max-h-[400px] rounded-lg border border-border mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[30%]">Company</TableHead>
              <TableHead className="text-xs">Domain</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Classification</TableHead>
              <TableHead className="text-xs">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-sm font-medium py-2">{c.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-2">{c.domain || '-'}</TableCell>
                <TableCell className="py-2">
                  <Badge variant="outline" className="text-[10px] py-0 capitalize">{c.status}</Badge>
                </TableCell>
                <TableCell className="py-2">
                  <Badge variant="outline" className={`text-[10px] py-0 ${
                    c.classification === 'valid' ? 'text-green-600 border-green-500/30 bg-green-500/10' :
                    c.classification === 'suspect' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
                    'text-red-500 border-red-500/30 bg-red-500/10'
                  }`}>
                    {c.classification}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-2">{c.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length > 100 && (
          <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t">
            Showing 100 of {filtered.length}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={archiveSuspectAndDead} disabled={archiving || (suspect.length + dead.length === 0)} variant="destructive">
          {archiving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Archive className="h-4 w-4 mr-1" />}
          Archive {suspect.length + dead.length} Suspect + Dead
        </Button>
        <Button variant="outline" onClick={() => { setDone(true); }}>Keep All, Continue</Button>
        <Button variant="outline" onClick={onSkip}>Skip</Button>
      </div>
    </Card>
  );
}
