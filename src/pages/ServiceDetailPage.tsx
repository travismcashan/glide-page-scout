import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPpcOffering, PPC_FLAT_FEE, PPC_FLAT_THRESHOLD, PPC_TIERS, PPC_STARTUP_COST } from "@/lib/ppcPricing";
import ServiceStepsEditor from "@/components/ServiceStepsEditor";
import { BrandLoader } from "@/components/BrandLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ServiceForm {
  name: string;
  category: string;
  type_of_engagement: string;
  frequency: string;
  priority: string;
  phase: string;
  billing_type: string;
  onboarding_cost: string | null;
  hourly_rate_external: number | null;
  hourly_rate_internal: number | null;
  min_fixed: number | null;
  max_fixed: number | null;
  min_retainer: number | null;
  max_retainer: number | null;
  min_hourly: number | null;
  max_hourly: number | null;
  min_term_months: number | null;
  avg_duration_low_weeks: number | null;
  avg_duration_high_weeks: number | null;
  teams_involved: string | null;
  has_one_pager: boolean;
  has_sow: boolean;
  has_faq: boolean;
  has_outcomes: boolean;
  has_testimonials: boolean;
  roadmap_grade: boolean;
  pillar: string | null;
  sku: number | null;
  default_duration_months: number | null;
}

const EMPTY: ServiceForm = {
  name: "",
  category: "Service",
  type_of_engagement: "Recurring",
  frequency: "Monthly",
  priority: "Core",
  phase: "Foundation",
  billing_type: "Retainer",
  onboarding_cost: null,
  hourly_rate_external: null,
  hourly_rate_internal: null,
  min_fixed: null,
  max_fixed: null,
  min_retainer: null,
  max_retainer: null,
  min_hourly: null,
  max_hourly: null,
  min_term_months: null,
  avg_duration_low_weeks: null,
  avg_duration_high_weeks: null,
  teams_involved: null,
  has_one_pager: false,
  has_sow: false,
  has_faq: false,
  has_outcomes: false,
  has_testimonials: false,
  roadmap_grade: false,
  pillar: null,
  sku: null,
  default_duration_months: 1,
};

