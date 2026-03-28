import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import type { EstimateVariables } from '@/lib/estimateFormulas';

interface AiTiers {
  S: string[];
  M: string[];
  L: string[];
  reasoning?: string;
}

interface Props {
  variables: EstimateVariables;
  onChange: (variables: EstimateVariables) => void;
  templateTiers?: AiTiers | null;
}

type TierKey = 'S' | 'M' | 'L';

function getRecommendedTier(tiers: AiTiers | null | undefined): TierKey | null {
  if (!tiers) return null;
  const nonToolkitCount = (tiers.L || []).length;
  if (nonToolkitCount <= 8) return 'S';
  if (nonToolkitCount <= 18) return 'M';
  return 'L';
}

function getTierLayoutCount(tiers: AiTiers | null | undefined, tier: TierKey): number | null {
  if (!tiers) return null;
  const arr = tiers[tier];
  return Array.isArray(arr) ? arr.length : null;
}

export function EstimateVariablesTab({ variables, onChange, templateTiers }: Props) {
  const recommendedTier = getRecommendedTier(templateTiers);

  const handleChange = <K extends keyof EstimateVariables>(field: K, value: EstimateVariables[K]) => {
    onChange({ ...variables, [field]: value });
  };

  const currentLayouts = variables.design_layouts ?? 5;
  const activeTier: TierKey | '' = (() => {
    if (!templateTiers) return '';
    for (const t of ['S', 'M', 'L'] as TierKey[]) {
      const count = getTierLayoutCount(templateTiers, t);
      if (count !== null && count === currentLayouts) return t;
    }
    return '';
  })();

  const handleTierChange = (tier: string) => {
    if (!tier || !templateTiers) return;
    const count = getTierLayoutCount(templateTiers, tier as TierKey);
    if (count !== null) {
      onChange({ ...variables, design_layouts: count });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Project Variables</CardTitle>
        <CardDescription>These values affect task hour calculations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templateTiers && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Design Tier</Label>
              {recommendedTier && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                  AI: {recommendedTier}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ToggleGroup
                type="single"
                value={activeTier}
                onValueChange={handleTierChange}
                className="justify-start"
              >
                {(['S', 'M', 'L'] as TierKey[]).map(t => {
                  const count = getTierLayoutCount(templateTiers, t);
                  return (
                    <ToggleGroupItem
                      key={t}
                      value={t}
                      className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {t === 'S' ? 'Small' : t === 'M' ? 'Medium' : 'Large'}
                      {count !== null && <span className="ml-1 opacity-60">({count})</span>}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
              {activeTier === '' && (
                <span className="text-xs text-muted-foreground">Custom ({currentLayouts})</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Design Layouts" value={currentLayouts} onChange={(v) => handleChange('design_layouts', v)} />
          <Field label="Pages for Integration" value={variables.pages_for_integration ?? 20} onChange={(v) => handleChange('pages_for_integration', v)} />
          <Field label="User Personas" value={variables.user_personas ?? 3} onChange={(v) => handleChange('user_personas', v)} />
          <Field label="Custom Posts" value={variables.custom_posts ?? 2} onChange={(v) => handleChange('custom_posts', v)} min={0} />
          <Field label="Number of Forms" value={variables.form_count ?? 2} onChange={(v) => handleChange('form_count', v)} min={0} />
          <Field label="Third Party Integrations" value={variables.third_party_integrations ?? 2} onChange={(v) => handleChange('third_party_integrations', v)} min={0} />
          <div className="space-y-1.5">
            <Label className="text-xs">Bulk Import Amount</Label>
            <Select value={variables.bulk_import_amount || '<500'} onValueChange={(v) => handleChange('bulk_import_amount', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="<500">&lt; 500</SelectItem>
                <SelectItem value="500-1000">500 - 1,000</SelectItem>
                <SelectItem value="1000-5000">1,000 - 5,000</SelectItem>
                <SelectItem value=">5000">&gt; 5,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, min = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={min} value={value} onChange={(e) => onChange(parseInt(e.target.value) || min)} className="h-8 text-sm" />
    </div>
  );
}
