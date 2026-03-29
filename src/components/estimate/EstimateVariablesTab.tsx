import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { EstimateVariables } from '@/lib/estimateFormulas';

interface Props {
  variables: EstimateVariables;
  onChange: (variables: EstimateVariables) => void;
  baseModel?: { totalHours: number; totalCost: number } | null;
}

export function EstimateVariablesTab({ variables, onChange, baseModel }: Props) {
  const handleChange = <K extends keyof EstimateVariables>(field: K, value: EstimateVariables[K]) => {
    onChange({ ...variables, [field]: value });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="space-y-4">
      {/* PM & QA Percentage Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Phase Percentages</CardTitle>
          <CardDescription>PM and QA phases are calculated as a percentage of core work (Strategy + Design + Build + Content + Optimization)</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Project Management</Label>
              <span className="text-sm font-medium tabular-nums">{variables.pm_percentage ?? 8}%</span>
            </div>
            <Slider
              value={[variables.pm_percentage ?? 8]}
              onValueChange={([v]) => handleChange('pm_percentage', v)}
              min={0}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Quality Assurance</Label>
              <span className="text-sm font-medium tabular-nums">{variables.qa_percentage ?? 6}%</span>
            </div>
            <Slider
              value={[variables.qa_percentage ?? 6]}
              onValueChange={([v]) => handleChange('qa_percentage', v)}
              min={0}
              max={20}
              step={1}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Base Model Card */}
      {baseModel && (
        <Card className="border-dashed bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Base Model (Floor Price)</CardTitle>
            <CardDescription className="text-xs">Minimum cost with all variables at 1 — the cost to do any project regardless of size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-4">
              <span className="text-2xl font-bold text-foreground">{formatCurrency(Math.round(baseModel.totalCost / 100) * 100)}</span>
              <span className="text-sm text-muted-foreground">{Math.round(baseModel.totalHours)} hours</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Variables */}
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
    </div>
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
