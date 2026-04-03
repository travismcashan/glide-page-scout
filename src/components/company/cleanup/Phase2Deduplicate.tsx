import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layers, Check, Loader2, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { type DuplicateGroup, type CompanyRecord } from '@/lib/companyNormalization';

type Props = {
  duplicates: DuplicateGroup[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

function systemBadges(c: CompanyRecord) {
  const badges: { label: string; color: string }[] = [];
  if (c.hubspot_company_id) badges.push({ label: 'HubSpot', color: 'text-orange-600 border-orange-500/30 bg-orange-500/10' });
  if (c.harvest_client_id) badges.push({ label: 'Harvest', color: 'text-orange-500 border-orange-400/30 bg-orange-400/10' });
  if (c.freshdesk_company_id) badges.push({ label: 'Freshdesk', color: 'text-green-600 border-green-500/30 bg-green-500/10' });
  if (c.asana_project_gids?.length) badges.push({ label: 'Asana', color: 'text-purple-600 border-purple-500/30 bg-purple-500/10' });
  if (c.quickbooks_client_name) badges.push({ label: 'QB', color: 'text-blue-600 border-blue-500/30 bg-blue-500/10' });
  return badges;
}

export default function Phase2Deduplicate({ duplicates, onComplete, onSkip, onRefetch }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(duplicates.map(d => d.key)));
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(0);

  if (duplicates.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">No Duplicates Found</h2>
        <p className="text-sm text-muted-foreground mb-6">Your company data has no exact duplicate pairs.</p>
        <Button onClick={onComplete}>Continue to Next Phase</Button>
      </Card>
    );
  }

  const toggleGroup = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const mergeSelected = async () => {
    setMerging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let count = 0;
      for (const group of duplicates) {
        if (!selected.has(group.key)) continue;
        const keep = group.recommended;
        const removes = group.companies.filter(c => c.id !== keep.id);

        for (const remove of removes) {
          // Merge cross-system IDs into the keeper
          const updates: any = {};
          if (!keep.hubspot_company_id && remove.hubspot_company_id) updates.hubspot_company_id = remove.hubspot_company_id;
          if (!keep.harvest_client_id && remove.harvest_client_id) {
            updates.harvest_client_id = remove.harvest_client_id;
            updates.harvest_client_name = remove.harvest_client_name;
          }
          if (!keep.freshdesk_company_id && remove.freshdesk_company_id) {
            updates.freshdesk_company_id = remove.freshdesk_company_id;
            updates.freshdesk_company_name = remove.freshdesk_company_name;
          }
          if (!keep.quickbooks_client_name && remove.quickbooks_client_name) updates.quickbooks_client_name = remove.quickbooks_client_name;
          if (!keep.domain && remove.domain) updates.domain = remove.domain;
          if (!keep.industry && remove.industry) updates.industry = remove.industry;

          // Merge Asana GIDs
          const keepGids = new Set(keep.asana_project_gids || []);
          for (const gid of (remove.asana_project_gids || [])) keepGids.add(gid);
          if (keepGids.size > (keep.asana_project_gids?.length || 0)) {
            updates.asana_project_gids = Array.from(keepGids);
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from('companies').update(updates).eq('id', keep.id);
          }

          // Move FK references
          await supabase.from('contacts').update({ company_id: keep.id }).eq('company_id', remove.id);
          await supabase.from('deals').update({ company_id: keep.id }).eq('company_id', remove.id);
          await supabase.from('engagements').update({ company_id: keep.id }).eq('company_id', remove.id);

          // Log the merge
          await supabase.from('company_cleanup_log').insert({
            user_id: user.id,
            phase: 'deduplicate',
            action: 'merge',
            source_id: remove.id,
            target_id: keep.id,
            details: { removedCompany: remove, keptCompany: keep },
          });

          // Delete the duplicate
          await supabase.from('companies').delete().eq('id', remove.id);
          count++;
        }
      }

      setMerged(count);
      toast.success(`Merged ${count} duplicate records`);
      onRefetch();
    } catch (err: any) {
      toast.error(`Merge failed: ${err.message}`);
    } finally {
      setMerging(false);
    }
  };

  if (merged > 0) {
    return (
      <Card className="p-8 text-center">
        <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">Deduplication Complete</h2>
        <p className="text-sm text-muted-foreground mb-6">Merged {merged} duplicate records.</p>
        <Button onClick={onComplete}>Continue to Next Phase</Button>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Deduplicate Companies</h2>
          <p className="text-sm text-muted-foreground">
            {duplicates.length} duplicate groups found. The recommended record (most cross-system IDs) is kept, others are merged in and deleted.
          </p>
        </div>
        <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {selected.size} selected
        </Badge>
      </div>

      <div className="overflow-y-auto max-h-[500px] rounded-lg border border-border mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-8"></TableHead>
              <TableHead className="text-xs">Match Type</TableHead>
              <TableHead className="text-xs">Companies</TableHead>
              <TableHead className="text-xs">Keep</TableHead>
              <TableHead className="text-xs">Remove</TableHead>
              <TableHead className="text-xs">Systems</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {duplicates.map(group => {
              const keep = group.recommended;
              const removes = group.companies.filter(c => c.id !== keep.id);
              return (
                <TableRow key={group.key}>
                  <TableCell className="py-2">
                    <Checkbox
                      checked={selected.has(group.key)}
                      onCheckedChange={() => toggleGroup(group.key)}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px] py-0">
                      {group.matchType}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm">{group.companies.length}</TableCell>
                  <TableCell className="py-2">
                    <div className="text-sm font-medium">{keep.name}</div>
                    {keep.domain && <div className="text-xs text-muted-foreground">{keep.domain}</div>}
                  </TableCell>
                  <TableCell className="py-2">
                    {removes.map(r => (
                      <div key={r.id} className="text-sm text-muted-foreground">{r.name}</div>
                    ))}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {systemBadges(keep).map(b => (
                        <Badge key={b.label} variant="outline" className={`text-[10px] py-0 ${b.color}`}>
                          {b.label}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={mergeSelected} disabled={merging || selected.size === 0}>
          {merging ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Layers className="h-4 w-4 mr-1" />}
          Merge {selected.size} Groups
        </Button>
        <Button variant="outline" onClick={() => setSelected(new Set(duplicates.map(d => d.key)))}>Select All</Button>
        <Button variant="outline" onClick={() => setSelected(new Set())}>Deselect All</Button>
        <Button variant="outline" onClick={onSkip}>Skip</Button>
      </div>
    </Card>
  );
}
