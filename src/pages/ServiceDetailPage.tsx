import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandLoader } from "@/components/BrandLoader";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Save, ExternalLink } from "lucide-react";
import { PILLARS } from "@/data/offerings";
import type { PillarCode } from "@/data/offerings";

const PILLAR_BADGE: Record<string, string> = {
  IS: "bg-pillar-is-light text-pillar-is-foreground border-pillar-is/30",
  FB: "bg-pillar-fb-light text-pillar-fb-foreground border-pillar-fb/30",
  GO: "bg-pillar-go-light text-pillar-go-foreground border-pillar-go/30",
  TS: "bg-pillar-ts-light text-pillar-ts-foreground border-pillar-ts/30",
};

const PILLAR_DOT: Record<string, string> = {
  IS: "bg-pillar-is",
  FB: "bg-pillar-fb",
  GO: "bg-pillar-go",
  TS: "bg-pillar-ts",
};

type ServiceRecord = {
  id: string;
  sku: number | null;
  name: string;
  pillar: PillarCode;
  sort_order: number;
  default_duration_months: number;
  roadmap_grade: boolean;
  active: boolean;
  phase_eligible: boolean;
  billing_type: string | null;
  min_fixed: number | null;
  max_fixed: number | null;
  min_retainer: number | null;
  max_retainer: number | null;
  min_hourly: number | null;
  max_hourly: number | null;
  hourly_rate_external: number | null;
  hourly_rate_internal: number | null;
  min_duration_months: number | null;
  max_duration_months: number | null;
  short_description: string | null;
  description: string | null;
  ideal_for: string | null;
  typical_team: string | null;
  deliverables: string[];
  not_included: string | null;
  discovery_questions: string[];
  proposal_language: string | null;
  internal_notes: string | null;
  case_study_url: string | null;
};

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 pb-3 border-b border-border">
      <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 items-start py-3 border-b border-border/50 last:border-0">
      <div className="pt-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function NumberField({ value, onChange, placeholder, prefix }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; prefix?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        placeholder={placeholder}
        className={prefix ? "pl-7" : ""}
      />
    </div>
  );
}