const CATEGORIES = ["Service", "Project", "Add-On", "Support", "Signature", "Diagnostic", "Strategy"];
const ENGAGEMENT_TYPES = ["Recurring", "Timebound"];
const FREQUENCIES = ["Monthly", "Quarterly", "One-Time"];
const PRIORITIES = ["Core", "Premium", "Add-On", "One-Off", "Legacy", "Base", "NEW"];
const PHASES = ["Roadmap", "Foundation", "Accelerate", "Momentum", "All"];
const BILLING_TYPES = ["Retainer", "Fixed Cost", "T&M"];
const PILLAR_OPTIONS = [
  { value: "IS", label: "Insight & Strategy" },
  { value: "FB", label: "Foundation & Build" },
  { value: "GO", label: "Growth & Optimization" },
  { value: "TS", label: "Technical & Support" },
];

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isNew = id === "new";
  const [form, setForm] = useState<ServiceForm>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(isNew ? null : (id ?? null));

  useEffect(() => {
    if (isNew || !id) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Service not found");
        navigate("/services");
        return;
      }
      const s = data as any;
      setForm({
        name: s.name ?? "",
        category: s.category ?? "Service",
        type_of_engagement: s.type_of_engagement ?? "Recurring",
        frequency: s.frequency ?? "Monthly",
        priority: s.priority ?? "Core",
        phase: s.phase ?? "Foundation",
        billing_type: s.billing_type ?? "Retainer",
        onboarding_cost: s.onboarding_cost ?? null,
        hourly_rate_external: s.hourly_rate_external ?? null,
        hourly_rate_internal: s.hourly_rate_internal ?? null,
        min_fixed: s.min_fixed ?? null,
        max_fixed: s.max_fixed ?? null,
        min_retainer: s.min_retainer ?? null,
        max_retainer: s.max_retainer ?? null,
        min_hourly: s.min_hourly ?? null,
        max_hourly: s.max_hourly ?? null,
        min_term_months: s.min_term_months ?? null,
        avg_duration_low_weeks: s.avg_duration_low_weeks ?? null,
        avg_duration_high_weeks: s.avg_duration_high_weeks ?? null,
        teams_involved: s.teams_involved ?? null,
        has_one_pager: s.has_one_pager ?? false,
        has_sow: s.has_sow ?? false,
        has_faq: s.has_faq ?? false,
        has_outcomes: s.has_outcomes ?? false,
        has_testimonials: s.has_testimonials ?? false,
        roadmap_grade: s.roadmap_grade ?? false,
        pillar: s.pillar ?? null,
        sku: s.sku ?? null,
        default_duration_months: s.default_duration_months ?? 1,
      });
      setLoading(false);
    };
    fetch();
  }, [id]);

  const updateForm = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    if (isNew) {
      const { data, error } = await supabase
        .from("services")
        .insert(form as any)
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Service created");
        setServiceId(data.id);
        navigate(`/services/${data.id}`, { replace: true });
      }
    } else {
      const { error } = await supabase
        .from("services")
        .update(form as any)
        .eq("id", id!);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Changes saved");
      }
    }
    setSaving(false);
  };

  const deleteService = async () => {
    if (!id || isNew) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Service deleted");
      navigate("/services");
    }
  };

  const numField = (key: string, label: string) => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={(form as any)[key] ?? ""}
        onChange={(e) =>
          updateForm(key, e.target.value === "" ? null : Number(e.target.value))
        }
        className="h-8 text-sm"
      />
    </div>
  );

  const selectField = (key: string, label: string, options: string[]) => (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={(form as any)[key]} onValueChange={(v) => updateForm(key, v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const boolField = (key: string, label: string) => (
    <div className="flex items-center gap-2">
      <Switch
        checked={(form as any)[key]}
        onCheckedChange={(v) => updateForm(key, v)}
      />
      <Label className="text-xs">{label}</Label>
    </div>
  );

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center py-20">
          <BrandLoader size={48} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/services")}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold text-foreground">
              {isNew ? "New Service" : form.name || "Service Detail"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={deleteService}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Service Name</Label>
            <Input
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              className="h-9"
              placeholder="e.g. Search Engine Optimization"
            />
          </div>

          {/* Row 1: Category, Engagement, Frequency */}
          <div className="grid grid-cols-3 gap-3">
            {selectField("category", "Category", CATEGORIES)}
            {selectField("type_of_engagement", "Engagement", ENGAGEMENT_TYPES)}
            {selectField("frequency", "Frequency", FREQUENCIES)}
          </div>

          {/* Row 2: Priority, Pillar, Billing Type */}
          <div className="grid grid-cols-3 gap-3">
            {selectField("priority", "Priority", PRIORITIES)}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pillar</Label>
              <Select
                value={form.pillar || "none"}
                onValueChange={(v) => updateForm("pillar", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {PILLAR_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label} ({p.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectField("billing_type", "Billing Type", BILLING_TYPES)}
          </div>

          {/* SKU + Default Duration */}
          <div className="grid grid-cols-2 gap-3">
            {numField("sku", "SKU")}
            {numField("default_duration_months", "Default Duration (months)")}
          </div>

          {/* Pricing */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pricing
            </p>
            <div className="grid grid-cols-3 gap-3">
              {numField("hourly_rate_external", "Hourly Rate (External)")}
              {numField("hourly_rate_internal", "Hourly Rate (Internal)")}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Onboarding Cost</Label>
                <Input
                  value={form.onboarding_cost ?? ""}
                  onChange={(e) =>
                    updateForm(
                      "onboarding_cost",
                      e.target.value === "" ? null : e.target.value
                    )
                  }
                  placeholder="e.g. One Month"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {numField("min_fixed", "Min (Fixed)")}
              {numField("max_fixed", "Max (Fixed)")}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {numField("min_retainer", "Min (Retainer)")}
              {numField("max_retainer", "Max (Retainer)")}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {numField("min_hourly", "Min (Hourly)")}
              {numField("max_hourly", "Max (Hourly)")}
            </div>
          </div>

          {/* Duration & Term */}
          <div className="grid grid-cols-3 gap-3">
            {numField("min_term_months", "Min Term (months)")}
            {numField("avg_duration_low_weeks", "Duration Low (weeks)")}
            {numField("avg_duration_high_weeks", "Duration High (weeks)")}
          </div>

          {/* Teams Involved */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Teams Involved</Label>
            <Input
              value={form.teams_involved ?? ""}
              onChange={(e) =>
                updateForm(
                  "teams_involved",
                  e.target.value === "" ? null : e.target.value
                )
              }
              placeholder="e.g. PM, Design, Development"
              className="h-8 text-sm"
            />
          </div>

          {/* Collateral */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Collateral
            </p>
            <div className="flex flex-wrap gap-4">
              {boolField("has_one_pager", "One-Pager")}
              {boolField("has_sow", "SOW")}
              {boolField("has_faq", "FAQ")}
              {boolField("has_outcomes", "Outcomes")}
              {boolField("has_testimonials", "Testimonials")}
              {boolField("roadmap_grade", "Roadmap Grade")}
            </div>
          </div>

          {/* PPC Pricing Tiers — only for PPC Management */}
          {isPpcOffering(form.name) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                PPC Pricing Tiers
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                        Monthly Ad Spend
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                        Management Fee
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-2 text-foreground">
                        Under ${PPC_FLAT_THRESHOLD.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-foreground">
                        Flat ${PPC_FLAT_FEE.toLocaleString()}/mo
                      </td>
                    </tr>
                    {PPC_TIERS.map((tier) => (
                      <tr key={tier.pct}>
                        <td className="px-4 py-2 text-foreground">
                          ${(tier.min / 1000).toFixed(0)}k –{" "}
                          {tier.max === Infinity
                            ? "$50k+"
                            : `$${(tier.max / 1000).toFixed(0)}k`}
                        </td>
                        <td className="px-4 py-2 text-foreground">
                          {tier.pct}% of ad spend
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">Start-up Cost</td>
                      <td className="px-4 py-2 text-muted-foreground italic">
                        ${PPC_STARTUP_COST.toLocaleString()} (waivable)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Minimum 3-month contract, then month to month. 30-day written notice to cancel.
              </p>
            </div>
          )}

          {/* Phases & Cycles — only for existing services */}
          {!isNew && serviceId && <ServiceStepsEditor serviceId={serviceId} />}
        </div>
      </div>
    </div>
  );
}
