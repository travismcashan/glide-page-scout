import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link2, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { findBestMatch, type CompanyRecord, type MatchResult } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  unlinkedHarvest: CompanyRecord[];
  unlinkedFreshdesk: CompanyRecord[];
  unlinkedAsana: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

type UnlinkedItem = {
  source: 'harvest' | 'freshdesk' | 'asana' | 'quickbooks';
  company: CompanyRecord;
  match: MatchResult | null;
  approved: boolean | null; // null = pending, true = approved, false = rejected
};

const TABS = ['All', 'Harvest', 'Freshdesk', 'Asana'] as const;

export default function Phase3MatchLink({ companies, unlinkedHarvest, unlinkedFreshdesk, unlinkedAsana, onComplete, onSkip, onRefetch }: Props) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('All');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Build candidates list (companies that have HubSpot or are otherwise "primary")
  const candidates = useMemo(() =>
    companies
      .filter(c => c.hubspot_company_id)
      .map(c => ({ id: c.id, name: c.name, domain: c.domain })),
    [companies]
  );

  // Build unlinked items with best matches
  const items = useMemo(() => {
    const result: UnlinkedItem[] = [];

    for (const c of unlinkedHarvest) {
      const match = findBestMatch(c.harvest_client_name || c.name, c.domain, candidates);
      result.push({ source: 'harvest', company: c, match, approved: null });
    }
    for (const c of unlinkedFreshdesk) {
      const match = findBestMatch(c.freshdesk_company_name || c.name, c.domain, candidates);
      result.push({ source: 'freshdesk', company: c, match, approved: null });
    }
    for (const c of unlinkedAsana) {
      const match = findBestMatch(c.name, c.domain, candidates);
      result.push({ source: 'asana', company: c, match, approved: null });
    }

    // Sort: high confidence first, then medium, then low, then none
    const order = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => {
      const aConf = a.match?.confidence ? order[a.match.confidence] : 3;
      const bConf = b.match?.confidence ? order[b.match.confidence] : 3;
      return aConf - bConf;
    });

    return result;
  }, [unlinkedHarvest, unlinkedFreshdesk, unlinkedAsana, candidates]);

  const [approvals, setApprovals] = useState<Map<string, boolean>>(new Map());

  const toggleApproval = (id: string, approved: boolean) => {
    setApprovals(prev => {
      const next = new Map(prev);
      if (next.get(id) === approved) next.delete(id); else next.set(id, approved);
      return next;
    });
  };

  const filtered = activeTab === 'All'
    ? items
    : items.filter(i => i.source === activeTab.toLowerCase());

  const approvedCount = Array.from(approvals.entries()).filter(([, v]) => v).length;

  const saveApproved = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let linked = 0;
      for (const [companyId, approved] of approvals) {
        if (!approved) continue;
        const item = items.find(i => i.company.id === companyId);
        if (!item?.match) continue;

        // The unlinked company has one system ID. The match target has HubSpot.
        // We need to merge the unlinked company's system ID into the match target.
        const updates: any = {};
        if (item.source === 'harvest') {
          updates.harvest_client_id = item.company.harvest_client_id;
          updates.harvest_client_name = item.company.harvest_client_name;
        } else if (item.source === 'freshdesk') {
          updates.freshdesk_company_id = item.company.freshdesk_company_id;
          updates.freshdesk_company_name = item.company.freshdesk_company_name;
        } else if (item.source === 'asana') {
          // Merge Asana GIDs
          const targetCompany = companies.find(c => c.id === item.match!.targetId);
          const existingGids = new Set(targetCompany?.asana_project_gids || []);
          for (const gid of (item.company.asana_project_gids || [])) existingGids.add(gid);
          updates.asana_project_gids = Array.from(existingGids);
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('companies').update(updates).eq('id', item.match.targetId);

          // Move FK references from the unlinked company to the target
          await supabase.from('contacts').update({ company_id: item.match.targetId }).eq('company_id', companyId);
          await supabase.from('deals').update({ company_id: item.match.targetId }).eq('company_id', companyId);
          await supabase.from('engagements').update({ company_id: item.match.targetId }).eq('company_id', companyId);

          // Log and delete
          await supabase.from('company_cleanup_log').insert({
            user_id: user.id,
            phase: 'match_link',
            action: 'link',
            source_id: companyId,
            target_id: item.match.targetId,
            details: { source: item.source, match: item.match, company: item.company },
          });

          await supabase.from('companies').delete().eq('id', companyId);
          linked++;
        }
      }

      toast.success(`Linked ${linked} companies`);
      setSaved(true);
      onRefetch();
    } catch (err: any) {
      toast.error(`Link failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0 || saved) {
    return (
      <Card className="p-8 text-center">
        <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">{saved ? 'Match & Link Complete' : 'No Unlinked Companies'}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {saved ? 'Cross-system links have been established.' : 'All companies are already linked across systems.'}
        </p>
        <Button onClick={onComplete}>Continue to Next Phase</Button>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <h2 className="text-lg font-semibold mb-1">Match & Link</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {items.length} unlinked companies found across systems. Review suggested matches and approve or reject.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border pb-2">
        {TABS.map(tab => {
          const count = tab === 'All' ? items.length : items.filter(i => i.source === tab.toLowerCase()).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab} <span className="text-xs ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-y-auto max-h-[450px] rounded-lg border border-border mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Source</TableHead>
              <TableHead className="text-xs w-[25%]">Unlinked Company</TableHead>
              <TableHead className="text-xs w-[25%]">Suggested Match</TableHead>
              <TableHead className="text-xs">Confidence</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(item => {
              const approval = approvals.get(item.company.id);
              return (
                <TableRow key={item.company.id} className={
                  approval === true ? 'bg-green-500/5' :
                  approval === false ? 'bg-red-500/5 opacity-50' : ''
                }>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px] py-0 capitalize">{item.source}</Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="text-sm font-medium">{item.company.name}</div>
                    {item.company.domain && <div className="text-xs text-muted-foreground">{item.company.domain}</div>}
                  </TableCell>
                  <TableCell className="py-2">
                    {item.match ? (
                      <>
                        <div className="text-sm">{item.match.targetName}</div>
                        {item.match.targetDomain && <div className="text-xs text-muted-foreground">{item.match.targetDomain}</div>}
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">No match found</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {item.match && (
                      <Badge variant="outline" className={`text-[10px] py-0 ${
                        item.match.confidence === 'high' ? 'text-green-600 border-green-500/30 bg-green-500/10' :
                        item.match.confidence === 'medium' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
                        'text-orange-500 border-orange-500/30 bg-orange-500/10'
                      }`}>
                        {item.match.matchType === 'exact_domain' ? 'Domain' : `${Math.round(item.match.score * 100)}%`}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    {item.match && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant={approval === true ? 'default' : 'ghost'}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleApproval(item.company.id, true)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={approval === false ? 'destructive' : 'ghost'}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleApproval(item.company.id, false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={saveApproved} disabled={saving || approvedCount === 0}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
          Link {approvedCount} Approved Matches
        </Button>
        <Button variant="outline" onClick={onSkip}>Skip</Button>
      </div>
    </Card>
  );
}