function JsonListField({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setDraft("");
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="flex-1 leading-snug">{item}</span>
              <button type="button" onClick={() => remove(i)} className="mt-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchService = useCallback(async () => {
    if (!id) return;
    const { data, error } = await (supabase as any)
      .from("services")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast.error("Service not found");
      navigate("/services");
      return;
    }

    setService({
      ...data,
      deliverables: Array.isArray(data.deliverables) ? data.deliverables : [],
      discovery_questions: Array.isArray(data.discovery_questions) ? data.discovery_questions : [],
    });
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchService(); }, [fetchService]);

  const update = <K extends keyof ServiceRecord>(key: K, value: ServiceRecord[K]) => {
    setService((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!service) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("services")
      .update({
        name: service.name,
        pillar: service.pillar,
        sort_order: service.sort_order,
        default_duration_months: service.default_duration_months,
        roadmap_grade: service.roadmap_grade,
        active: service.active,
        phase_eligible: service.phase_eligible,
        billing_type: service.billing_type,
        min_fixed: service.min_fixed,
        max_fixed: service.max_fixed,
        min_retainer: service.min_retainer,
        max_retainer: service.max_retainer,
        min_hourly: service.min_hourly,
        max_hourly: service.max_hourly,
        hourly_rate_external: service.hourly_rate_external,
        hourly_rate_internal: service.hourly_rate_internal,
        min_duration_months: service.min_duration_months,
        max_duration_months: service.max_duration_months,
        short_description: service.short_description,
        description: service.description,
        ideal_for: service.ideal_for,
        typical_team: service.typical_team,
        deliverables: service.deliverables,
        not_included: service.not_included,
        discovery_questions: service.discovery_questions,
        proposal_language: service.proposal_language,
        internal_notes: service.internal_notes,
        case_study_url: service.case_study_url,
      })
      .eq("id", service.id);

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Service saved");
      setDirty(false);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppHeader />
        <div className="flex-1 flex items-center justify-center animate-in fade-in duration-300">
          <BrandLoader size={96} />
        </div>
      </div>
    );
  }

  if (!service) return null;

  const pillarMeta = PILLARS.find((p) => p.code === service.pillar);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button
              onClick={() => navigate("/services")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Services
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{service.name}</h1>
              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                SKU {service.sku}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILLAR_BADGE[service.pillar]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${PILLAR_DOT[service.pillar]}`} />
                {pillarMeta?.name ?? service.pillar}
              </span>
              {!service.active && (
                <Badge variant="outline" className="text-muted-foreground text-xs">Inactive</Badge>
              )}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || !dirty} className="gap-1.5 shrink-0">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        <div className="space-y-10">
          {/* ── Identity ── */}
          <section>
            <SectionHeader title="Identity" subtitle="Core service identification and catalog settings." />
            <FieldRow label="Name">
              <Input value={service.name} onChange={(e) => update("name", e.target.value)} />
            </FieldRow>
            <FieldRow label="Pillar">
              <Select value={service.pillar} onValueChange={(v) => update("pillar", v as PillarCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PILLARS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Sort Order" hint="Lower numbers appear first in the catalog.">
              <NumberField value={service.sort_order} onChange={(v) => update("sort_order", v ?? 0)} />
            </FieldRow>
            <FieldRow label="Active">
              <div className="flex items-center gap-2 pt-1.5">
                <Switch
                  checked={service.active}
                  onCheckedChange={(v) => update("active", v)}
                />
                <Label className="text-sm text-muted-foreground">
                  {service.active ? "Visible in catalog and roadmaps" : "Hidden from catalog and roadmaps"}
                </Label>
              </div>
            </FieldRow>
            <FieldRow label="Roadmap Grade" hint="Can be recommended as a primary roadmap offering.">
              <div className="flex items-center gap-2 pt-1.5">
                <Switch
                  checked={service.roadmap_grade}
                  onCheckedChange={(v) => update("roadmap_grade", v)}
                />
                <Label className="text-sm text-muted-foreground">
                  {service.roadmap_grade ? "Eligible for roadmap" : "Not roadmap eligible"}
                </Label>
              </div>
            </FieldRow>
            <FieldRow label="Phase Eligible" hint="Can be split into phases on the project timeline.">
              <div className="flex items-center gap-2 pt-1.5">
                <Switch
                  checked={service.phase_eligible}
                  onCheckedChange={(v) => update("phase_eligible", v)}
                />
                <Label className="text-sm text-muted-foreground">
                  {service.phase_eligible ? "Can be phased" : "Single phase only"}
                </Label>
              </div>
            </FieldRow>
          </section>

          {/* ── Description ── */}
          <section>
            <SectionHeader title="Description" subtitle="Client-facing and internal descriptions used in proposals and the catalog." />
            <FieldRow label="Short Description" hint="One-liner shown in the catalog table and proposals.">
              <Input
                value={service.short_description ?? ""}
                onChange={(e) => update("short_description", e.target.value || null)}
                placeholder="e.g. Full website redesign from strategy through launch"
              />
            </FieldRow>
            <FieldRow label="Full Description" hint="Detailed description for the service detail view.">
              <Textarea
                value={service.description ?? ""}
                onChange={(e) => update("description", e.target.value || null)}
                placeholder="Describe what this service is, how it works, and why clients love it…"
                rows={5}
              />
            </FieldRow>
            <FieldRow label="Ideal For" hint="Who is this service best suited for?">
              <Textarea
                value={service.ideal_for ?? ""}
                onChange={(e) => update("ideal_for", e.target.value || null)}
                placeholder="e.g. B2B companies with 5+ year old websites, looking to modernize…"
                rows={3}
              />
            </FieldRow>
            <FieldRow label="Typical Team" hint="Who from GLIDE works on this?">
              <Input
                value={service.typical_team ?? ""}
                onChange={(e) => update("typical_team", e.target.value || null)}
                placeholder="e.g. Strategist, UX Designer, Developer, Project Manager"
              />
            </FieldRow>
          </section>

          {/* ── Pricing ── */}
          <section>
            <SectionHeader title="Pricing" subtitle="All pricing fields. Only fill in the fields relevant to this service's billing type." />
            <FieldRow label="Billing Type">
              <Select
                value={service.billing_type ?? ""}
                onValueChange={(v) => update("billing_type", v || null)}
              >
                <SelectTrigger><SelectValue placeholder="Select billing type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Price</SelectItem>
                  <SelectItem value="retainer">Monthly Retainer</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Fixed Price Range" hint="Min and max fixed project price.">
              <div className="grid grid-cols-2 gap-3">
                <NumberField value={service.min_fixed} onChange={(v) => update("min_fixed", v)} placeholder="Min" prefix="$" />
                <NumberField value={service.max_fixed} onChange={(v) => update("max_fixed", v)} placeholder="Max" prefix="$" />
              </div>
            </FieldRow>
            <FieldRow label="Retainer Range /mo" hint="Min and max monthly retainer.">
              <div className="grid grid-cols-2 gap-3">
                <NumberField value={service.min_retainer} onChange={(v) => update("min_retainer", v)} placeholder="Min" prefix="$" />
                <NumberField value={service.max_retainer} onChange={(v) => update("max_retainer", v)} placeholder="Max" prefix="$" />
              </div>
            </FieldRow>
            <FieldRow label="Hourly Range" hint="Min and max hours for this engagement.">
              <div className="grid grid-cols-2 gap-3">
                <NumberField value={service.min_hourly} onChange={(v) => update("min_hourly", v)} placeholder="Min hrs" />
                <NumberField value={service.max_hourly} onChange={(v) => update("max_hourly", v)} placeholder="Max hrs" />
              </div>
            </FieldRow>
            <FieldRow label="Hourly Rate (Client)" hint="External rate shown to clients.">
              <NumberField value={service.hourly_rate_external} onChange={(v) => update("hourly_rate_external", v)} placeholder="e.g. 150" prefix="$" />
            </FieldRow>
            <FieldRow label="Hourly Rate (Internal)" hint="Internal blended rate for margin calculations.">
              <NumberField value={service.hourly_rate_internal} onChange={(v) => update("hourly_rate_internal", v)} placeholder="e.g. 95" prefix="$" />
            </FieldRow>
          </section>

          {/* ── Duration ── */}
          <section>
            <SectionHeader title="Duration" subtitle="How long this service typically runs." />
            <FieldRow label="Default Duration" hint="Default number of months shown on roadmaps.">
              <div className="flex items-center gap-2">
                <NumberField value={service.default_duration_months} onChange={(v) => update("default_duration_months", v ?? 1)} placeholder="e.g. 4" />
                <span className="text-sm text-muted-foreground shrink-0">months</span>
              </div>
            </FieldRow>
            <FieldRow label="Min / Max Duration" hint="Optional range if duration varies significantly.">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <NumberField value={service.min_duration_months} onChange={(v) => update("min_duration_months", v)} placeholder="Min" />
                  <span className="text-xs text-muted-foreground shrink-0">mo</span>
                </div>
                <div className="flex items-center gap-2">
                  <NumberField value={service.max_duration_months} onChange={(v) => update("max_duration_months", v)} placeholder="Max" />
                  <span className="text-xs text-muted-foreground shrink-0">mo</span>
                </div>
              </div>
            </FieldRow>
          </section>

          {/* ── Deliverables ── */}
          <section>
            <SectionHeader title="Deliverables & Scope" subtitle="What's included and what's explicitly out of scope." />
            <FieldRow label="Deliverables" hint="What the client receives. Press Enter or + to add each item.">
              <JsonListField
                value={service.deliverables}
                onChange={(v) => update("deliverables", v)}
                placeholder="e.g. Fully designed 15-page website…"
              />
            </FieldRow>
            <FieldRow label="Not Included" hint="What's explicitly out of scope (prevents scope creep).">
              <Textarea
                value={service.not_included ?? ""}
                onChange={(e) => update("not_included", e.target.value || null)}
                placeholder="e.g. Copywriting, photography, third-party integrations beyond 2 APIs…"
                rows={3}
              />
            </FieldRow>
          </section>

          {/* ── Sales ── */}
          <section>
            <SectionHeader title="Sales & Proposal" subtitle="Content used during sales and proposal generation." />
            <FieldRow label="Discovery Questions" hint="Questions to ask the prospect during discovery calls.">
              <JsonListField
                value={service.discovery_questions}
                onChange={(v) => update("discovery_questions", v)}
                placeholder="e.g. What's driving the need for a new website right now?"
              />
            </FieldRow>
            <FieldRow label="Proposal Language" hint="Boilerplate description used in proposals and SOWs.">
              <Textarea
                value={service.proposal_language ?? ""}
                onChange={(e) => update("proposal_language", e.target.value || null)}
                placeholder="Paste or write the standard proposal description for this service…"
                rows={6}
              />
            </FieldRow>
            <FieldRow label="Case Study URL" hint="Link to a relevant example or case study.">
              <div className="flex items-center gap-2">
                <Input
                  value={service.case_study_url ?? ""}
                  onChange={(e) => update("case_study_url", e.target.value || null)}
                  placeholder="https://glidedesign.com/work/…"
                  type="url"
                  className="flex-1"
                />
                {service.case_study_url && (
                  <a href={service.case_study_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            </FieldRow>
          </section>

          {/* ── Internal ── */}
          <section>
            <SectionHeader title="Internal Notes" subtitle="Private notes for the GLIDE team — not shown to clients." />
            <FieldRow label="Notes">
              <Textarea
                value={service.internal_notes ?? ""}
                onChange={(e) => update("internal_notes", e.target.value || null)}
                placeholder="Any operational notes, gotchas, pricing history, or team guidance…"
                rows={5}
              />
            </FieldRow>
          </section>
        </div>

        {/* Sticky save bar when dirty */}
        {dirty && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border px-6 py-3 flex items-center justify-between animate-in slide-in-from-bottom duration-200">
            <span className="text-sm text-muted-foreground">You have unsaved changes.</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchService(); setDirty(false); }}>
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
