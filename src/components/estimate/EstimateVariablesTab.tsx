import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EstimateVariables } from '@/lib/estimateFormulas';

interface Props {
  variables: EstimateVariables;
  onChange: (variables: EstimateVariables) => void;
}

export function EstimateVariablesTab({ variables, onChange }: Props) {
  const handleChange = <K extends keyof EstimateVariables>(field: K, value: EstimateVariables[K]) => {
    onChange({ ...variables, [field]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Project Variables</CardTitle>
        <CardDescription>These values affect task hour calculations</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Design Layouts" value={variables.design_layouts ?? 5} onChange={(v) => handleChange('design_layouts', v)} />
        <Field label="Pages for Integration" value={variables.pages_for_integration ?? 20} onChange={(v) => handleChange('pages_for_integration', v)} />
        <Field label="User Personas" value={variables.user_personas ?? 3} onChange={(v) => handleChange('user_personas', v)} />
        <Field label="Custom Posts" value={variables.custom_posts ?? 2} onChange={(v) => handleChange('custom_posts', v)} min={0} />
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
